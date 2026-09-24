import { NextRequest, NextResponse } from "next/server";
import { streamText } from "ai";
import { chatRequestSchema } from "@/lib/validation/schemas";
import { sanitizeUserInput } from "@/lib/security/sanitize";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { searchKnowledge, formatKnowledgeForPrompt } from "@/lib/rag";
import { SYSTEM_PROMPT, getAIModel } from "@/lib/ai";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 30; // 30 secondes max

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
      // Log serveur sécurisé sans fuite vers le client
      // eslint-disable-next-line no-console
      console.warn(
        `[SÉCURITÉ] Tentative de contournement détectée pour l'IP ${ip}:`,
        sanitized.warnings
      );
    }

    // Remplacer le contenu du dernier message par la version assainie
    latestUserMessage.content = sanitized.cleanText;

    // 4. Recherche documentaire RAG (pgvector / base documentaire sénégalaise)
    const knowledgeMatches = await searchKnowledge(sanitized.cleanText);
    const formattedKnowledge = formatKnowledgeForPrompt(knowledgeMatches);

    // 5. Construction du prompt système enrichi par le RAG
    const fullSystemPrompt = `${SYSTEM_PROMPT}

==================================================
CONTEXTE DOCUMENTAIRE OFFICIEL DU SÉNÉGAL (RAG) :
==================================================
${formattedKnowledge}
==================================================
RAPPEL : Réponds UNIQUEMENT en t'appuyant sur ce contexte documentaire officiel et la réalité académique sénégalaise. Si une information n'est pas présente, oriente l'élève vers Campusen ou le MESRI sans rien inventer.`;

    // 6. Sauvegarde optionnelle dans Supabase si session active
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user && conversationId) {
        // Enregistrer le message de l'utilisateur
        await supabase.from("messages").insert({
          conversation_id: conversationId,
          role: "user",
          content: sanitized.cleanText,
        });
      }
    } catch {
      // Ne bloque pas la réponse si la session n'est pas active
    }

    // 7. Appel du modèle IA via Vercel AI SDK
    const model = getAIModel();

    if (!model) {
      // Mode Fallback intelligent (si OPENAI_API_KEY n'est pas encore saisie dans .env)
      // Permet de tester l'application immédiatement sans crash
      const fallbackResponse = generateLocalOrientationResponse(
        sanitized.cleanText,
        knowledgeMatches
      );

      // Simuler un ReadableStream conforme au protocole Vercel AI SDK
      const stream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();
          const chunks = fallbackResponse.split(" ");
          for (const chunk of chunks) {
            controller.enqueue(encoder.encode(`0:${JSON.stringify(chunk + " ")}\n`));
            await new Promise((resolve) => setTimeout(resolve, 30));
          }
          controller.close();
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "X-Vercel-AI-Data-Stream": "v1",
          "X-RateLimit-Remaining": String(rateLimit.remaining),
        },
      });
    }

    // Mode Vercel AI SDK streamText avec modèle OpenAI / LLM
    try {
      const result = streamText({
        model,
        system: fullSystemPrompt,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        maxTokens: 1200,
        temperature: 0.2,
      });

      return result.toDataStreamResponse({
        headers: {
          "X-RateLimit-Remaining": String(rateLimit.remaining),
        },
      });
    } catch (modelError) {
      // Erreur spécifique au modèle LLM — jamais de chunk brut exposé
      // eslint-disable-next-line no-console
      console.error("[ERREUR MODÈLE IA]", {
        timestamp: new Date().toISOString(),
        message: modelError instanceof Error ? modelError.message : "Erreur modèle inconnue",
      });
      return NextResponse.json(
        { error: "Le modèle d'IA est temporairement indisponible. Veuillez réessayer dans quelques instants." },
        { status: 503 }
      );
    }
  } catch (error) {
    // Journalisation structurée côté serveur SANS exposer de données sensibles
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
 * Générateur local de secours basé sur le RAG sénégalais (quand aucune clé LLM distante n'est définie)
 */
function generateLocalOrientationResponse(
  query: string,
  knowledge: { content: string; source: string }[]
): string {
  const q = query.toLowerCase();

  let response = "Bonjour ! Je suis votre Agent d'Orientation scolaire et universitaire au Sénégal.\n\n";

  if (q.includes("bac s") || q.includes("s1") || q.includes("s2") || q.includes("scientifique")) {
    response += "Avec un **Baccalauréat Scientifique (S1 ou S2)**, de nombreuses opportunités s'offrent à vous au Sénégal :\n\n" +
      "1. **Grandes Écoles d'Ingénieurs** :\n" +
      "   - **ESP Dakar** (UCAD) : Génie Informatique, Télécoms, Génie Civil, Génie Électrique.\n" +
      "   - **IPSL Saint-Louis** (UGB) : Génie Civil et Électromécanique.\n" +
      "   - **ESI-TIC** à l'**UAM Diamniadio** : Informatique, Big Data, IA et Cybersécurité.\n\n" +
      "2. **Santé & Médecine** :\n" +
      "   - **FMPOS (UCAD)** et **UFR 2S (UGB)** : Médecine générale, Pharmacie, Odontostomatologie.\n\n" +
      "3. **Agronomie & Élevage** :\n" +
      "   - **USSEIN (Kaolack)** : Productions végétales, transformation agroalimentaire.\n\n" +
      "📌 *Conseil Campusen* : Veillez à bien classer vos vœux selon vos moyennes dans les matières scientifiques (Maths, PC, SVT).";
  } else if (q.includes("bac l") || q.includes("l1") || q.includes("l2") || q.includes("littéraire")) {
    response += "Pour les bacheliers des **Séries Littéraires (L1, L2, L')**, voici les principales orientations d'excellence au Sénégal :\n\n" +
      "1. **Droit et Sciences Politiques** :\n" +
      "   - **FSJP (UCAD)** et **UFR SJP (UGB)** : Préparation aux carrières d'avocat, magistrat, juriste d'entreprise ou diplomate.\n\n" +
      "2. **Communication & Information** :\n" +
      "   - **CESTI (UCAD)** : École de journalisme et de communication reconnue (admission sur concours).\n" +
      "   - **EBAD (UCAD)** : Métiers de la documentation, archivistique et gestion des données numériques.\n\n" +
      "3. **Lettres, Langues et Sciences Humaines** :\n" +
      "   - **FLSH (UCAD)** et **UFR LSH (UGB)** : Enseignement, traduction, relations internationales, sociologie.";
  } else if (q.includes("bourse") || q.includes("allocation") || q.includes("argent")) {
    response += "Concernant les **bourses de l'État du Sénégal** (gérées par la Direction des Bourses / MESRI) :\n\n" +
      "- **Demi-bourse** : 20 000 FCFA / mois.\n" +
      "- **Bourse entière** : 40 000 FCFA / mois au niveau Licence (revalorisée à 60 000 FCFA en Master).\n" +
      "- **Bourse d'excellence** : Réservée aux lauréats du Concours Général et aux mentions Très Bien/Bien au Bac.\n" +
      "- **Aides sociales** : 60 000 FCFA en une allocation unique pour les étudiants en difficulté.\n\n" +
      "Toutes les demandes et réclamations se font en lien avec votre compte Campusen.";
  } else if (q.includes("campusen") || q.includes("inscription") || q.includes("orientation")) {
    response += "Pour l'orientation post-Bac au Sénégal sur la plateforme **Campusen (campusen.sec.gouv.sn)** :\n\n" +
      "1. Créez votre compte dès l'ouverture des inscriptions avec votre **numéro de table du Bac** et votre date de naissance.\n" +
      "2. Choisissez vos filières dans les universités publiques (UCAD, UGB, UIDT, USSEIN, UAM) et instituts publics.\n" +
      "3. Validez impérativement votre orientation dès que la proposition est publiée pour ne pas perdre votre place.";
  } else {
    response += "Voici ce que contient la base officielle concernant votre recherche :\n\n";
    for (const item of knowledge.slice(0, 2)) {
      response += `> ${item.content.slice(0, 300)}...\n\n`;
    }
    response += "Pouvez-vous préciser votre **série de Bac** ou votre **niveau actuel** (ex: Terminale S2, Terminale L2, Bac G...) ainsi que vos centres d'intérêt afin que je vous guide précisément ?";
  }

  return response;
}
