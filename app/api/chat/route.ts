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
  updateConversationProfile,
} from "@/lib/profile";

export const maxDuration = 30; // 30 secondes max

/**
 * Diffuse un objet JSON strict au format data-stream attendu par useChat()
 */
function streamJsonResponse(
  payload: { reply: string; suggestions: string[]; profile?: ConversationProfile },
  remainingRateLimit = 19
) {
  const jsonString = JSON.stringify(payload);
  return createDataStreamResponse({
    execute: async (dataStream) => {
      if (payload.profile) {
        dataStream.writeMessageAnnotation({ profile: payload.profile } as any);
      }
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
      limit: 20, // 20 messages par minute max
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
    // 1. GESTION DU PROFIL PROGRESSIF (ÉTAPES 1 À 5)
    // ─────────────────────────────────────────────────────────────────────────
    const incomingProfile: ConversationProfile =
      (body?.profile && typeof body.profile === "object")
        ? body.profile
        : INITIAL_PROFILE;

    const previousHistory = messages.slice(0, -1);
    const updatedProfile = await updateConversationProfile(
      incomingProfile,
      previousHistory,
      sanitized.cleanText
    );

    // LOG OBLIGATOIRE : Profil mis à jour
    // eslint-disable-next-line no-console
    console.log("[RAG Pipeline] Profil mis à jour :\n", JSON.stringify(updatedProfile, null, 2));

    // ─────────────────────────────────────────────────────────────────────────
    // 2. ROUTAGE DES INTENTIONS (Salutations / Remerciements)
    // N'appelle pas la recherche documentaire pour les simples salutations
    // ─────────────────────────────────────────────────────────────────────────
    const intent = detectIntent(sanitized.cleanText);

    if (intent === "greeting") {
      // eslint-disable-next-line no-console
      console.log("[RAG Pipeline] Routage : Salutation détectée -> Recherche RAG ignorée.");
      return streamJsonResponse(
        {
          reply:
            "Bonjour ! Je suis SenOrientation, ton conseiller d'orientation scolaire et universitaire au Sénégal. Pour t'aider à choisir tes études supérieures, quelle est ta série de Baccalauréat ?",
          suggestions: [
            "Bac S1 / S2 (Scientifique)",
            "Bac L1 / L2 (Littéraire)",
            "Bac G / STEG (Gestion)",
            "Bac Technique (T1/T2)",
          ],
          profile: updatedProfile,
        },
        rateLimit.remaining
      );
    }

    if (intent === "gratitude") {
      // eslint-disable-next-line no-console
      console.log("[RAG Pipeline] Routage : Remerciement détecté -> Recherche RAG ignorée.");
      return streamJsonResponse(
        {
          reply:
            "Je t'en prie ! N'hésite pas si tu as d'autres questions sur tes choix de filières, les universités publiques via Campusen, les bourses DGES ou les concours.",
          suggestions: [
            "Voir les universités publiques",
            "Comment fonctionne Campusen ?",
            "Quelles sont les bourses de l'État ?",
          ],
          profile: updatedProfile,
        },
        rateLimit.remaining
      );
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

    // Si aucun passage ne passe le seuil minimal de similarité
    if (knowledgeMatches.length === 0) {
      // eslint-disable-next-line no-console
      console.log("[RAG Pipeline] Aucun passage au-dessus du seuil (score < 0.28) -> Réponse 'je n'ai pas cette information'.");
      return streamJsonResponse(
        {
          reply:
            "Je n'ai pas cette information dans ma base documentaire officielle. Je te conseille de te renseigner directement sur la plateforme Campusen (campusen.sec.gouv.sn) ou auprès du Ministère de l'Enseignement Supérieur (MESRI).",
          suggestions: [
            "Quelles sont les universités publiques au Sénégal ?",
            "Comment fonctionne Campusen ?",
            "Quels sont les concours d'excellence ?",
          ],
          profile: updatedProfile,
        },
        rateLimit.remaining
      );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 5. INJECTION DANS LE PROMPT SYSTÈME ({profil_json} et {extraits_recuperes})
    // ─────────────────────────────────────────────────────────────────────────
    const formattedKnowledge = formatKnowledgeForPrompt(knowledgeMatches);

    const fullSystemPrompt = SYSTEM_PROMPT_TEMPLATE
      .replace("{profil_json}", JSON.stringify(updatedProfile, null, 2))
      .replace("{extraits_recuperes}", formattedKnowledge);

    // LOG OBLIGATOIRE : Prompt final
    // eslint-disable-next-line no-console
    console.log("[RAG Pipeline] Prompt final :\n", fullSystemPrompt);

    // Sauvegarde en base si connecté
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
    // 6. APPEL DU MODÈLE (JSON, maxTokens 250, température 0.3, historique 10 max)
    // ─────────────────────────────────────────────────────────────────────────
    const model = getAIModel();

    if (!model) {
      // Mode local officiel si aucune clé OpenAI valide n'est configurée
      const localPayload = generateLocalOrientationPayload(
        reformulatedQuery,
        knowledgeMatches,
        updatedProfile
      );
      return streamJsonResponse(localPayload, rateLimit.remaining);
    }

    try {
      const result = streamText({
        model,
        system: fullSystemPrompt,
        messages: recentMessages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        maxTokens: 250, // Limite stricte à 250 tokens
        temperature: 0.3, // Température 0.3
      });

      return createDataStreamResponse({
        execute: async (dataStream) => {
          dataStream.writeMessageAnnotation({ profile: updatedProfile } as any);
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
      return streamJsonResponse(localPayload, rateLimit.remaining);
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
 * Générateur local de réponse au format JSON { reply, suggestions, profile }
 * avec respect de la limite concise (sous 250 tokens) et progression des étapes.
 */
function generateLocalOrientationPayload(
  query: string,
  knowledge: KnowledgeMatch[],
  profile: ConversationProfile
): { reply: string; suggestions: string[]; profile: ConversationProfile } {
  const topDoc = knowledge[0]?.content || "";

  // Suggestions dynamiques selon l'étape de profil
  let suggestions: string[] = [];
  if (profile.etape <= 1) {
    suggestions = ["Bac S1 / S2", "Bac L1 / L2", "Bac G / STEG", "Bac Technique"];
  } else if (profile.etape === 2) {
    suggestions = [
      "J'aime les maths et l'info",
      "Je préfère les SVT et la médecine",
      "J'ai 13 de moyenne",
      "Plutôt le droit et les langues",
    ];
  } else if (profile.etape === 3) {
    suggestions = [
      "Devenir ingénieur à Dakar",
      "Médecine à l'UCAD ou UGB",
      "Droit & Carrières juridiques",
      "Finance / Audit (CESAG)",
    ];
  } else if (profile.etape === 4) {
    suggestions = [
      "Public uniquement (Campusen)",
      "Privé avec bourse d'État",
      "Public avec repli privé",
      "Bourses DGES disponibles",
    ];
  } else {
    suggestions = [
      "Exporter mon récapitulatif",
      "Comment payer sur Campusen ?",
      "Préparer les concours",
      "Nouvelle discussion",
    ];
  }

  // Synthèse courte adaptée
  let reply = "";
  if (profile.etape === 5) {
    reply = `🎉 **Profil complet (Étape 5/5)** : Avec ta série **${profile.serie || "Bac"}**${profile.projet ? ` et ton projet en **${profile.projet}**` : ""}, voici tes options prioritaires au Sénégal :\n\n`;
    if (topDoc.includes("Établissement Public")) {
      reply += `🏛️ **Public (Campusen)** : Renseigne tes vœux prioritaires (ex: ESP, FMPOS, UGB ou FST) à 25 000 FCFA/an avec éligibilité aux bourses DGES.\n`;
    }
    reply += `🏢 **Privé Accrédité** : Écoles reconnues ANAQ-Sup / CAMES accessibles sur dossier ou bourses d'affectation.\n\nClique sur "Exporter le récapitulatif" pour conserver ta fiche !`;
  } else {
    reply = `D'après nos documents officiels pour **${query}** :\n\n`;
    if (topDoc) {
      const snippet = topDoc.split("\n").slice(0, 4).join("\n");
      reply += `${snippet}\n\n`;
    }
    reply += `Pour affiner l'étape ${profile.etape}/5 : ${
      profile.etape === 1
        ? "Quelle est ta série de Bac ?"
        : profile.etape === 2
        ? "Quelles sont tes matières favorites ou ta moyenne ?"
        : profile.etape === 3
        ? "Quel métier aimerais-tu exercer et dans quelle ville ?"
        : "As-tu des contraintes de budget (filières publiques Campusen ou privé) ?"
    }`;
  }

  return {
    reply,
    suggestions,
    profile,
  };
}
