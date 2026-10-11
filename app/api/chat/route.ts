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
  profil_update: Partial<ConversationProfile>;
  hypotheses: string[];
  pistes: Array<{
    nom: string;
    etablissements: string[];
    duree: string;
    debouches: string;
    pourquoi: string;
  }>;
  etablissements: string[];
  etape: number;
}

/**
 * Diffuse un objet JSON strict au format data-stream attendu par useChat()
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
        etape: payload.etape,
        pistes: payload.pistes,
        hypotheses: payload.hypotheses,
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
    // 1. GESTION PROGRESSIVE DU PROFIL
    // ─────────────────────────────────────────────────────────────────────────
    const incomingProfile: ConversationProfile =
      (body?.profile && typeof body.profile === "object")
        ? body.profile
        : INITIAL_PROFILE;

    const previousHistory = messages.slice(0, -1);
    const updatedProfile = heuristicUpdateProfile(
      incomingProfile,
      previousHistory,
      sanitized.cleanText
    );

    // LOG OBLIGATOIRE : Profil mis à jour
    // eslint-disable-next-line no-console
    console.log("[RAG Pipeline] Profil mis à jour :\n", JSON.stringify(updatedProfile, null, 2));

    // ─────────────────────────────────────────────────────────────────────────
    // 2. ROUTAGE DES INTENTIONS SANS RECHERCHE DOCUMENTAIRE
    // ─────────────────────────────────────────────────────────────────────────
    const intent = detectIntent(sanitized.cleanText);

    if (intent === "greeting") {
      // eslint-disable-next-line no-console
      console.log("[RAG Pipeline] Routage : Salutation détectée -> Recherche RAG ignorée.");
      const payload: TechnicalOutput = {
        reply:
          "Salut ! Bienvenue sur SenOrientation. Pour qu'on voie ensemble ce qui te correspond le mieux, dis-moi : quelle est ta série de Bac ou ta situation actuelle ?",
        suggestions: [
          "Bac S1 ou S2",
          "Bac L1 ou L2",
          "Bac G ou STEG",
          "Autre série ou réorientation",
        ],
        profil_update: { serie: updatedProfile.serie || undefined },
        hypotheses: [],
        pistes: [],
        etablissements: [],
        etape: 1,
      };
      return streamJsonResponse(payload, updatedProfile, rateLimit.remaining);
    }

    if (intent === "gratitude") {
      // eslint-disable-next-line no-console
      console.log("[RAG Pipeline] Routage : Remerciement détecté -> Recherche RAG ignorée.");
      const payload: TechnicalOutput = {
        reply:
          "Je t'en prie ! N'hésite pas si tu as d'autres doutes ou si tu souhaites affiner un choix de filière. Quelle est ta prochaine question ?",
        suggestions: [
          "Voir les démarches Campusen",
          "Les bourses disponibles",
          "Affiner mes pistes",
          "Je ne sais pas",
        ],
        profil_update: {},
        hypotheses: [],
        pistes: [],
        etablissements: [],
        etape: updatedProfile.etape,
      };
      return streamJsonResponse(payload, updatedProfile, rateLimit.remaining);
    }

    // Gestion du doute ou du stress (sans liste de filières, ton grand frère/grande sœur)
    if (intent === "emotion") {
      // eslint-disable-next-line no-console
      console.log("[RAG Pipeline] Routage : Doute / Stress détecté -> Recherche RAG ignorée (empathie & question simple).");
      const isMath = sanitized.cleanText.toLowerCase().includes("math");
      const reply = isMath
        ? "C'est très courant de bloquer sur les maths à ce stade, ne t'en fais pas. Beaucoup réussissent brillamment sans être des as du calcul. On va y aller doucement. Dans quelles autres matières te sens-tu le plus à l'aise ?"
        : "Pas de souci, beaucoup d'élèves se sentent comme ça avant de choisir. On va y aller pas à pas. Tu es plutôt à l'aise en calcul, en rédaction ou en travaux pratiques ?";

      const suggestions = isMath
        ? ["Français et rédaction", "Histoire et géo", "Langues vivantes", "Je ne sais pas"]
        : ["Plutôt en calcul", "Plutôt en rédaction", "Plutôt en travaux pratiques", "Je ne sais pas"];

      const payload: TechnicalOutput = {
        reply,
        suggestions,
        profil_update: { freins: ["Stress / Doute sur son orientation"] },
        hypotheses: [],
        pistes: [],
        etablissements: [],
        etape: updatedProfile.etape,
      };
      return streamJsonResponse(payload, updatedProfile, rateLimit.remaining);
    }

    // Gestion du "je ne sais pas" (3 choix concrets sans reformuler la même question)
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
        profil_update: {},
        hypotheses: [],
        pistes: [],
        etablissements: [],
        etape: updatedProfile.etape,
      };
      return streamJsonResponse(payload, updatedProfile, rateLimit.remaining);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 3. REFORMULATION CONTEXTUELLE DE LA REQUÊTE AVEC HISTORIQUE (10 max)
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
    // 4. RECHERCHE VECTORIELLE AVEC SEUIL DE SIMILARITÉ MINIMAL (top-k 4 à 6)
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
    // 5. INJECTION DANS LE PROMPT SYSTÈME ({date_du_jour}, {profil_json}, {extraits_recuperes})
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
    // 6. APPEL DU MODÈLE OU GÉNÉRATEUR LOCAL
    // ─────────────────────────────────────────────────────────────────────────
    const model = getAIModel();

    if (!model) {
      // Mode local de secours respectant scrupuleusement le ton et le JSON strict
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
 * Générateur local respectant le ton de grand frère/sœur sans emojis,
 * les étapes 1 à 5 et le format technique JSON strict.
 */
function generateLocalOrientationPayload(
  query: string,
  knowledge: KnowledgeMatch[],
  profile: ConversationProfile
): TechnicalOutput {
  const etape = profile.etape || 1;

  if (etape <= 1) {
    return {
      reply:
        "Salut ! Bienvenue sur SenOrientation. Pour qu'on voie ensemble ce qui te correspond le mieux, dis-moi : quelle est ta série de Bac ou ta situation actuelle ?",
      suggestions: [
        "Bac S1 ou S2",
        "Bac L1 ou L2",
        "Bac G ou STEG",
        "Autre série ou réorientation",
      ],
      profil_update: { serie: profile.serie || undefined },
      hypotheses: [],
      pistes: [],
      etablissements: [],
      etape: 1,
    };
  }

  if (etape === 2) {
    return {
      reply:
        "C'est bien noté. Pour mieux cerner ce qui te motive, dis-moi : quelles matières te donnent envie d'ouvrir ton cahier, et lesquelles tu fuis ?",
      suggestions: [
        "J'aime les maths et la logique",
        "Je préfère les SVT et la santé",
        "J'aime argumenter et écrire",
        "Je ne sais pas",
      ],
      profil_update: {
        matieres_aimees: profile.matieres_aimees,
        points_forts: profile.points_forts,
      },
      hypotheses: [],
      pistes: [],
      etablissements: [],
      etape: 2,
    };
  }

  if (etape === 3) {
    const isScientifique = profile.serie?.startsWith("S") || profile.matieres_aimees.includes("Mathématiques");

    if (isScientifique) {
      return {
        reply: `Pour l'instant je te vois plutôt vers les sciences de l'ingénieur ou les mathématiques appliquées. Dis-moi si je me trompe.

**Génie logiciel, ESP Dakar**
- Durée : 5 ans (concours DUT ou DIC)
- Débouchés : développeur, ingénieur en intelligence artificielle
- Pourquoi toi : tu as une logique scientifique et le goût de la technique

**Informatique et mathématiques, UGB Saint-Louis**
- Durée : 3 à 5 ans (Campusen)
- Débouchés : data analyst, administrateur systèmes, actuaire
- Pourquoi toi : tu aimes résoudre des problèmes de calcul

Laquelle t'attire le plus, ou tu veux que j'affine ?`,
        suggestions: [
          "Génie logiciel à l'ESP",
          "Mathématiques à l'UGB",
          "Je veux que tu affines",
          "Je ne sais pas",
        ],
        profil_update: {
          serie: profile.serie,
          matieres_aimees: profile.matieres_aimees,
        },
        hypotheses: ["Génie logiciel", "Mathématiques appliquées"],
        pistes: [
          {
            nom: "Génie logiciel",
            etablissements: ["esp"],
            duree: "5 ans",
            debouches: "développeur, ingénieur IA",
            pourquoi: "logique scientifique et goût de la technique",
          },
          {
            nom: "Informatique et mathématiques",
            etablissements: ["ugb"],
            duree: "3 à 5 ans",
            debouches: "data analyst, administrateur systèmes",
            pourquoi: "goût pour le calcul et la modélisation",
          },
        ],
        etablissements: ["esp", "ugb"],
        etape: 3,
      };
    }

    return {
      reply: `Pour l'instant je te vois plutôt vers les sciences juridiques ou le management d'entreprise. Dis-moi si je me trompe.

**Droit et sciences politiques, FSJP UCAD**
- Durée : 3 à 5 ans (Campusen)
- Débouchés : juriste d'entreprise, avocat, magistrat
- Pourquoi toi : tu aimes argumenter et débattre

**Gestion et finance, FASEG UCAD ou CESAG**
- Durée : 3 ans (Licence)
- Débouchés : gestionnaire, auditeur, analyste financier
- Pourquoi toi : tu as le sens de l'organisation et de l'analyse

Laquelle t'attire le plus, ou tu veux que j'affine ?`,
      suggestions: [
        "Droit à l'UCAD",
        "Gestion au CESAG",
        "Je veux que tu affines",
        "Je ne sais pas",
      ],
      profil_update: { serie: profile.serie },
      hypotheses: ["Droit", "Gestion d'entreprise"],
      pistes: [
        {
          nom: "Droit et sciences politiques",
          etablissements: ["ucad"],
          duree: "3 à 5 ans",
          debouches: "juriste d'entreprise, avocat",
          pourquoi: "goût pour l'argumentation et les textes",
        },
      ],
      etablissements: ["ucad", "cesag"],
      etape: 3,
    };
  }

  if (etape === 4) {
    return {
      reply: `Dans les universités publiques comme l'UCAD ou l'UGB, l'accès se fait via Campusen avec des droits d'inscription nationaux fixés à 25 000 FCFA par an. Tu es également éligible aux bourses de l'État sénégalais (DGES), qui sont de 20 000 FCFA par mois en demi-bourse et 40 000 FCFA par mois en bourse entière.

Tu souhaites approfondir les concours d'entrée, ou passer aux démarches concrètes sur Campusen ?`,
      suggestions: [
        "Voir les concours d'entrée",
        "Les démarches Campusen",
        "Établir mon plan d'action",
        "Je ne sais pas",
      ],
      profil_update: { budget: profile.budget || "Public Campusen" },
      hypotheses: ["Approfondissement de la filière choisie"],
      pistes: [],
      etablissements: ["ucad", "ugb"],
      etape: 4,
    };
  }

  // Étape 5 : Plan d'action
  return {
    reply: `Voici ton plan d'action en 4 points pour sécuriser ton orientation :

1. Crée ton compte Campusen dès la publication des résultats du Bac avec ton numéro de table et ta date de naissance.
2. Classe tes choix en mettant en premier les filières sélectives, suivies de filières de repli solides.
3. Prépare tes dossiers de concours entre mai et juillet si tu vises des écoles comme l'ESP ou l'ENSAE.
4. Dès validation de ta proposition d'orientation, règle les 25 000 FCFA par mobile money sous 7 à 10 jours sous peine de forclusion.

Tu veux qu'on revoie un point précis ?`,
    suggestions: [
      "Exporter mon récapitulatif",
      "Détail des concours",
      "Nouvelle discussion",
    ],
    profil_update: { etape: 5 },
    hypotheses: ["Plan d'action validé"],
    pistes: [],
    etablissements: ["campusen"],
    etape: 5,
  };
}
