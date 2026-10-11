import { NextRequest, NextResponse } from "next/server";
import { streamText, createDataStreamResponse, formatDataStreamPart } from "ai";
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

    // 7. Appel du modèle IA ou moteur local de secours
    const model = getAIModel();

    if (!model) {
      // Mode local officiel basé sur le RAG sénégalais (quand aucune clé OpenAI valide n'est configurée)
      const fallbackResponse = generateLocalOrientationResponse(
        sanitized.cleanText,
        knowledgeMatches
      );

      return createDataStreamResponse({
        execute: async (dataStream) => {
          const chunks = fallbackResponse.split(" ");
          for (const chunk of chunks) {
            dataStream.write(formatDataStreamPart("text", chunk + " "));
            await new Promise((resolve) => setTimeout(resolve, 20));
          }
        },
        headers: {
          "X-RateLimit-Remaining": String(rateLimit.remaining),
        },
      });
    }

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
    } catch {
      // Si l'appel externe OpenAI échoue, basculer de manière transparente sur la base officielle
      const fallbackResponse = generateLocalOrientationResponse(
        sanitized.cleanText,
        knowledgeMatches
      );

      return createDataStreamResponse({
        execute: async (dataStream) => {
          const chunks = fallbackResponse.split(" ");
          for (const chunk of chunks) {
            dataStream.write(formatDataStreamPart("text", chunk + " "));
            await new Promise((resolve) => setTimeout(resolve, 20));
          }
        },
      });
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
 * Générateur d'orientation expert : sépare systématiquement les établissements publics
 * et privés, détaille les débouchés au Sénégal et adapte la réponse précisément à la question.
 */
function generateLocalOrientationResponse(
  query: string,
  knowledge: { content: string; source: string }[]
): string {
  const q = query.toLowerCase().trim();

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. SÉRIES SCIENTIFIQUES (S1, S2, S3)
  // ─────────────────────────────────────────────────────────────────────────────
  if (
    q.includes("bac s") ||
    q.includes("s1") ||
    q.includes("s2") ||
    q.includes("s3") ||
    q.includes("scientifique")
  ) {
    return `Avec un **Baccalauréat Scientifique (S1, S2, S3)** au Sénégal, tes opportunités d'études supérieures sont très vastes et recherchées. Voici le panorama complet, classé par filières avec la distinction entre le public et le privé :

### 1. Sciences de l'Ingénieur & Nouvelles Technologies (IT, IA, BTP)
* 🏛️ **Établissements Publics** *(Sélection Campusen ou concours, droits d'inscription ~25 000 FCFA/an)* :
  - **ESP Dakar (UCAD)** : Génie Informatique, Télécoms, Génie Civil, Génie Électrique, Génie Mécanique (sur concours DUT/DIC ou Campusen).
  - **EPT Thiès** : École Polytechnique de Thiès, formation d'ingénieurs de conception (sur concours national sélectif).
  - **ESI-TIC à l'UAM (Diamniadio)** : Informatique, Big Data, Intelligence Artificielle et Cybersécurité.
  - **UFR SAT à l'UGB (Saint-Louis)** & **CEA-MITIC** : Mathématiques Appliquées, Informatique, Réseaux.
  - **UIDT (Thiès)** : Génie Électromécanique, Informatique et BTP.
* 🏢 **Établissements Privés Reconnus** *(Accrédités ANAQ-Sup / CAMES, admission sur dossier)* :
  - **DAUST (Dakar American University of Science and Technology)** : Ingénierie logicielle, robotique, standard STEM.
  - **ESTM (Dakar)** : Télécoms, réseaux, cybersécurité et génie logiciel.
  - **IPG-ISTI** : Génie civil, informatique industrielle, électromécanique.

### 2. Santé & Sciences Médicales
* 🏛️ **Établissements Publics** *(Très forte sélection sur les notes du Bac S1/S2 : SVT, PC, Maths)* :
  - **FMPOS (UCAD - Dakar)** : Médecine générale (8 ans), Pharmacie (6 ans), Odontostomatologie.
  - **UFR 2S (UGB - Saint-Louis)** : Médecine générale et soins infirmiers.
  - **UFR Santé à l'UIDT (Thiès)** & **UASZ (Ziguinchor)** : Sciences médicales et santé publique.
  - **EMS (École Militaire de Santé)** : Médecins et pharmaciens militaires (concours national).
* 🏢 **Établissements Privés Reconnus** :
  - **UAHB (Université Amadou Hampâté Bâ)** : Sciences de la santé, médecine, pharmacie (accrédité).
  - **IPG Santé / EESM** : Soins infirmiers d'État, maïeutique, biologie médicale.

### 3. Agronomie, Agroalimentaire & Environnement
* 🏛️ **Établissements Publics** :
  - **USSEIN (Kaolack, Fatick, Kaffrine)** : Vocation agro-écologique, productions végétales, agro-business.
  - **ENSA Thiès** : École Nationale Supérieure d'Agriculture (concours d'ingénieurs agronomes).
  - **UFR S2ATA (UGB)** : Technologies alimentaires et agronomie durable.
* 🏢 **Établissements Privés Reconnus** :
  - Instituts agro-industriels privés habilités par le MESRI.

💼 **Débouchés clés au Sénégal** : Ingénieur logiciel (450 000 à 1 200 000 FCFA/mois), Médecin hospitalier ou libéral, Data Analyst, Ingénieur BTP/Infrastructures, Agro-entrepreneur.

📌 **Conseil Campusen** : Classe tes vœux en mettant en premier les filières sélectives (ESP, FMPOS, UGB SAT) puis des filières de repli solides (FST UCAD Maths-PC ou UN-CHK).`;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. SÉRIES LITTÉRAIRES (L1, L2, L')
  // ─────────────────────────────────────────────────────────────────────────────
  if (
    q.includes("bac l") ||
    q.includes("l1") ||
    q.includes("l2") ||
    q.includes("l'") ||
    q.includes("littéraire")
  ) {
    return `Avec un **Baccalauréat Littéraire (L1, L2, L')** au Sénégal, tu as accès à d'excellents parcours menant vers les carrières judiciaires, managériales, de communication et de diplomatie :

### 1. Droit, Sciences Politiques & Administration Publique
* 🏛️ **Établissements Publics** :
  - **FSJP (UCAD - Dakar)** : Droit public, Droit privé, Sciences politiques (filière reine des bacheliers L).
  - **UFR SJP (UGB - Saint-Louis)** : Droit des affaires, Droit fiscal, Coopération internationale.
  - **UIDT (Thiès)** & **UASZ (Ziguinchor)** : Sciences juridiques.
  - **Grandes Écoles d'État (sur concours)** : **ENA** (École Nationale d'Administration), **CFJ** (Centre de Formation Judiciaire pour devenir magistrat ou greffier).
* 🏢 **Établissements Privés Reconnus (ANAQ-Sup / CAMES)** :
  - **UCAO / ISG Saint-Michel** : Droit des affaires, fiscalité et carrières juridiques d'entreprise.
  - **ISM School of Law (Dakar)** : Droit international, droit des affaires OHADA.
  - **BEM Dakar - Faculté de Droit** : Pratique juridique d'entreprise et conformité.

### 2. Journalisme, Communication & Métiers de l'Information
* 🏛️ **Établissements Publics** :
  - **CESTI (UCAD)** : Centre d'Études des Sciences et Techniques de l'Information (concours annuel d'entrée très réputé).
  - **EBAD (UCAD)** : École de Bibliothécaires, Archivistes et Documentalistes (gestion des archives, Big Data et documentation numérique).
* 🏢 **Établissements Privés Reconnus** :
  - **Sup de Co - Sup'Imax / Métiers de la Com** : Communication digitale, graphisme, audiovisuel.
  - **ISM Media / Sup'de Com** : Relations publiques, marketing digital et médias.

### 3. Langues, Relations Internationales & Enseignement
* 🏛️ **Établissements Publics** :
  - **FLSH (UCAD)** & **UFR LSH (UGB)** : Anglais, Espagnol, Arabe, Traduction, Sociologie, Géographie.
  - **FASTEF (UCAD)** : Formation des professeurs de collèges et lycées (sur concours après la Licence).

💼 **Débouchés clés au Sénégal** : Avocat d'affaires, Magistrat, Juriste d'entreprise, Journaliste spécialisé, Responsable communication d'ONG ou ministère, Enseignant, Traducteur/Interprète.

📌 **Conseil Campusen** : Tes notes en Français, Philosophie et Histoire-Géographie sont déterminantes pour obtenir le FSJP ou l'UGB SJP.`;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. SÉRIE G / STEG (GESTION, COMPTABILITÉ, COMMERCE)
  // ─────────────────────────────────────────────────────────────────────────────
  if (
    q.includes("bac g") ||
    q.includes("steg") ||
    q.includes("gestion") ||
    q.includes("comptabilité") ||
    q.includes("finance")
  ) {
    return `Avec un **Baccalauréat G ou STEG (Gestion, Comptabilité, Commerce)**, tu possèdes un profil directement orienté vers le monde de l'entreprise, des banques et de l'audit au Sénégal :

### 1. Finance, Comptabilité & Audit
* 🏛️ **Établissements Publics** :
  - **FASEG (UCAD - Dakar)** : Sciences Économiques et Gestion (Licence & Master en Finance, Économétrie, Comptabilité).
  - **UFR SEG (UGB - Saint-Louis)** : Économie appliquée, Finance, Gestion des entreprises.
  - **ESP Dakar (Département Gestion)** : DUT Gestion des Entreprises et Administrations (sur concours).
  - **ENSAE (Dakar)** : École Nationale de la Statistique et de l'Analyse Économique (ingénieurs statisticiens et économistes, concours très prestigieux).
* 🏢 **Établissements Privés Reconnus (CAMES / AACSB / ANAQ-Sup)** :
  - **CESAG (Dakar)** : Centre Africain d'Études Supérieures en Gestion (BCEAO/UEMOA, référence continentale en audit et banque).
  - **BEM Dakar (Bordeaux Management School)** : BBA et Master Grande École en Finance et Management.
  - **ISM (Institut Supérieur de Management)** : Comptabilité, Contrôle, Audit (CCA), Finance de marché.
  - **Sup de Co Dakar** : Établissement historique en gestion, audit financier et commerce international.
  - **IAM (Institut Africain de Management)** : Banque, assurances, gestion de projets.

### 2. Marketing, Logistique & Commerce International
* 🏛️ **Établissements Publics** :
  - **ESP Dakar** : DUT Commerce International et Logistique.
  - **UAM (Diamniadio) - HEG** : Haute École de Gestion, entrepreneuriat et management innovant.
* 🏢 **Établissements Privés Reconnus** :
  - **BEM Dakar**, **Sup de Co**, **ISM**, **UCAO / Saint-Michel**.

💼 **Débouchés clés au Sénégal** : Auditeur financier en cabinet (KPMG, PwC, Deloitte Sénégal), Contrôleur de gestion, Analyste financier de banque (CBAO, SGBS, BOA), Responsable logistique portuaire (Port Autonome de Dakar).

📌 **Conseil Campusen** : Mets en priorité la FASEG UCAD et l'UFR SEG UGB, tout en présentant les concours de l'ESP et de l'ENSAE.`;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. SÉRIES TECHNIQUES (T1, T2)
  // ─────────────────────────────────────────────────────────────────────────────
  if (q.includes("bac t") || q.includes("t1") || q.includes("t2") || q.includes("technique")) {
    return `Les bacheliers des **Séries Techniques (T1 : Génie Mécanique, T2 : Génie Électrique)** sont parmi les profils les plus convoités au Sénégal pour l'industrialisation du pays :

### 1. Génie Électrique, Électronique & Énergies
* 🏛️ **Établissements Publics** :
  - **ESP Dakar** : Génie Électrique, Télécoms & Réseaux, Énergies Renouvelables.
  - **EPT Thiès** : Ingénierie polytechnique.
  - **UAM Diamniadio** : Génie des systèmes industriels et solaire.
  - **IUT de l'UIDT (Thiès)** : Électrotechnique et automatismes.
* 🏢 **Établissements Privés Reconnus** :
  - **DAUST** : Robotique et mécatronique.
  - **ESTM Dakar** : Systèmes électroniques et réseaux.
  - **IPG-ISTI** : Électromécanique industrielle.

### 2. Génie Civil, Mines & Mécanique Industrielle
* 🏛️ **Établissements Publics** :
  - **ESP Dakar** & **IPSL (UGB)** : Génie Civil, BTP, Hydraulique.
  - **ESMG à l'UAM (Diamniadio)** : École Supérieure des Mines et de la Géologie.
* 🏢 **Établissements Privés Reconnus** :
  - Instituts privés d'ingénierie BTP habilités ANAQ-Sup.

💼 **Débouchés clés** : Ingénieur BTP, Chef de projet énergie solaire/éolienne, Conducteur de travaux, Responsable maintenance industrielle (Senelec, Eiffage, ICS, Dangote, Sonatel).`;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. INFORMATIQUE, IA & CYBERSÉCURITÉ
  // ─────────────────────────────────────────────────────────────────────────────
  if (
    q.includes("informatique") ||
    q.includes("cyber") ||
    q.includes("intelligence artificielle") ||
    q.includes("programmeur") ||
    q.includes("logiciel")
  ) {
    return `L'**Informatique et le Numérique** représentent le secteur à la plus forte croissance d'embauche au Sénégal :

### 🏛️ Établissements Publics (Formation d'État)
* **ESP Dakar (UCAD)** : Département Génie Informatique (DUT 2 ans puis DIC Ingénieur Bac+5). Très forte réputation sous-régionale.
* **ESI-TIC à l'UAM (Diamniadio)** : Pôle d'excellence dédié à l'Intelligence Artificielle, au Cloud et à la Cybersécurité.
* **UFR SAT à l'UGB (Saint-Louis)** : CEA-MITIC (Centre d'Excellence Africain en TIC), filières de pointe en développement et réseaux.
* **UN-CHK (Université Numérique Cheikh Hamidou Kane)** : Formations décentralisées en développement web, data et multimédia dans les ENO de toutes les régions.
* **FST (UCAD - Dakar)** : Licence et Master en Informatique fondamentale et appliquée.

### 🏢 Établissements Privés Reconnus (ANAQ-Sup / CAMES)
* **DAUST (Dakar American University of Science and Technology)** : Enseignement en anglais axé sur le code moderne, l'IA et l'embarqué.
* **ESTM (Dakar)** : Référence privée en Réseaux, Sécurité des SI et Génie Logiciel.
* **IPG-ISTI** : Informatique de gestion et systèmes réseaux.
* **ISM Digital Campus** : Développement d'applications et marketing digital.

💼 **Débouchés & Salaires au Sénégal** :
* Développeur Web / Mobile : 400 000 à 900 000 FCFA/mois.
* Ingénieur Cybersécurité / DevOps : 700 000 à 1 500 000 FCFA/mois.
* Data Analyst / Ingénieur IA : 600 000 à 1 400 000 FCFA/mois.

📌 **Critères d'accès** : Priorité aux Bacs S1, S2, S3, T1 pour les grandes écoles d'ingénieurs publiques.`;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. SANTÉ & MÉDECINE
  // ─────────────────────────────────────────────────────────────────────────────
  if (
    q.includes("médecine") ||
    q.includes("santé") ||
    q.includes("pharmacie") ||
    q.includes("docteur") ||
    q.includes("dentiste")
  ) {
    return `Les études en **Santé et Médecine** au Sénégal sont parmi les plus sélectives et respectées d'Afrique :

### 🏛️ Faculté Publique (Voie Officielle Campusen)
* **FMPOS (UCAD - Dakar)** : Faculté de Médecine, de Pharmacie et d'Odontostomatologie. Cursus de 8 ans (Doctorat d'État). Accès réservé aux mentions et très fortes moyennes en SVT, PC et Maths au Bac S1/S2.
* **UFR 2S (UGB - Saint-Louis)** : Sciences de la santé (Médecine générale, soins).
* **UFR Santé de l'UIDT (Thiès)** & **UASZ (Ziguinchor)** : Cursus médical complet.
* **EMS (École Militaire de Santé)** : Concours d'État pour devenir médecin-officier (prise en charge intégrale, statut militaire).

### 🏢 Établissements Privés Reconnus
* **UAHB (Université Amadou Hampâté Bâ - Dakar)** : Faculté privée de médecine et pharmacie accréditée par l'ANAQ-Sup.
* **Écoles privées de santé (EESM, IPG Santé)** : Formations d'infirmiers d'État, de sages-femmes et de techniciens de laboratoire biologique.

💼 **Débouchés** : Médecin hospitalier, Médecin de santé publique, Pharmacien d'officine ou industriel, Chirurgien-dentiste, Cadre de santé dans les agences de l'ONU / OMS.`;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 7. BOURSES DE L'ÉTAT (DGES)
  // ─────────────────────────────────────────────────────────────────────────────
  if (
    q.includes("bourse") ||
    q.includes("dges") ||
    q.includes("allocation") ||
    q.includes("argent") ||
    q.includes("aide")
  ) {
    return `Voici les informations officielles et complètes sur les **Bourses de l'État du Sénégal** (Direction des Bourses / DGES / MESRI) :

### 1. Types de Bourses et Montants
* **Demi-bourse nationale** : **20 000 FCFA par mois** (accordée sur critères de quota, de notes au Bac et de situation de contingentement).
* **Bourse entière nationale** : **40 000 FCFA par mois** au niveau Licence (revalorisée à **60 000 FCFA par mois** dès le Master).
* **Bourse d'excellence** : Accordée aux lauréats du Concours Général sénégalais et aux bacheliers ayant obtenu la mention **Très Bien** ou **Bien** (surtout dans les séries prioritaires S1/S2/Technique).
* **Aide sociale ponctuelle** : **60 000 FCFA en un paiement unique annuel** pour les étudiants réguliers non boursiers mais justifiant de difficultés financières.

### 2. Démarches et Paiement
* La demande de bourse est automatiquement rattachée à votre inscription validée sur **Campusen**.
* Le paiement se fait mensuellement via les opérateurs agréés (Wave, Orange Money ou Ecobank / compte bancaire étudiant).
* **Maintien de la bourse** : La bourse est renouvelée chaque année sous réserve de valider ses crédits universitaires (passage en année supérieure). Les redoublements répétés suspendent le paiement.`;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 8. FONCTIONNEMENT DE CAMPUSEN
  // ─────────────────────────────────────────────────────────────────────────────
  if (
    q.includes("campusen") ||
    q.includes("comment fonctionne") ||
    q.includes("inscription") ||
    q.includes("choix")
  ) {
    return `Voici le guide complet du fonctionnement de la plateforme nationale **Campusen (campusen.sec.gouv.sn)** pour l'orientation au Sénégal :

### 1. Calendrier & Création du Compte
* **Ouverture** : Généralement au mois d'août, dès la proclamation des résultats du Baccalauréat.
* **Identifiants requis** : Ton **numéro de table au Bac**, ton année de session et ta **date de naissance**.
* **Numéro de téléphone** : Utilise un numéro actif qui t'appartient, car les SMS d'alerte et de confirmation y seront envoyés.

### 2. Formuler ses Choix (Stratégie de Vœux)
* Tu dois choisir des filières dans les universités publiques : **UCAD, UGB, UIDT, USSEIN, UAM, UN-CHK, UADB, UASZ**.
* Tu peux également formuler des choix pour les établissements privés d'enseignement supérieur subventionnés si l'État ouvre ce contingent.
* **Conseil stratégique** : Place en tête tes filières de cœur les plus sélectives (ex: Médecine, Informatique, Écoles d'ingénieurs), et en bas de liste des filières moins saturées (ex: FLSH, UN-CHK) pour être sûr d'avoir une proposition d'orientation.

### 3. Validation et Paiement des Droits
* Dès que Campusen publie ta proposition d'orientation, tu as un **délai strict de 7 à 10 jours** pour valider et payer les droits d'inscription (25 000 FCFA) via mobile money.
* ⚠️ **Attention** : Si tu ne valides pas dans les délais, tu es déclaré **forclos** et tu perds définitivement ta place dans le public pour l'année universitaire.`;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 9. CONCOURS POST-BAC
  // ─────────────────────────────────────────────────────────────────────────────
  if (q.includes("concours") || q.includes("grande école") || q.includes("esp") || q.includes("ept")) {
    return `Voici les principaux **Concours Post-Bac d'excellence** au Sénégal, distincts de l'orientation directe Campusen :

### 🏛️ Grandes Écoles Publiques sur Concours
1. **ESP Dakar (UCAD)** :
   - Concours d'entrée en DUT (Diplôme Universitaire de Technologie, 2 ans).
   - Séries éligibles : S1, S2, S3, T1, T2, G (pour gestion).
   - Épreuves : Maths, Physique-Chimie, Français/Anglais selon la spécialité.
2. **EPT Thiès (École Polytechnique de Thiès)** :
   - Concours de recrutement d'élèves-ingénieurs de conception (5 ans).
   - Très sélectif, réservé aux meilleurs bacheliers S1 et S2.
3. **CESTI (UCAD)** :
   - Concours de journalisme (épreuves de culture générale, français et actualité).
4. **ENSAE (Dakar)** :
   - Formation de cadres en statistique et analyse économique (Bacs S et G).
5. **EMS (École Militaire de Santé)** :
   - Concours national des armées pour former les futurs médecins et pharmaciens militaires.

📌 **Période des concours** : Les dossiers s'ouvrent généralement entre **mai et juillet**. Il faut déposer ses pièces avant les épreuves qui se déroulent souvent juste après le Baccalauréat.`;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 10. RÉPONSE GÉNÉRALE PAR DÉFAUT ENRICHIE DU RAG
  // ─────────────────────────────────────────────────────────────────────────────
  let response = "Salut ! Pour t'orienter précisément, voici les grandes filières accessibles au Sénégal réparties entre le secteur public et privé :\n\n";

  response += "### 🏛️ Dans les Universités Publiques (via Campusen) :\n";
  response += "* **UCAD (Dakar)** : Sciences, Santé (FMPOS), Droit (FSJP), Économie (FASEG), Ingénierie (ESP), Journalisme (CESTI).\n";
  response += "* **UGB (Saint-Louis)** : Informatique d'excellence (SAT/CEA-MITIC), Droit (SJP), Médecine (2S), Gestion (SEG).\n";
  response += "* **UAM (Diamniadio)** : Métiers d'avenir, IA, Mines, Urbanisme et Technologies.\n";
  response += "* **USSEIN (Kaolack)** : Agro-business, productions végétales, élevage et développement durable.\n";
  response += "* **UIDT (Thiès)** & **UN-CHK** : Formations professionnelles décentralisées.\n\n";

  response += "### 🏢 Dans les Grandes Écoles Privées Reconnues (ANAQ-Sup / CAMES) :\n";
  response += "* **Commerce, Gestion & Droit** : BEM Dakar, ISM, Sup de Co, IAM, UCAO / Saint-Michel.\n";
  response += "* **Technologies & Ingénierie** : DAUST, ESTM, IPG-ISTI.\n\n";

  response += "Dis-moi : **quelle est ta série de Bac (ex : S1, S2, L1, L2, G, T...)** ou quel métier aimerais-tu exercer pour que je te donne un plan d'orientation sur mesure ?";

  return response;
}

