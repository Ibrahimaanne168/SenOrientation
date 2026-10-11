// ============================================================================
// SENORIENTATION - PIPELINE RAG OFFICIEL SÉNÉGAL
// Routage, reformulation contextuelle, recherche vectorielle / cosinus avec seuil
// ============================================================================

import etablissementsData from "@/data/etablissements.json";
import filieresData from "@/data/filieres.json";
import concoursData from "@/data/concours.json";

export interface KnowledgeMatch {
  id?: string;
  content: string;
  source: string;
  similarity: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. ROUTAGE DES INTENTIONS (Salutations, Remerciements, Requêtes)
// ─────────────────────────────────────────────────────────────────────────────

const GREETING_WORDS = new Set([
  "bonjour",
  "salut",
  "bonsoir",
  "coucou",
  "hello",
  "hi",
  "salam",
  "salam aleykoum",
  "assalamou aleykoum",
  "nanga def",
  "hey",
  "allo",
]);

const GRATITUDE_WORDS = [
  "merci",
  "merci beaucoup",
  "dieureudieuf",
  "merci bien",
  "je vous remercie",
  "je te remercie",
  "thanks",
  "merci pour l'aide",
  "c'est bien noté merci",
  "parfait merci",
  "ok merci",
];

export function detectIntent(message: string): "greeting" | "gratitude" | "query" {
  const clean = message
    .toLowerCase()
    .trim()
    .replace(/[!?,;.:/\\()]/g, "")
    .replace(/\s+/g, " ");

  // Vérifier si c'est une salutation simple
  if (
    GREETING_WORDS.has(clean) ||
    clean.startsWith("bonjour ") && clean.split(" ").length <= 4 ||
    clean.startsWith("salut ") && clean.split(" ").length <= 4 ||
    clean.startsWith("bonsoir ") && clean.split(" ").length <= 4
  ) {
    return "greeting";
  }

  // Vérifier si c'est un remerciement
  for (const g of GRATITUDE_WORDS) {
    if (clean === g || clean.startsWith(`${g} `) && clean.split(" ").length <= 5) {
      return "gratitude";
    }
  }

  return "query";
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. REFORMULATION DE REQUÊTE AVEC L'HISTORIQUE
// ─────────────────────────────────────────────────────────────────────────────

export function reformulateQuery(
  history: { role: string; content: string }[],
  currentQuery: string,
  profile?: {
    serie?: string | null;
    projet?: string | null;
    matieres_aimees?: string[];
    ville?: string | null;
    budget?: string | null;
  }
): string {
  const current = currentQuery.trim();
  const lowerCurrent = current.toLowerCase();

  // Détection depuis le profil fourni en priorité
  let detectedSerie: string | null = profile?.serie ? `Bac ${profile.serie}` : null;
  let detectedInterest: string | null = profile?.projet || null;

  // Analyser l'historique récent si non fourni dans le profil
  if (history && history.length > 0) {
    const recentHistory = history.slice(-6);
    for (const msg of recentHistory) {
      const text = msg.content.toLowerCase();
      if (!detectedSerie) {
        if (text.includes("s1") || text.includes("scientifique s1")) detectedSerie = "Bac S1";
        else if (text.includes("s2") || text.includes("scientifique s2")) detectedSerie = "Bac S2";
        else if (text.includes("s3")) detectedSerie = "Bac S3";
        else if (text.includes("l1")) detectedSerie = "Bac L1";
        else if (text.includes("l2") || text.includes("littéraire")) detectedSerie = "Bac L2";
        else if (text.includes("l'")) detectedSerie = "Bac L'";
        else if (text.includes("bac g") || text.includes("steg")) detectedSerie = "Bac G / STEG";
        else if (text.includes("t1")) detectedSerie = "Bac T1";
        else if (text.includes("t2")) detectedSerie = "Bac T2";
      }

      if (!detectedInterest) {
        if (text.includes("informatique") || text.includes("code") || text.includes("dev")) detectedInterest = "informatique et technologies";
        else if (text.includes("médecine") || text.includes("santé")) detectedInterest = "santé et médecine";
        else if (text.includes("droit") || text.includes("juridique")) detectedInterest = "droit et sciences politiques";
        else if (text.includes("gestion") || text.includes("finance") || text.includes("banque")) detectedInterest = "gestion, audit et finance";
        else if (text.includes("agronomie") || text.includes("agriculture")) detectedInterest = "agronomie et agro-business";
      }
    }
  }

  // Cas spécifique : message qui annonce juste la série (ex: "je suis en S2", "Bac S2")
  if (lowerCurrent.match(/^(?:je suis en\s+|bac\s+)?(s[1-3]|l[1-2]|l'|g|steg|t[1-2])$/i)) {
    const serieName = detectedSerie || `Bac ${current.toUpperCase()}`;
    return `orientation et filières supérieures après ${serieName} au Sénégal dans le public et le privé`;
  }

  // Cas spécifique : message qui mentionne le public ou le privé (ex: "je vise le public uniquement")
  if (lowerCurrent.includes("public") || lowerCurrent.includes("campusen")) {
    const serieName = detectedSerie || "bacheliers";
    const domain = detectedInterest ? `en ${detectedInterest}` : "filières prioritaires";
    return `filières et universités publiques Campusen après ${serieName} ${domain} au Sénégal`;
  }

  // Si la question actuelle est courte ou incomplète (ex: "j'aime les maths", "quelles filières ?", "quelles écoles ?")
  const needsContext =
    current.split(" ").length <= 8 &&
    !lowerCurrent.includes("campusen.sec.gouv.sn");

  if (needsContext && detectedSerie) {
    if (lowerCurrent.includes("math") || lowerCurrent.includes("pc") || lowerCurrent.includes("svt")) {
      return `filières après ${detectedSerie} orientées mathématiques et sciences appliquées au Sénégal`;
    }
    if (lowerCurrent.includes("école") || lowerCurrent.includes("université")) {
      return `universités publiques et grandes écoles après ${detectedSerie} au Sénégal`;
    }
    const domain = detectedInterest ? `en ${detectedInterest}` : "";
    return `filières d'excellence et débouchés après ${detectedSerie} ${domain} au Sénégal ${current}`;
  }

  if (needsContext && detectedInterest) {
    return `orientation et formations en ${detectedInterest} au Sénégal : établissements publics et privés`;
  }

  return current;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. MOTEUR DE VECTORISATION TF-IDF & SIMILARITÉ COSINUS NORMALISÉE
// ─────────────────────────────────────────────────────────────────────────────

interface RawDocument {
  id: string;
  source: string;
  content: string;
  tokens: string[];
}

const STOP_WORDS = new Set([
  "le", "la", "les", "de", "des", "du", "un", "une", "pour", "dans", "avec",
  "sur", "par", "et", "ou", "en", "au", "aux", "est", "sont", "je", "tu",
  "il", "elle", "nous", "vous", "ils", "ce", "qui", "que", "quoi", "dont",
  "où", "mon", "ma", "mes", "ton", "ta", "tes", "son", "sa", "ses", "faire",
  "être", "avoir", "quel", "quelle", "quelles", "quels", "plus", "très"
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()'"«»]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

// Compilation de la base de connaissances officielle (Établissements, Filières, Bourses, Campusen)
const KNOWLEDGE_CORPUS: RawDocument[] = [];

// Documents essentiels de gouvernance (Campusen, Bourses DGES)
const CORE_DOCUMENTS = [
  {
    id: "campusen_procedure_officielle",
    source: "campusen_gouv",
    content: `PROCÉDURE OFFICIELLE CAMPUSEN (campusen.sec.gouv.sn) :
- Plateforme nationale obligatoire pour toute orientation post-Bac dans les universités publiques et les instituts publics subventionnés au Sénégal.
- Inscription : Ouverture en août dès la publication des résultats du Baccalauréat. Nécessite le numéro de table au Baccalauréat et la date de naissance.
- Vœux : L'élève classe ses choix de filières par ordre de préférence parmi les universités publiques (UCAD, UGB, UIDT, USSEIN, UAM, UN-CHK, UADB, UASZ).
- Validation et Forclusion : Dès publication de la proposition d'orientation, l'élève dispose d'un délai strict de 7 à 10 jours pour valider et régler ses droits d'inscription (25 000 FCFA) par mobile money. Tout retard entraîne la forclusion définitive.`,
  },
  {
    id: "bourses_dges_nationales",
    source: "bourses_dges",
    content: `BOURSES NATIONALES DE L'ÉTAT DU SÉNÉGAL (DGES / Direction des Bourses) :
- Demi-bourse : 20 000 FCFA par mois (attribuée sur critères de résultats au Bac et de contingentement).
- Bourse entière : 40 000 FCFA par mois en Licence, revalorisée à 60 000 FCFA par mois en Master.
- Bourse d'excellence : Réservée aux lauréats du Concours Général sénégalais et aux bacheliers avec mention Très Bien ou Bien dans les séries scientifiques prioritaires.
- Aides sociales : Allocation annuelle ponctuelle de 60 000 FCFA pour les étudiants non boursiers en situation de précarité.
- Paiement : Effectué mensuellement via les opérateurs agréés (Wave, Orange Money ou compte bancaire).`,
  },
  {
    id: "concours_grandes_ecoles",
    source: "concours_officiels",
    content: `CONCOURS D'EXCELLENCE POST-BAC AU SÉNÉGAL :
- ESP Dakar (UCAD) : Concours d'entrée en DUT (2 ans) et DIC (Ingénieur Bac+5) pour séries S1, S2, S3, T1, T2, G.
- EPT Thiès (École Polytechnique de Thiès) : Formation d'ingénieurs de conception, concours sélectif pour bacheliers S1 et S2.
- CESTI (UCAD) : Concours de journalisme et communication (épreuves écrites et orales).
- ENSAE (Dakar) : Ingénieurs statisticiens et économistes.
- EMS (École Militaire de Santé) : Médecins et pharmaciens militaires.
- Période des dépôts de dossiers : Généralement entre mai et juillet avant les épreuves.`,
  },
];

for (const doc of CORE_DOCUMENTS) {
  KNOWLEDGE_CORPUS.push({
    id: doc.id,
    source: doc.source,
    content: doc.content,
    tokens: tokenize(doc.content),
  });
}

// Ingestion des établissements (Publics et Privés reconnus)
if (Array.isArray(etablissementsData)) {
  for (const et of etablissementsData) {
    const isPublic = (et.statut_etablissement || et.type || "").toLowerCase().includes("public");
    const labelType = isPublic ? "Établissement Public (Campusen)" : "Établissement Privé (Accrédité ANAQ-Sup / CAMES)";
    const content = `[${labelType}] ${et.nom} (${et.sigle || et.id}) à ${et.ville || "Sénégal"} :
- Statut : ${et.statut_etablissement || et.type}
- Filières majeures : ${(et.filieres_proposees || []).slice(0, 15).join(", ")}
- Facultés / UFR : ${(et.facultes_ou_ufr || []).slice(0, 8).join(", ")}
- Conditions d'accès : ${et.conditions_admission || "Orientation Campusen pour le public ou dossier/concours pour le privé"}
- Droits et frais : ${et.frais_scolarite || "Droits d'inscription nationaux pour le public"}
- Débouchés : ${(et.debouches_principaux || []).slice(0, 8).join(", ")}`;

    KNOWLEDGE_CORPUS.push({
      id: `etablissement_${et.id}`,
      source: isPublic ? "campusen_public" : "etablissement_prive_anaq_sup",
      content,
      tokens: tokenize(content),
    });
  }
}

// Ingestion des filières
if (Array.isArray(filieresData)) {
  for (const f of filieresData) {
    const content = `FILIÈRE : ${f.title} (${f.domain || "Enseignement Supérieur"})
- Niveau : ${f.level || "Licence / Master"} | Durée : ${f.duration || "3 à 5 ans"}
- Bacs recommandés : ${(f.bacRecommended || []).join(", ")}
- Description : ${f.description || ""}
- Universités et écoles : ${(f.universities || []).join(", ")}
- Débouchés professionnels : ${(f.careers || []).slice(0, 10).join(", ")}
- Conditions d'admission : ${f.admissionConditions || "Orientation Campusen selon résultats au Bac"}
- Salaires indicatifs au Sénégal : ${f.averageSalary || "Variable selon le secteur"}`;

    KNOWLEDGE_CORPUS.push({
      id: `filiere_${f.id}`,
      source: "referentiel_filieres_mesri",
      content,
      tokens: tokenize(content),
    });
  }
}

// Calcul de l'Inverse Document Frequency (IDF) pour tout le corpus
const VOCABULARY_IDF = new Map<string, number>();
const TOTAL_DOCS = KNOWLEDGE_CORPUS.length;

(() => {
  const docFrequency = new Map<string, number>();
  for (const doc of KNOWLEDGE_CORPUS) {
    const uniqueTokens = new Set(doc.tokens);
    for (const t of uniqueTokens) {
      docFrequency.set(t, (docFrequency.get(t) || 0) + 1);
    }
  }

  for (const [term, df] of docFrequency.entries()) {
    VOCABULARY_IDF.set(term, Math.log(1 + TOTAL_DOCS / (1 + df)));
  }
})();

function computeVector(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  for (const t of tokens) {
    tf.set(t, (tf.get(t) || 0) + 1);
  }

  const vec = new Map<string, number>();
  let sumSq = 0;

  for (const [term, count] of tf.entries()) {
    const idf = VOCABULARY_IDF.get(term) || Math.log(1 + TOTAL_DOCS);
    const weight = count * idf;
    vec.set(term, weight);
    sumSq += weight * weight;
  }

  // Normalisation L2 du vecteur
  const norm = Math.sqrt(sumSq) || 1;
  for (const [term, weight] of vec.entries()) {
    vec.set(term, weight / norm);
  }

  return vec;
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. FONCTION PRINCIPALE DE RECHERCHE VECTORIELLE AVEC SEUIL
// ─────────────────────────────────────────────────────────────────────────────

export async function searchKnowledge(
  query: string,
  maxResults = 5,
  similarityThreshold = 0.28
): Promise<KnowledgeMatch[]> {
  const queryTokens = tokenize(query);

  if (queryTokens.length === 0) {
    return [];
  }

  const queryVec = computeVector(queryTokens);
  const scoredResults: KnowledgeMatch[] = [];

  for (const doc of KNOWLEDGE_CORPUS) {
    // Calcul de la similarité cosinus (produit scalaire de deux vecteurs normalisés L2)
    let dotProduct = 0;
    for (const [term, queryWeight] of queryVec.entries()) {
      if (doc.tokens.includes(term)) {
        // Fréquence locale dans le document
        const idf = VOCABULARY_IDF.get(term) || 1;
        const count = doc.tokens.filter((t) => t === term).length;
        dotProduct += queryWeight * (count * idf);
      }
    }

    // Normalisation approximative par taille du document pour le score final en [0, 1]
    const docNorm = Math.sqrt(doc.tokens.length) || 1;
    const similarity = Math.min(1.0, dotProduct / (docNorm * 0.85));

    if (similarity >= similarityThreshold) {
      scoredResults.push({
        id: doc.id,
        source: doc.source,
        content: doc.content,
        similarity,
      });
    }
  }

  // Tri décroissant par score de similarité
  scoredResults.sort((a, b) => b.similarity - a.similarity);

  // Retourner top-k (entre 4 et 6, configuré par défaut à 5)
  return scoredResults.slice(0, maxResults);
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. FORMATAGE POUR INJECTION SOUS [CONTEXTE] DANS LE PROMPT
// ─────────────────────────────────────────────────────────────────────────────

export function formatKnowledgeForPrompt(matches: KnowledgeMatch[]): string {
  if (!matches || matches.length === 0) {
    return "[CONTEXTE]\nAucun document officiel n'a atteint le seuil de pertinence.";
  }

  let formatted = "[CONTEXTE]\n";
  for (const m of matches) {
    formatted += `Source: ${m.source} (Similarité: ${(m.similarity * 100).toFixed(1)}%)\n`;
    formatted += `Contenu: ${m.content.trim()}\n\n`;
  }

  return formatted.trim();
}
