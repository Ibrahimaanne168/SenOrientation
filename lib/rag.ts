// ============================================================================
// SENORIENTATION - PIPELINE RAG OFFICIEL SÉNÉGAL
// Routage, reformulation contextuelle, recherche vectorielle / cosinus avec seuil
// ============================================================================

import etablissementsData from "@/data/etablissements.json";
import filieresData from "@/data/filieres.json";
import concoursData from "@/data/concours.json";
import type { ConversationProfile } from "./profile";

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

const EMOTION_PATTERNS = [
  "perdu",
  "suis perdu",
  "un peu perdu",
  "ai peur",
  "peur de",
  "stresse",
  "angoisse",
  "panique",
  "suis nul",
  "suis nulle",
  "nul en",
  "nulle en",
  "y arriverai pas",
  "découragé",
  "decourage",
  "sais plus quoi",
  "sais plus trop",
];

const DONT_KNOW_PATTERNS = [
  "je ne sais pas",
  "je sais pas",
  "jsp",
  "aucune idee",
  "aucune idée",
  "je sais pas trop",
  "pas d'idee",
  "pas d'idée",
  "j'en sais rien",
  "chais pas",
];

export function detectIntent(
  message: string
): "greeting" | "gratitude" | "emotion" | "dont_know" | "query" {
  const clean = message
    .toLowerCase()
    .trim()
    .replace(/[!?,;.:/\\()]/g, "")
    .replace(/\s+/g, " ");

  // 1. Vérifier si c'est une salutation simple
  if (
    GREETING_WORDS.has(clean) ||
    clean.startsWith("bonjour ") && clean.split(" ").length <= 4 ||
    clean.startsWith("salut ") && clean.split(" ").length <= 4 ||
    clean.startsWith("bonsoir ") && clean.split(" ").length <= 4
  ) {
    return "greeting";
  }

  // 2. Vérifier si c'est un remerciement
  for (const g of GRATITUDE_WORDS) {
    if (clean === g || clean.startsWith(`${g} `) && clean.split(" ").length <= 5) {
      return "gratitude";
    }
  }

  // 3. Vérifier si l'élève exprime du doute ou du stress (Ne pas lancer de recherche RAG)
  for (const p of EMOTION_PATTERNS) {
    if (clean.includes(p)) {
      return "emotion";
    }
  }

  // 4. Vérifier si l'élève dit "je ne sais pas"
  for (const p of DONT_KNOW_PATTERNS) {
    if (clean === p || clean.startsWith(`${p} `) || clean.endsWith(` ${p}`)) {
      return "dont_know";
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

// Ingestion des concours d'excellence officiels (EPT, ESP, CESTI, EMS, ENSAE, etc.)
if (Array.isArray(concoursData)) {
  for (const c of concoursData) {
    const matieresStr = Array.isArray(c.matieres_concours)
      ? c.matieres_concours.join(", ")
      : typeof c.matieres_concours === "string"
        ? c.matieres_concours
        : "";
    const content = `CONCOURS OFFICIEL : ${c.nom_concours} (${c.organisme_organisateur})
- Domaine : ${c.domaine || "Enseignement Supérieur"}
- Niveau requis : ${c.niveau_requis || "Terminale / Baccalauréat"}
- Conditions d'accès : ${c.conditions_admission || ""}
- Période des dépôts : ${c.date_ouverture_cloture || "Entre mai et juillet"}
- Date des épreuves : ${c.date_epreuves || "Selon calendrier annuel"}
- Frais de dossier : ${c.frais_inscription || "Variables"}
- Matières au concours : ${matieresStr}
- Débouchés : ${c.debouches || ""}`;

    KNOWLEDGE_CORPUS.push({
      id: `concours_${c.id}`,
      source: "concours_officiels_senegal",
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

// ─────────────────────────────────────────────────────────────────────────────
// 7. MOTEUR DE MATCHING STRUCTURE DES FORMATIONS
// ─────────────────────────────────────────────────────────────────────────────

export interface MatchedFormation {
  id: string;
  nom: string;
  domaine: string;
  etablissements: string[];
  etablissement: string;
  localisation: string;
  diplome: string;
  duree: string;
  conditions: string;
  pourquoi: string;
  score_correspondance: number;
  debouches: string[];
  source: string;
  isAlternative?: boolean;
}

export function findMatchingFormations(profile: Partial<ConversationProfile>): MatchedFormation[] {
  if (!Array.isArray(filieresData) || filieresData.length === 0) {
    return [];
  }

  const userSerie = (profile.serie || "").toUpperCase().trim();
  const interests = [
    ...(profile.matieres_aimees || []),
    ...(profile.points_forts || []),
    ...(profile.activites || []),
    profile.projet || "",
  ]
    .join(" ")
    .toLowerCase();

  const scored: Array<{ f: typeof filieresData[0]; score: number; reason: string }> = [];

  for (const f of filieresData) {
    let score = 0;
    const reasons: string[] = [];

    // 1. Compatibilité série de bac
    const bacList = (f.bacRecommended || []).map((b: string) => b.toUpperCase());
    const isBacCompatible = userSerie ? bacList.some((b: string) => userSerie.includes(b) || b.includes(userSerie)) : true;

    if (userSerie) {
      if (isBacCompatible) {
        score += 40;
        reasons.push(`compatible avec ta série ${userSerie}`);
      } else {
        score -= 20; // pénalité sans élimination absolue
      }
    }

    // 2. Correspondance des centres d'intérêt et matières
    const fDomain = (f.domain || "").toLowerCase();
    const fTitle = (f.title || "").toLowerCase();
    const fDesc = (f.description || "").toLowerCase();

    // Détection thématique
    if (interests.includes("math") || interests.includes("calcul") || interests.includes("logique")) {
      if (fDomain.includes("sciences") || fTitle.includes("math") || fTitle.includes("informatique") || fTitle.includes("génie")) {
        score += 25;
        reasons.push("valorise ton goût pour le calcul et la logique");
      }
    }
    if (interests.includes("info") || interests.includes("code") || interests.includes("jeu") || interests.includes("fifa") || interests.includes("écran")) {
      if (fTitle.includes("informatique") || fDomain.includes("technologie") || fTitle.includes("logiciel") || fTitle.includes("télécom")) {
        score += 30;
        reasons.push("répond à ton intérêt pour les technologies et le numérique");
      }
    }
    if (interests.includes("santé") || interests.includes("médecin") || interests.includes("soign") || interests.includes("biologie") || interests.includes("svt")) {
      if (fDomain.includes("santé") || fTitle.includes("médecine") || fTitle.includes("pharmacie") || fTitle.includes("biologie")) {
        score += 30;
        reasons.push("aligné avec ta vocation pour les sciences de la santé");
      }
    }
    if (interests.includes("droit") || interests.includes("justice") || interests.includes("rédig") || interests.includes("argument") || interests.includes("écri")) {
      if (fDomain.includes("droit") || fTitle.includes("juridique") || fTitle.includes("politique") || fTitle.includes("journalisme")) {
        score += 25;
        reasons.push("mobilise tes aptitudes d'argumentation et de rédaction");
      }
    }
    if (interests.includes("gestion") || interests.includes("compta") || interests.includes("finance") || interests.includes("banque") || interests.includes("commerce")) {
      if (fDomain.includes("commerce") || fDomain.includes("gestion") || fTitle.includes("gestion") || fTitle.includes("finance")) {
        score += 25;
        reasons.push("correspond à ton intérêt pour la gestion et l'économie");
      }
    }
    if (interests.includes("bricol") || interests.includes("répar") || interests.includes("mains") || interests.includes("machine")) {
      if (fDomain.includes("ingénierie") || fDomain.includes("btp") || fTitle.includes("mécanique") || fTitle.includes("électrique")) {
        score += 25;
        reasons.push("correspond à ton profil pratique et technique");
      }
    }
    if (interests.includes("agri") || interests.includes("nature") || interests.includes("animaux") || interests.includes("eau")) {
      if (fDomain.includes("agri") || fDomain.includes("environnement") || fTitle.includes("agro")) {
        score += 25;
        reasons.push("en phase avec ton intérêt pour l'environnement et l'agronomie");
      }
    }

    // 3. Préférence géographique si précisée
    if (profile.ville) {
      const userCity = profile.ville.toLowerCase();
      const unis = (f.universities || []).join(" ").toLowerCase();
      if (unis.includes(userCity)) {
        score += 10;
        reasons.push(`disponible dans ta ville de préférence (${profile.ville})`);
      }
    }

    // 4. Pénalité pour matières fuies
    if (profile.matieres_fuies && profile.matieres_fuies.length > 0) {
      for (const mf of profile.matieres_fuies) {
        if (mf.toLowerCase().includes("math") && (fTitle.includes("math") || fTitle.includes("statistique"))) {
          score -= 30;
        }
      }
    }

    // 5. Préférence de durée d'études (formations courtes DUT/BTS/Licence pro 2 à 3 ans)
    if (
      profile.preferences_etudes?.toLowerCase().includes("court") ||
      profile.duree_souhaitee?.includes("2") ||
      profile.duree_souhaitee?.includes("3") ||
      (profile.projet && /court|dut|bts|licence pro/i.test(profile.projet))
    ) {
      if (
        (f.level && (f.level.toLowerCase().includes("dut") || f.level.toLowerCase().includes("bts") || f.level.toLowerCase().includes("licence"))) ||
        (f.duration && (f.duration.includes("2") || f.duration.includes("3"))) ||
        fTitle.includes("dut") ||
        fTitle.includes("bts")
      ) {
        score += 35;
        reasons.push("cycle court universitaire et professionnalisant (Bac+2 / Bac+3)");
      } else if (f.level && (f.level.includes("Ingénieur") || f.duration?.includes("5"))) {
        score -= 25; // Dé-priorise les filières longues de 5 ans
      }
    }

    if (score > 15) {
      scored.push({
        f,
        score,
        reason: reasons.length > 0 ? reasons.slice(0, 2).join(", ") : "En adéquation avec tes centres d'intérêt",
      });
    }
  }

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, 4).map(({ f, score, reason }, idx) => {
    const unis = Array.isArray(f.universities) ? f.universities : [];
    return {
      id: f.id,
      nom: f.title,
      domaine: f.domain,
      etablissements: unis,
      etablissement: unis[0] || "Universités du Sénégal",
      localisation: unis.join(", ") || "Sénégal",
      diplome: f.level || "Licence / Master",
      duree: f.duration || "3 à 5 ans",
      conditions: f.admissionConditions || "Campusen / Concours",
      pourquoi: reason,
      score_correspondance: Math.min(Math.round(score), 98),
      debouches: (f.careers || []).slice(0, 5),
      source: "Référentiel MESRI & Campusen Sénégal",
      isAlternative: idx >= 2,
    };
  });
}

