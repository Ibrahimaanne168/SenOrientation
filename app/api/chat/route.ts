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
import { SYSTEM_PROMPT, getAIModel } from "@/lib/ai";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 30; // 30 secondes max

/**
 * Diffuse un texte statique au format data-stream attendu par useChat()
 */
function streamStaticText(text: string, remainingRateLimit = 19) {
  return createDataStreamResponse({
    execute: async (dataStream) => {
      const chunks = text.split(" ");
      for (const chunk of chunks) {
        dataStream.write(formatDataStreamPart("text", chunk + " "));
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
    },
    headers: {
      "X-RateLimit-Remaining": String(remainingRateLimit),
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    // 1. Récupération de l'adresse IP pour le rate limiting
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

    // 2. Validation du format JSON et parsing Zod
    const body = await req.json().catch(() => null);
    const parsed = chatRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Requête invalide. Veuillez vérifier votre message.",
        },
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

    // 3. Sanitisation anti-prompt injection
    const sanitized = sanitizeUserInput(latestUserMessage.content);
    if (sanitized.isSuspicious) {
      // eslint-disable-next-line no-console
      console.warn(
        `[SÉCURITÉ] Tentative de contournement détectée pour l'IP ${ip}:`,
        sanitized.warnings
      );
    }

    // Remplacer le contenu du dernier message par la version assainie
    latestUserMessage.content = sanitized.cleanText;

    // ─────────────────────────────────────────────────────────────────────────
    // ÉTAPE 1 : ROUTAGE DES INTENTIONS (Salutations / Remerciements)
    // Ne lance PAS la recherche vectorielle et répond court
    // ─────────────────────────────────────────────────────────────────────────
    const intent = detectIntent(sanitized.cleanText);

    if (intent === "greeting") {
      // eslint-disable-next-line no-console
      console.log("[RAG Pipeline] Routage : Salutation détectée -> Recherche RAG ignorée.");
      return streamStaticText(
        "Bonjour ! Je suis SenOrientation, ton conseiller pour l'orientation scolaire et universitaire au Sénégal. Quelle est ta série de Bac (ex. S1, S2, L1, L2, G, T...) ou quel domaine t'intéresse pour que je puisse t'aider ?",
        rateLimit.remaining
      );
    }

    if (intent === "gratitude") {
      // eslint-disable-next-line no-console
      console.log("[RAG Pipeline] Routage : Remerciement détecté -> Recherche RAG ignorée.");
      return streamStaticText(
        "Je t'en prie ! N'hésite pas si tu as d'autres questions sur tes choix de filières, la plateforme Campusen, les bourses DGES ou les concours.",
        rateLimit.remaining
      );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ÉTAPE 2 : HISTORIQUE (10 max) & REFORMULATION CONTEXTUELLE DE LA REQUÊTE
    // Ex: "j'aime les maths" + profil S2 -> "filières après Bac S2 orientées mathématiques..."
    // ─────────────────────────────────────────────────────────────────────────
    const recentMessages = messages.slice(-10);
    const historyBeforeCurrent = recentMessages.slice(0, -1);
    const reformulatedQuery = reformulateQuery(historyBeforeCurrent, sanitized.cleanText);

    // LOG SERVEUR : Requête reformulée
    // eslint-disable-next-line no-console
    console.log(`[RAG Pipeline] Requête reformulée : "${reformulatedQuery}"`);

    // Recherche vectorielle TF-IDF / L2 Cosinus (top-k 5, seuil minimal de similarité 0.28)
    const knowledgeMatches = await searchKnowledge(reformulatedQuery, 5, 0.28);

    // LOG SERVEUR : Passages récupérés avec score
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
      console.log("[RAG Pipeline] Aucun passage au-dessus du seuil (score < 0.28) -> Réponse de repli.");
      return streamStaticText(
        "Je n'ai pas cette information dans ma base documentaire officielle. Je te conseille de te renseigner directement sur la plateforme Campusen (campusen.sec.gouv.sn) ou auprès du Ministère de l'Enseignement Supérieur (MESRI).",
        rateLimit.remaining
      );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ÉTAPE 3 : INJECTION SOUS [CONTEXTE] DANS LE PROMPT SYSTÈME
    // ─────────────────────────────────────────────────────────────────────────
    const formattedKnowledge = formatKnowledgeForPrompt(knowledgeMatches);

    const fullSystemPrompt = `${SYSTEM_PROMPT}

==================================================
CONTEXTE DOCUMENTAIRE OFFICIEL DU SÉNÉGAL :
==================================================
${formattedKnowledge}
==================================================
DIRECTIVES CRITIQUES :
1. Réponds UNIQUEMENT et STRICTEMENT en t'appuyant sur les passages fournis ci-dessus sous [CONTEXTE].
2. Si une information demandée ne figure pas dans le contexte, dis explicitement que tu n'as pas cette information dans ta base documentaire officielle.
3. Structure TOUJOURS la réponse en séparant clairement :
   - 🏛️ Établissements & Filières Publiques (orientation via Campusen / concours)
   - 🏢 Établissements Privés Reconnus (accrédités ANAQ-Sup / CAMES)`;

    // LOG SERVEUR : Prompt final
    // eslint-disable-next-line no-console
    console.log("[RAG Pipeline] Prompt final :\n", fullSystemPrompt);

    // ─────────────────────────────────────────────────────────────────────────
    // 4. SAUVEGARDE OPTIONNELLE DANS SUPABASE (si session connectée)
    // ─────────────────────────────────────────────────────────────────────────
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
      // Ne bloque pas la réponse si la session n'est pas active
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ÉTAPE 5 : APPEL DU MODÈLE (Température 0.3, historique 10 max)
    // ─────────────────────────────────────────────────────────────────────────
    const model = getAIModel();

    if (!model) {
      // Moteur local officiel fondé sur les passages du RAG récupérés
      const fallbackResponse = generateLocalOrientationResponse(
        reformulatedQuery,
        knowledgeMatches
      );
      return streamStaticText(fallbackResponse, rateLimit.remaining);
    }

    try {
      const result = streamText({
        model,
        system: fullSystemPrompt,
        messages: recentMessages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        maxTokens: 1200,
        temperature: 0.3, // Température fixée à 0.3 comme demandé
      });

      return result.toDataStreamResponse({
        headers: {
          "X-RateLimit-Remaining": String(rateLimit.remaining),
        },
      });
    } catch {
      // Si l'appel distant OpenAI échoue, basculer sur la synthèse locale du contexte RAG
      const fallbackResponse = generateLocalOrientationResponse(
        reformulatedQuery,
        knowledgeMatches
      );
      return streamStaticText(fallbackResponse, rateLimit.remaining);
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
 * Synthèse locale d'orientation basée sur les passages du RAG validés
 * avec séparation systématique Public / Privé.
 */
function generateLocalOrientationResponse(
  query: string,
  knowledge: KnowledgeMatch[]
): string {
  if (!knowledge || knowledge.length === 0) {
    return "Je n'ai pas cette information dans ma base documentaire officielle. Je te conseille de te renseigner directement sur la plateforme Campusen (campusen.sec.gouv.sn) ou auprès du Ministère de l'Enseignement Supérieur (MESRI).";
  }

  const publicChunks: string[] = [];
  const privateChunks: string[] = [];
  const generalChunks: string[] = [];

  for (const match of knowledge) {
    if (match.content.includes("[Établissement Public") || match.source.includes("public")) {
      publicChunks.push(match.content.replace(/\[Établissement Public \(Campusen\)\]\s*/g, ""));
    } else if (match.content.includes("[Établissement Privé") || match.source.includes("prive")) {
      privateChunks.push(
        match.content.replace(/\[Établissement Privé \(Accrédité ANAQ-Sup \/ CAMES\)\]\s*/g, "")
      );
    } else {
      generalChunks.push(match.content);
    }
  }

  let res = `Voici les informations officielles issues de notre base documentaire pour : **${query}**\n\n`;

  if (publicChunks.length > 0) {
    res += `### 🏛️ Établissements & Filières Publiques (Campusen)\n`;
    for (const item of publicChunks) {
      res += `${item}\n\n`;
    }
  }

  if (privateChunks.length > 0) {
    res += `### 🏢 Établissements Privés Reconnus (ANAQ-Sup / CAMES)\n`;
    for (const item of privateChunks) {
      res += `${item}\n\n`;
    }
  }

  if (generalChunks.length > 0) {
    res += `### 📌 Modalités Officielles & Informations Complémentaires\n`;
    for (const item of generalChunks) {
      res += `${item}\n\n`;
    }
  }

  return res.trim();
}
