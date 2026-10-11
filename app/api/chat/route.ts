import { NextRequest, NextResponse } from "next/server";
import { streamText, createDataStreamResponse, formatDataStreamPart } from "ai";
import { chatRequestSchema } from "@/lib/validation/schemas";
import { sanitizeUserInput } from "@/lib/security/sanitize";
import { checkRateLimit } from "@/lib/security/rate-limit";
import {
  detectIntent,
  reformulateQuery,
  searchKnowledge,
  formatKnowledgeForPrompt,
  KnowledgeMatch,
} from "@/lib/rag";
import { SYSTEM_PROMPT_TEMPLATE, getAIModel } from "@/lib/ai";
import { createClient } from "@/lib/supabase/server";
import {
  ConversationProfile,
  INITIAL_PROFILE,
  heuristicUpdateProfile,
  mergeProfileUpdate,
} from "@/lib/profile";

export const maxDuration = 30; // 30 secondes max

export interface TechnicalOutput {
  reply: string;
  suggestions: string[];
  dossier: Partial<ConversationProfile>;
  indices: Array<{ texte: string; statut: "certain" | "probable" | "a_verifier" }>;
  hypotheses: Array<{ domaine: string; confiance: "faible" | "moyenne" | "forte" }>;
  prochaine_question_vise?: string;
  pistes: Array<{
    nom: string;
    etablissements: string[];
    duree: string;
    debouches: string;
    indice_retenu: string;
  }>;
  etablissements: string[];
  etape: number;
}

/**
 * Diffuse l'objet JSON strict au format data-stream attendu par useChat()
 */
function streamJsonResponse(
  payload: TechnicalOutput,
  updatedProfile: ConversationProfile,
  remainingRateLimit = 19
) {
  const jsonString = JSON.stringify(payload);
  return createDataStreamResponse({
    execute: async (dataStream) => {
      dataStream.writeMessageAnnotation({
        profile: updatedProfile,
        dossier: payload.dossier,
        indices: payload.indices,
        hypotheses: payload.hypotheses,
        prochaine_question_vise: payload.prochaine_question_vise,
        pistes: payload.pistes,
        etablissements: payload.etablissements,
        etape: payload.etape,
      } as any);
      const chunks = jsonString.split(" ");
      for (const chunk of chunks) {
        dataStream.write(formatDataStreamPart("text", chunk + " "));
        await new Promise((resolve) => setTimeout(resolve, 15));
      }
    },
    headers: {
      "X-RateLimit-Remaining": String(remainingRateLimit),
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    // 1. Rate limiting par adresse IP
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "127.0.0.1";

    const rateLimit = checkRateLimit(`chat_${ip}`, {
      limit: 20,
      windowMs: 60 * 1000,
    });

    if (!rateLimit.success) {
      return NextResponse.json(
        {
          error:
            "Trop de demandes envoyées. Veuillez patienter une minute avant de poser une nouvelle question.",
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateLimit.reset),
            "X-RateLimit-Limit": String(rateLimit.limit),
            "X-RateLimit-Remaining": "0",
          },
        }
      );
    }

    // 2. Validation Zod et extraction des données
    const body = await req.json().catch(() => null);
    const parsed = chatRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Requête invalide. Veuillez vérifier votre message." },
        { status: 400 }
      );
    }

    const { messages, conversationId } = parsed.data;
    const latestUserMessage = messages[messages.length - 1];

    if (!latestUserMessage || latestUserMessage.role !== "user") {
      return NextResponse.json(
        { error: "Le dernier message doit provenir de l'utilisateur." },
        { status: 400 }
      );
    }

    // 3. Assainissement anti-injection
    const sanitized = sanitizeUserInput(latestUserMessage.content);
    if (sanitized.isSuspicious) {
      // eslint-disable-next-line no-console
      console.warn(
        `[SÉCURITÉ] Tentative suspecte pour l'IP ${ip}:`,
        sanitized.warnings
      );
    }
    latestUserMessage.content = sanitized.cleanText;

    // ─────────────────────────────────────────────────────────────────────────
    // 1. GESTION PROGRESSIVE DU DOSSIER DE L'ENQUÊTEUR
    // ─────────────────────────────────────────────────────────────────────────
    const incomingProfile: ConversationProfile =
      (body?.profile && typeof body.profile === "object")
        ? body.profile
        : (body?.dossier && typeof body.dossier === "object")
        ? body.dossier
        : INITIAL_PROFILE;

    const previousHistory = messages.slice(0, -1);
    const updatedProfile = heuristicUpdateProfile(
      incomingProfile,
      previousHistory,
      sanitized.cleanText
    );

    // LOG OBLIGATOIRE : Dossier mis à jour
    // eslint-disable-next-line no-console
    console.log("[RAG Pipeline] Dossier de l'enquêteur :\n", JSON.stringify(updatedProfile, null, 2));

    // ─────────────────────────────────────────────────────────────────────────
    // 2. CAS PARTICULIER : CLIC SUR "AUTRE SÉRIE OU RÉORIENTATION" (Section 3)
    // ─────────────────────────────────────────────────────────────────────────
    const lowerClean = sanitized.cleanText.toLowerCase().trim();
    const isReorientationClick =
      lowerClean.includes("autre série") ||
      lowerClean.includes("réorientation") ||
      lowerClean.includes("reorientation");

    if (isReorientationClick) {
      // eslint-disable-next-line no-console
      console.log("[RAG Pipeline] Routage : Réorientation / Autre série -> réinitialisation série et enquête.");
      updatedProfile.serie = null;
      updatedProfile.niveau = "Réorientation";
      updatedProfile.hypotheses = [];
      updatedProfile.etape = 1;

      const payload: TechnicalOutput = {
        reply: "Pas de souci. Tu es en quelle série de Bac, ou tu as déjà commencé des études que tu veux changer ?",
        suggestions: [
          "Je suis en Terminale",
          "J'ai déjà mon Bac",
          "Je veux changer d'université",
          "Je ne sais pas",
        ],
        dossier: updatedProfile,
        indices: [{ texte: "Situation en cours de redéfinition", statut: "certain" }],
        hypotheses: [],
        prochaine_question_vise: "Clarifier la situation de départ (série ou niveau actuel)",
        pistes: [],
        etablissements: [],
        etape: 1,
      };
      return streamJsonResponse(payload, updatedProfile, rateLimit.remaining);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 3. ROUTAGE DES INTENTIONS SANS RECHERCHE DOCUMENTAIRE
    // ─────────────────────────────────────────────────────────────────────────
    const intent = detectIntent(sanitized.cleanText);

    // Détection si l'utilisateur vient de donner son nom / prénom
    const justGaveName =
      (!incomingProfile.prenom && Boolean(updatedProfile.prenom) && !updatedProfile.serie && !updatedProfile.niveau) ||
      (incomingProfile.prenom && !incomingProfile.serie && !updatedProfile.serie && !updatedProfile.niveau && intent !== "emotion" && intent !== "dont_know");

    if (justGaveName) {
      const displayName = updatedProfile.prenom && updatedProfile.prenom !== "l'ami" ? ` ${updatedProfile.prenom}` : "";
      // eslint-disable-next-line no-console
      console.log(`[RAG Pipeline] Prénom identifié : "${updatedProfile.prenom}" -> Demande de la série.`);
      const payload: TechnicalOutput = {
        reply: `Ravi de faire ta connaissance${displayName} ! Pour qu'on voie ensemble ce qui te correspond le mieux, dis-moi : quelle est ta série de Bac ou ta situation actuelle ?`,
        suggestions: [
          "Bac S1 ou S2",
          "Bac L1 ou L2",
          "Bac G ou STEG",
          "Autre série ou réorientation",
        ],
        dossier: updatedProfile,
        indices: updatedProfile.prenom && updatedProfile.prenom !== "l'ami" ? [{ texte: `Prénom : ${updatedProfile.prenom}`, statut: "certain" }] : [],
        hypotheses: [],
        prochaine_question_vise: "Connaître la série de Bac ou le niveau",
        pistes: [],
        etablissements: [],
        etape: 1,
      };
      return streamJsonResponse(payload, updatedProfile, rateLimit.remaining);
    }

    if (intent === "greeting") {
      // eslint-disable-next-line no-console
      console.log("[RAG Pipeline] Routage : Salutation détectée -> Accueil et demande du prénom.");
      if (!updatedProfile.prenom) {
        const payload: TechnicalOutput = {
          reply:
            "Bonjour ! Bienvenue sur SenOrientation. Pour commencer et faire connaissance, comment tu t'appelles ?",
          suggestions: [
            "Je préfère ne pas le dire",
          ],
          dossier: updatedProfile,
          indices: [],
          hypotheses: [],
          prochaine_question_vise: "Faire connaissance en demandant le prénom",
          pistes: [],
          etablissements: [],
          etape: 1,
        };
        return streamJsonResponse(payload, updatedProfile, rateLimit.remaining);
      } else {
        const displayName = updatedProfile.prenom !== "l'ami" ? ` ${updatedProfile.prenom}` : "";
        const payload: TechnicalOutput = {
          reply:
            `Ravi de te revoir${displayName} ! Pour qu'on avance ensemble, quelle est ta série de Bac ou ta situation actuelle ?`,
          suggestions: [
            "Bac S1 ou S2",
            "Bac L1 ou L2",
            "Bac G ou STEG",
            "Autre série ou réorientation",
          ],
          dossier: updatedProfile,
          indices: [],
          hypotheses: [],
          prochaine_question_vise: "Connaître la série de Bac ou le niveau",
          pistes: [],
          etablissements: [],
          etape: 1,
        };
        return streamJsonResponse(payload, updatedProfile, rateLimit.remaining);
      }
    }

    if (intent === "gratitude") {
      // eslint-disable-next-line no-console
      console.log("[RAG Pipeline] Routage : Remerciement détecté.");
      const payload: TechnicalOutput = {
        reply:
          "Je t'en prie ! Y a-t-il un autre point que tu aimerais approfondir ou explorer ensemble ?",
        suggestions: [
          "Voir les démarches Campusen",
          "Les bourses disponibles",
          "Affiner mes pistes",
          "Je ne sais pas",
        ],
        dossier: updatedProfile,
        indices: [],
        hypotheses: [],
        pistes: [],
        etablissements: [],
        etape: updatedProfile.etape,
      };
      return streamJsonResponse(payload, updatedProfile, rateLimit.remaining);
    }

    // Gestion du doute ou du stress (Section 2 : normaliser + 1 question facile + 0 liste d'écoles)
    if (intent === "emotion") {
      // eslint-disable-next-line no-console
      console.log("[RAG Pipeline] Routage : Doute / Stress détecté -> Recherche RAG ignorée (empathie détective & normalisation).");
      const isMath = lowerClean.includes("math");
      const reply = isMath
        ? "C'est très courant de bloquer sur les maths à ce stade, ne t'en fais pas. Beaucoup réussissent brillamment sans être des as du calcul. On va y aller doucement. Dans quelles autres matières te sens-tu le plus à l'aise ?"
        : "Pas de souci, beaucoup d'élèves se sentent comme ça avant de choisir. On va y aller pas à pas. Tu es plutôt à l'aise en calcul, en rédaction ou en travaux pratiques ?";

      const suggestions = isMath
        ? ["Français et rédaction", "Histoire et géo", "Langues vivantes", "Je ne sais pas"]
        : ["Plutôt en calcul", "Plutôt en rédaction", "Plutôt en travaux pratiques", "Je ne sais pas"];

      const payload: TechnicalOutput = {
        reply,
        suggestions,
        dossier: updatedProfile,
        indices: [{ texte: isMath ? "Difficulté ou appréhension avec les maths" : "Hésitation ou stress sur l'orientation", statut: "certain" }],
        hypotheses: [],
        prochaine_question_vise: "Identifier les matières ou activités où l'élève est en confiance",
        pistes: [],
        etablissements: [],
        etape: updatedProfile.etape,
      };
      return streamJsonResponse(payload, updatedProfile, rateLimit.remaining);
    }

    // Gestion du "je ne sais pas" (Section 2 : 3 exemples ou 3 choix concrets sans reformuler la même question)
    if (intent === "dont_know") {
      // eslint-disable-next-line no-console
      console.log("[RAG Pipeline] Routage : 'Je ne sais pas' détecté -> Recherche RAG ignorée (3 choix concrets).");
      const payload: TechnicalOutput = {
        reply:
          "C'est tout à fait normal d'hésiter. Pour qu'on avance pas à pas, quel univers te parle le plus naturellement au quotidien ?",
        suggestions: [
          "Comprendre comment les choses fonctionnent",
          "Aider et soigner les personnes",
          "Créer, dessiner ou argumenter",
          "Je ne sais pas",
        ],
        dossier: updatedProfile,
        indices: [{ texte: "Indécision sur le choix d'activité", statut: "a_verifier" }],
        hypotheses: [],
        prochaine_question_vise: "Départager entre technique, santé et lettres/création",
        pistes: [],
        etablissements: [],
        etape: updatedProfile.etape,
      };
      return streamJsonResponse(payload, updatedProfile, rateLimit.remaining);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 4. REFORMULATION CONTEXTUELLE DE LA REQUÊTE AVEC HISTORIQUE (10 max)
    // ─────────────────────────────────────────────────────────────────────────
    const recentMessages = messages.slice(-10);
    const historyBeforeCurrent = recentMessages.slice(0, -1);
    const reformulatedQuery = reformulateQuery(
      historyBeforeCurrent,
      sanitized.cleanText,
      updatedProfile
    );

    // LOG OBLIGATOIRE : Requête reformulée
    // eslint-disable-next-line no-console
    console.log(`[RAG Pipeline] Requête reformulée : "${reformulatedQuery}"`);

    // ─────────────────────────────────────────────────────────────────────────
    // 5. RECHERCHE VECTORIELLE AVEC SEUIL DE SIMILARITÉ MINIMAL (top-k 4 à 6)
    // ─────────────────────────────────────────────────────────────────────────
    const knowledgeMatches = await searchKnowledge(reformulatedQuery, 5, 0.28);

    // LOG OBLIGATOIRE : Passages récupérés avec scores
    // eslint-disable-next-line no-console
    console.log(
      `[RAG Pipeline] Passages récupérés (${knowledgeMatches.length}) :`,
      knowledgeMatches.map((k) => ({
        source: k.source,
        score: `${(k.similarity * 100).toFixed(1)}%`,
        apercu: k.content.slice(0, 80).replace(/\n/g, " ") + "...",
      }))
    );

    // ─────────────────────────────────────────────────────────────────────────
    // 6. INJECTION DANS LE PROMPT SYSTÈME ({date_du_jour}, {profil_json}, {extraits_recuperes})
    // ─────────────────────────────────────────────────────────────────────────
    const todayDate = new Date().toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    const formattedKnowledge = knowledgeMatches.length > 0
      ? formatKnowledgeForPrompt(knowledgeMatches)
      : "[CONTEXTE]\nAucun document spécifique au-dessus du seuil de pertinence.";

    const fullSystemPrompt = SYSTEM_PROMPT_TEMPLATE
      .replace("{date_du_jour}", todayDate)
      .replace("{profil_json}", JSON.stringify(updatedProfile, null, 2))
      .replace("{extraits_recuperes}", formattedKnowledge);

    // LOG OBLIGATOIRE : Prompt final
    // eslint-disable-next-line no-console
    console.log("[RAG Pipeline] Prompt final :\n", fullSystemPrompt);

    // Sauvegarde en base si session active
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user && conversationId) {
        await supabase.from("messages").insert({
          conversation_id: conversationId,
          role: "user",
          content: sanitized.cleanText,
        });
      }
    } catch {
      // Non bloquant
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 7. APPEL DU MODÈLE OU GÉNÉRATEUR LOCAL
    // ─────────────────────────────────────────────────────────────────────────
    const model = getAIModel();

    if (!model) {
      // Mode local respectant scrupuleusement le ton de détective et les règles d'or de la section 3
      const localPayload = generateLocalOrientationPayload(
        reformulatedQuery,
        knowledgeMatches,
        updatedProfile
      );
      return streamJsonResponse(localPayload, updatedProfile, rateLimit.remaining);
    }

    try {
      const result = streamText({
        model,
        system: fullSystemPrompt,
        messages: recentMessages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        maxTokens: 250,
        temperature: 0.3,
      });

      return createDataStreamResponse({
        execute: async (dataStream) => {
          dataStream.writeMessageAnnotation({
            profile: updatedProfile,
            etape: updatedProfile.etape,
          } as any);
          await result.mergeIntoDataStream(dataStream);
        },
        headers: {
          "X-RateLimit-Remaining": String(rateLimit.remaining),
        },
      });
    } catch {
      // Fallback local transparent si OpenAI renvoie une erreur
      const localPayload = generateLocalOrientationPayload(
        reformulatedQuery,
        knowledgeMatches,
        updatedProfile
      );
      return streamJsonResponse(localPayload, updatedProfile, rateLimit.remaining);
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[ERREUR API CHAT]", {
      timestamp: new Date().toISOString(),
      message: error instanceof Error ? error.message : "Erreur inconnue",
    });

    return NextResponse.json(
      {
        error:
          "Une erreur temporaire est survenue lors du traitement de votre demande. Veuillez réessayer.",
      },
      { status: 500 }
    );
  }
}

/**
 * Générateur local de l'Enquêteur respectant les règles d'or de la Section 3
 * (Ne conclut PAS sans série/niveau ET au moins 2 indices certains).
 */
function generateLocalOrientationPayload(
  query: string,
  knowledge: KnowledgeMatch[],
  profile: ConversationProfile
): TechnicalOutput {
  const hasSeries = Boolean(profile.serie || profile.niveau);

  // Décompte strict des indices réels déclarés par l'élève
  const realIndices: string[] = [];
  if (profile.matieres_aimees.length > 0) {
    realIndices.push(`tu m'as dit aimer ${profile.matieres_aimees.join(" et ")}`);
  }
  if (profile.points_forts.length > 0) {
    realIndices.push(`tu as mentionné ${profile.points_forts.join(" et ")}`);
  }
  if (profile.activites.length > 0) {
    realIndices.push(`tu passes du temps sur ${profile.activites.join(" et ")}`);
  }
  if (profile.environnement.length > 0) {
    realIndices.push(`tu te vois plutôt ${profile.environnement.join(" ou ")}`);
  }
  if (profile.projet) {
    realIndices.push(`tu as en tête ${profile.projet}`);
  }

  // ÉTAPE 0 : Si pas de prénom, demander d'abord le prénom/nom
  if (!profile.prenom) {
    return {
      reply:
        "Bonjour ! Bienvenue sur SenOrientation. Pour commencer et faire connaissance, comment tu t'appelles ?",
      suggestions: [
        "Je préfère ne pas le dire",
      ],
      dossier: profile,
      indices: [],
      hypotheses: [],
      prochaine_question_vise: "Connaître le prénom de l'élève pour faire connaissance",
      pistes: [],
      etablissements: [],
      etape: 1,
    };
  }

  // ÉTAPE 1 : Si prénom connu mais pas de série ni de niveau
  if (!hasSeries) {
    const displayName = profile.prenom && profile.prenom !== "l'ami" ? ` ${profile.prenom}` : "";
    return {
      reply:
        `Ravi de faire ta connaissance${displayName} ! Pour qu'on voie ensemble ce qui te correspond le mieux, dis-moi : quelle est ta série de Bac ou ta situation actuelle ?`,
      suggestions: [
        "Bac S1 ou S2",
        "Bac L1 ou L2",
        "Bac G ou STEG",
        "Autre série ou réorientation",
      ],
      dossier: profile,
      indices: profile.prenom && profile.prenom !== "l'ami" ? [{ texte: `Prénom : ${profile.prenom}`, statut: "certain" }] : [],
      hypotheses: [],
      prochaine_question_vise: "Connaître la série de Bac ou le niveau",
      pistes: [],
      etablissements: [],
      etape: 1,
    };
  }

  // ÉTAPE 2 : Si la série est connue mais MOINS de deux indices certains (Section 3 : règle d'or)
  if (realIndices.length < 2) {
    const displayName = profile.prenom && profile.prenom !== "l'ami" ? ` ${profile.prenom}` : "";
    return {
      reply: `Intéressant${displayName}. Ta série ${profile.serie || ""} est un bon point de départ, mais il me faut encore un ou deux éléments pour cerner ce qui te correspond vraiment. Quelles matières te donnent envie d'ouvrir ton cahier, et lesquelles tu fuis ?`,
      suggestions: [
        "J'aime le calcul et la logique",
        "Je préfère les SVT et la santé",
        "J'aime écrire et argumenter",
        "Je ne sais pas",
      ],
      dossier: profile,
      indices: [{ texte: `Série ${profile.serie || "déclarée"}`, statut: "certain" }],
      hypotheses: [],
      prochaine_question_vise: "Découvrir les matières aimées ou fuies",
      pistes: [],
      etablissements: [],
      etape: 2,
    };
  }

  // ÉTAPE 3 : RÈGLES DE LA SECTION 3 REMPLIES -> LE VERDICT ET LES PISTES
  const isScientifique = profile.serie?.startsWith("S") || profile.matieres_aimees.includes("Mathématiques");
  const citedIndices = realIndices.join(", ");
  const namePrefix = profile.prenom && profile.prenom !== "l'ami" ? `${profile.prenom}, avec` : "Avec";

  if (isScientifique) {
    return {
      reply: `${namePrefix} tes indices (${citedIndices}), je penche pour l'informatique ou les mathématiques appliquées. Dis-moi si je me trompe.

**Génie logiciel, ESP Dakar**
- Durée : 5 ans (concours)
- Débouchés : développeur, ingénieur IA
- Indice retenu : ${realIndices[0] || "tu as choisi une filière scientifique"}

**Informatique et mathématiques, UGB Saint-Louis**
- Durée : 3 à 5 ans (Campusen)
- Débouchés : data analyst, administrateur systèmes
- Indice retenu : ${realIndices[1] || realIndices[0] || "ton intérêt pour les sciences"}

Laquelle t'attire, ou tu veux que j'affine ?`,
      suggestions: [
        "Génie logiciel à l'ESP",
        "Mathématiques à l'UGB",
        "Je veux que tu affines",
        "Je ne sais pas",
      ],
      dossier: profile,
      indices: [
        { texte: `Série ${profile.serie}`, statut: "certain" },
        { texte: profile.matieres_aimees.join(", ") || "Goût scientifique", statut: "certain" },
      ],
      hypotheses: [
        { domaine: "Informatique & Data", confiance: "forte" },
        { domaine: "Mathématiques appliquées", confiance: "moyenne" },
      ],
      prochaine_question_vise: "Départager entre développement logiciel (ESP) et modélisation/data (UGB)",
      pistes: [
        {
          nom: "Génie logiciel",
          etablissements: ["esp"],
          duree: "5 ans",
          debouches: "développeur, ingénieur IA",
          indice_retenu: realIndices[0] || "profil scientifique",
        },
        {
          nom: "Informatique et mathématiques",
          etablissements: ["ugb"],
          duree: "3 à 5 ans",
          debouches: "data analyst, administrateur systèmes",
          indice_retenu: realIndices[1] || realIndices[0] || "intérêt pour le calcul",
        },
      ],
      etablissements: ["esp", "ugb"],
      etape: 3,
    };
  }

  // Littéraire ou Gestion
  return {
    reply: `${namePrefix} tes indices (${citedIndices}), je penche pour les carrières juridiques ou le management. Dis-moi si je me trompe.

**Droit et sciences politiques, FSJP UCAD**
- Durée : 3 à 5 ans (Campusen)
- Débouchés : juriste d'entreprise, avocat, magistrat
- Indice retenu : ${realIndices[0] || "ton profil de filière"}

**Gestion et finance, FASEG UCAD ou CESAG**
- Durée : 3 ans (Licence)
- Débouchés : gestionnaire, auditeur, analyste financier
- Indice retenu : ${realIndices[1] || realIndices[0] || "tes priorités déclarées"}

Laquelle t'attire, ou tu veux que j'affine ?`,
    suggestions: [
      "Droit à l'UCAD",
      "Gestion au CESAG",
      "Je veux que tu affines",
      "Je ne sais pas",
    ],
    dossier: profile,
    indices: [
      { texte: `Série ${profile.serie}`, statut: "certain" },
      { texte: profile.matieres_aimees.join(", ") || "Intérêts déclarés", statut: "certain" },
    ],
    hypotheses: [
      { domaine: "Droit & Justice", confiance: "forte" },
      { domaine: "Gestion & Finance", confiance: "moyenne" },
    ],
    prochaine_question_vise: "Départager entre carrières juridiques et gestion d'entreprise",
    pistes: [
      {
        nom: "Droit et sciences politiques",
        etablissements: ["ucad"],
        duree: "3 à 5 ans",
        debouches: "juriste d'entreprise, avocat",
        indice_retenu: realIndices[0] || "intérêt déclaré",
      },
    ],
    etablissements: ["ucad", "cesag"],
    etape: 3,
  };
}
