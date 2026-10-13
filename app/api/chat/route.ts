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
  findMatchingFormations,
} from "@/lib/rag";
import { SYSTEM_PROMPT_TEMPLATE, getAIModel } from "@/lib/ai";
import { createClient } from "@/lib/supabase/server";
import {
  ConversationProfile,
  INITIAL_PROFILE,
  heuristicUpdateProfile,
  mergeProfileUpdate,
  getNextOrientationQuestion,
  SERIES_SENEGAL,
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
      console.log(`[RAG Pipeline] Prénom identifié : "${updatedProfile.prenom}" -> Demande de la situation.`);
      const payload: TechnicalOutput = {
        reply: `Ravi de faire ta connaissance${displayName} ! Pour qu'on voie ensemble ce qui te correspond le mieux, dis-moi : où en es-tu actuellement dans tes études et quelle est ta situation ?`,
        suggestions: [
          "Collège (3e / BFEM)",
          "Lycée (Seconde ou 1ère)",
          "Terminale ou Nouveau bachelier",
          "Étudiant ou Réorientation",
        ],
        dossier: updatedProfile,
        indices: updatedProfile.prenom && updatedProfile.prenom !== "l'ami" ? [{ texte: `Prénom : ${updatedProfile.prenom}`, statut: "certain" }] : [],
        hypotheses: [],
        prochaine_question_vise: "Connaître le niveau scolaire (avant-bac, bac ou post-bac)",
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
            `Ravi de te revoir${displayName} ! Pour qu'on avance ensemble, où en es-tu actuellement dans tes études ?`,
          suggestions: [
            "Collège (3e / BFEM)",
            "Lycée (Seconde ou 1ère)",
            "Terminale ou Nouveau bachelier",
            "Étudiant ou Réorientation",
          ],
          dossier: updatedProfile,
          indices: [],
          hypotheses: [],
          prochaine_question_vise: "Connaître le niveau scolaire (avant-bac, bac ou post-bac)",
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
        maxTokens: 800,
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
 * Générateur local adaptatif respectant scrupuleusement la méthode SenOrientation
 * (Une question principale par message, ou Bilan Final structuré avec données officielles).
 */
function generateLocalOrientationPayload(
  query: string,
  knowledge: KnowledgeMatch[],
  profile: ConversationProfile
): TechnicalOutput {
  const lowerQuery = query.toLowerCase().trim();

  // 1. CAS D'UNE DEMANDE DIRECTE FACTUELLE (Partie 5 & Test 12)
  const isDirectRequest =
    lowerQuery.includes("quelles universités") ||
    lowerQuery.includes("quelles sont les universités") ||
    lowerQuery.includes("quelles écoles") ||
    lowerQuery.includes("où peut-on étudier") ||
    lowerQuery.includes("conditions du concours") ||
    lowerQuery.includes("conditions d'accès") ||
    lowerQuery.includes("concours ept") ||
    lowerQuery.includes("concours esp") ||
    lowerQuery.includes("frais de scolarité") ||
    lowerQuery.includes("comment devenir");

  if (isDirectRequest) {
    if (!knowledge || knowledge.length === 0) {
      // Test 8 : Information inexistante dans les données officielles
      return {
        reply: "Je ne dispose pas d'informations officielles documentées à ce sujet dans mes bases actuelles. Les formations et parcours accrédités au Sénégal sont recensés sur la plateforme officielle Campusen (campusen.sec.gouv.sn). Souhaites-tu explorer les filières disponibles dans un autre domaine ?",
        suggestions: [
          "Explorer les filières scientifiques",
          "Voir les formations en gestion",
          "Consulter les démarches Campusen",
          "Je ne sais pas",
        ],
        dossier: profile,
        indices: [],
        hypotheses: [],
        prochaine_question_vise: "Signaler l'absence de donnée et proposer une alternative",
        pistes: [],
        etablissements: [],
        etape: profile.etape,
      };
    }

    const topDoc = knowledge[0];
    const reply = `Voici les informations officielles documentées dans mes bases :\n\n${topDoc.content}\n\nSouhaites-tu vérifier si ce parcours correspond à ton profil et à ta série de Bac ?`;

    return {
      reply,
      suggestions: [
        "Vérifier mon profil pour ce parcours",
        "Voir les autres établissements",
        "Conditions de bourse DGES",
        "Je ne sais pas",
      ],
      dossier: profile,
      indices: [{ texte: `Recherche : ${query.slice(0, 50)}`, statut: "certain" }],
      hypotheses: [],
      prochaine_question_vise: "Répondre directement à la question factuelle puis proposer la suite",
      pistes: [],
      etablissements: [],
      etape: profile.etape,
    };
  }

  // 2. Consultation du moteur de décision adaptatif (Parties 3, 4, 5)
  const decision = getNextOrientationQuestion(profile);

  if (!profile.questions_asked.includes(decision.intent_id)) {
    profile.questions_asked.push(decision.intent_id);
  }
  profile.current_question_id = decision.intent_id;

  if (decision.type === "question") {
    return {
      reply: decision.question,
      suggestions: decision.suggestions,
      dossier: profile,
      indices: profile.serie ? [{ texte: `Série ${profile.serie}`, statut: "certain" }] : [],
      hypotheses: (profile.confirmed_interests.length > 0 ? profile.confirmed_interests : profile.interets_principaux).map((dom) => ({ domaine: dom, confiance: "moyenne" as const })),
      prochaine_question_vise: decision.vise,
      pistes: [],
      etablissements: [],
      etape: decision.etape,
    };
  }

  // 3. Si prêt pour le Bilan Final (Étape 5 / Phase 8)
  const matched = findMatchingFormations(profile);
  const displayName = profile.prenom && profile.prenom !== "l'ami" ? `${profile.prenom}` : "Élève";

  const domainesRec = profile.confirmed_interests.length > 0
    ? profile.confirmed_interests.slice(0, 3)
    : profile.interets_principaux.length > 0
      ? profile.interets_principaux.slice(0, 3)
      : ["Sciences & Technologies", "Gestion & Économie"];

  let reply = "";

  if (profile.statut_parcours === "avant_bac") {
    // BILAN SPÉCIFIQUE AVANT LE BAC (Séries du Bac au Sénégal & Métiers d'avenir)
    const seriesMatching = SERIES_SENEGAL.filter((s) =>
      domainesRec.some((d) => s.domaines.some((sd) => sd.toLowerCase().includes(d.toLowerCase()) || d.toLowerCase().includes(sd.toLowerCase())))
    ).slice(0, 2);

    const seriesRetenues = seriesMatching.length > 0 ? seriesMatching : SERIES_SENEGAL.slice(0, 2);
    const metiersList = Array.from(new Set(seriesRetenues.flatMap((s) => s.metiers_cibles))).slice(0, 5);

    reply = `**A. Résumé de ton profil**
- Élève : ${displayName}
- Niveau actuel : ${profile.niveau || "Collège / Lycée"}
- Centres d'intérêt confirmés : ${domainesRec.join(", ")}
- Points forts & aptitudes : ${profile.points_forts.join(", ") || profile.matieres_aimees.join(", ") || "Calcul, réflexion et esprit pratique"}

**B. Séries de Baccalauréat recommandées au Sénégal**
${seriesRetenues.map((s) => `- **${s.nom}** : ${s.description}\n  - Matières déterminantes au lycée : ${s.matieres_cles.join(", ")}`).join("\n\n")}

**C. Familles de métiers d'avenir accessibles**
${metiersList.map((m) => `- **${m}**`).join("\n")}

**D. Conseils pour réussir ton passage au lycée**
- Consolide tes moyennes dans les matières déterminantes dès maintenant.
- Les séries scientifiques (S1, S2) et techniques (T1, T2, G) ouvrent vers les écoles d'ingénieurs, la médecine et la gestion.
- Les séries littéraires (L1, L2, L') valorisent le droit, les sciences politiques, la communication et les métiers de la justice.

**E. Question de suivi**
${decision.question}`;

    return {
      reply,
      suggestions: decision.suggestions,
      dossier: profile,
      indices: [
        { texte: `Niveau : ${profile.niveau || "Avant-bac"}`, statut: "certain" },
        { texte: `Séries cibles : ${seriesRetenues.map((s) => s.code).join(", ")}`, statut: "certain" },
      ],
      hypotheses: seriesRetenues.map((s) => ({ domaine: s.nom, confiance: "forte" as const })),
      prochaine_question_vise: "Présenter les séries de bac recommandées et les métiers cibles",
      pistes: seriesRetenues.map((s) => ({
        nom: s.nom,
        etablissements: ["Lycées d'enseignement général et technique du Sénégal"],
        duree: "3 ans de lycée (Seconde, Première, Terminale)",
        debouches: s.metiers_cibles.join(", "),
        indice_retenu: s.description,
      })),
      etablissements: ["Lycées d'enseignement général et technique du Sénégal"],
      etape: 5,
    };
  } else if (profile.statut_parcours === "post_bac") {
    // BILAN SPÉCIFIQUE POST-BAC (Réorientation après L1 difficile ou passerelles professionnelles)
    const isReorientation = profile.type_post_bac === "reorientation";
    const formationsListMarkdown = matched.slice(0, 3).map((m) => {
      return `- **${m.nom}, ${m.etablissement}**
  - Diplôme & Format : ${m.diplome} (${m.duree})
  - Modalités d'admission : ${m.conditions}
  - Atout pour ton projet : ${m.pourquoi}
  - Débouchés : ${m.debouches.slice(0, 3).join(", ")}`;
    }).join("\n\n");

    reply = `**A. Résumé de ta situation universitaire**
- Étudiant : ${displayName}
- Statut actuel : ${profile.niveau || "Université"} (${isReorientation ? "Projet de réorientation" : "Poursuite d'études / passerelle"})
- Nouveaux domaines prioritaires : ${domainesRec.join(", ")}
- Aptitudes valorisées : ${profile.points_forts.join(", ") || profile.matieres_aimees.join(", ") || "Compétences appliquées"}

**B. Diagnostic et nouveau cap**
${isReorientation
  ? "- Une réorientation après une première année universitaire est une opportunité constructive pour se diriger vers un parcours plus professionnalisant ou aligné avec tes talents."
  : "- Une poursuite d'études ciblée permet de capitaliser sur ton premier diplôme en visant une spécialisation à forte valeur ajoutée sur le marché du travail sénégalais."}

**C. Formations, filières et passerelles adaptées (Sénégal)**
${formationsListMarkdown}

**D. Modalités de réorientation et démarches administratives**
- Dossier de réorientation / transfert interne ou externe auprès de la scolarité de l'UFR / université.
- Validation d'acquis ou équivalence des crédits (ECTS) déjà validés.
- Possibilité de candidater aux filières courtes professionnalisantes (Licence pro, BTS/DUT) pour une insertion accélérée.

**E. Question de suivi**
${decision.question}`;

    return {
      reply,
      suggestions: decision.suggestions,
      dossier: profile,
      indices: [
        { texte: `Statut universitaire : ${profile.niveau || "Post-bac"}`, statut: "certain" },
        { texte: `Domaines cibles : ${domainesRec.join(", ")}`, statut: "certain" },
      ],
      hypotheses: domainesRec.map((dom) => ({ domaine: dom, confiance: "forte" as const })),
      prochaine_question_vise: "Guider la réorientation universitaire ou la passerelle",
      pistes: matched.slice(0, 3).map((m) => ({
        nom: m.nom,
        etablissements: m.etablissements,
        duree: m.duree,
        debouches: m.debouches.join(", "),
        indice_retenu: m.pourquoi,
      })),
      etablissements: matched.map((m) => m.etablissement),
      etape: 5,
    };
  }

  // BILAN STANDARD POUR BACCALAURÉAT (Terminale / Nouveaux bacheliers)
  const formationsListMarkdown = matched.map((m) => {
    return `- **${m.nom}, ${m.etablissement}**
  - Diplôme & Durée : ${m.diplome} (${m.duree})
  - Conditions d'accès : ${m.conditions}
  - Pourquoi pour toi : ${m.pourquoi}
  - Source officielle : ${m.source}`;
  }).join("\n\n");

  reply = `**A. Résumé de ton profil**
- Élève : ${displayName}
- Série / Niveau : ${profile.serie ? `Bac ${profile.serie}` : (profile.niveau || "Enseignement secondaire")}
- Domaines d'intérêt confirmés : ${domainesRec.join(", ")}
- Points forts déclarés : ${profile.points_forts.join(", ") || profile.matieres_competentes.join(", ") || profile.matieres_aimees.join(", ") || "Aptitudes scientifiques et analytiques"}
- Format souhaité : ${profile.preferences_etudes || "Études supérieures au Sénégal"}

**B. Domaines recommandés**
${domainesRec.map((d) => `- **${d}** : en adéquation avec tes centres d'intérêt confirmés et tes compétences déclarées.`).join("\n")}

**C. Formations adaptées (données officielles du Sénégal)**
${formationsListMarkdown}

**D. Comparaison & Alternatives**
- Les cursus universitaires à l'UCAD, l'UGB ou l'UIDT mènent aux diplômes longs (Licence, Master, Ingénieur).
- Si tu préfères une insertion rapide sur le marché de l'emploi, les cycles courts (DUT à l'ESP, BTS ou Licence professionnelle) offrent d'excellentes opportunités professionnalisantes.

**E. Démarches et plan d'action officiel**
- Orientation Campusen : inscription obligatoire sur campusen.sec.gouv.sn dès les résultats du Bac (droits d'inscription fixés à 25 000 FCFA/an).
- Bourses nationales DGES : dépôt de demande (demi-bourse de 20 000 FCFA/mois ou bourse entière de 40 000 FCFA/mois).
- Écoles d'excellence sur concours (ESP, EPT, CESTI, EMS) : dépôts de dossiers entre mai et juillet.

**F. Question de suivi**
${decision.question}`;

  return {
    reply,
    suggestions: decision.suggestions,
    dossier: profile,
    indices: [
      { texte: `Série ${profile.serie || "validée"}`, statut: "certain" },
      { texte: domainesRec.join(", ") || "Intérêts confirmés", statut: "certain" },
    ],
    hypotheses: domainesRec.map((dom) => ({ domaine: dom, confiance: "forte" as const })),
    prochaine_question_vise: "Présenter le bilan final et orienter vers les démarches officielles",
    pistes: matched.map((m) => ({
      nom: m.nom,
      etablissements: m.etablissements,
      duree: m.duree,
      debouches: m.debouches.join(", "),
      indice_retenu: m.pourquoi,
    })),
    etablissements: matched.map((m) => m.etablissement),
    etape: 5,
  };
}
