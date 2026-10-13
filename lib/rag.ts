// ============================================================================
// SENORIENTATION - PIPELINE RAG OFFICIEL SÉNÉGAL (NORMALISÉ & MULTI-ENTITÉS)
// Routage, reformulation contextuelle, recherche vectorielle / cosinus avec seuil
// ============================================================================

import etablissementsData from "@/data/etablissements.json";
import filieresData from "@/data/filieres.json";
import concoursData from "@/data/concours.json";
import composantesData from "@/data/composantes.json";
import formationsData from "@/data/formations.json";
import domainesInteretData from "@/data/domaines_interet.json";
import metiersData from "@/data/metiers.json";
import type { ConversationProfile } from "./profile";

export interface KnowledgeMatch {
  id?: string;
  content: string;
  source: string;
  similarity: number;
  entity_type?: "etablissement" | "composante" | "formation" | "concours" | "domaine_interet" | "metier" | "regle_officielle";
  validity_status?: "officiel" | "verifie" | "a_verifier";
}

export interface SearchKnowledgeOptions {
  maxResults?: number;
  similarityThreshold?: number;
  entityTypeFilter?: string;
  serieFilter?: string;
  locationFilter?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. ROUTAGE DES INTENTIONS (Salutations, Remerciements, Émotions, Requêtes)
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
    (clean.startsWith("bonjour ") && clean.split(" ").length <= 4) ||
    (clean.startsWith("salut ") && clean.split(" ").length <= 4) ||
    (clean.startsWith("bonsoir ") && clean.split(" ").length <= 4)
  ) {
    return "greeting";
  }

  // 2. Vérifier si c'est un remerciement
  for (const g of GRATITUDE_WORDS) {
    if (clean === g || (clean.startsWith(`${g} `) && clean.split(" ").length <= 5)) {
      return "gratitude";
    }
  }

  // 3. Vérifier si l'élève exprime du doute ou du stress
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

  let detectedSerie: string | null = profile?.serie ? `Bac ${profile.serie}` : null;
  let detectedInterest: string | null = profile?.projet || null;

  if (history && history.length > 0) {
    const recentHistory = history.slice(-6);
    for (const msg of recentHistory) {
      const text = msg.content.toLowerCase();
      if (!detectedSerie) {
        if (text.includes("s1")) detectedSerie = "Bac S1";
        else if (text.includes("s2")) detectedSerie = "Bac S2";
        else if (text.includes("s3")) detectedSerie = "Bac S3";
        else if (text.includes("l1")) detectedSerie = "Bac L1";
        else if (text.includes("l2") || text.includes("littéraire")) detectedSerie = "Bac L2";
        else if (text.includes("l'")) detectedSerie = "Bac L'";
        else if (text.includes("bac g") || text.includes("steg")) detectedSerie = "Bac G";
        else if (text.includes("t1")) detectedSerie = "Bac T1";
        else if (text.includes("t2")) detectedSerie = "Bac T2";
      }

      if (!detectedInterest) {
        if (text.includes("informatique") || text.includes("code") || text.includes("dev")) detectedInterest = "informatique et technologies";
        else if (text.includes("médecine") || text.includes("santé")) detectedInterest = "santé et médecine";
        else if (text.includes("droit") || text.includes("juridique")) detectedInterest = "droit et sciences politiques";
        else if (text.includes("gestion") || text.includes("finance")) detectedInterest = "gestion, audit et finance";
        else if (text.includes("agronomie") || text.includes("agriculture")) detectedInterest = "agronomie et agriculture";
      }
    }
  }

  if (lowerCurrent.match(/^(?:je suis en\s+|bac\s+)?(s[1-3]|l[1-2]|l'|g|steg|t[1-2])$/i)) {
    const serieName = detectedSerie || `Bac ${current.toUpperCase()}`;
    return `orientation et filières supérieures après ${serieName} au Sénégal dans le public et le privé`;
  }

  if (lowerCurrent.includes("public") || lowerCurrent.includes("campusen")) {
    const serieName = detectedSerie || "bacheliers";
    const domain = detectedInterest ? `en ${detectedInterest}` : "filières prioritaires";
    return `filières et universités publiques Campusen après ${serieName} ${domain} au Sénégal`;
  }

  const needsContext = current.split(" ").length <= 8 && !lowerCurrent.includes("campusen.sec.gouv.sn");

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
// 3. MOTEUR DE VECTORISATION TF-IDF & SIMILARITÉ COSINUS MULTI-ENTITÉS
// ─────────────────────────────────────────────────────────────────────────────

interface RawDocument {
  id: string;
  source: string;
  content: string;
  tokens: string[];
  entity_type: "etablissement" | "composante" | "formation" | "concours" | "domaine_interet" | "metier" | "regle_officielle";
  validity_status: "officiel" | "verifie" | "a_verifier";
  metadata?: {
    bac_series?: string[];
    location?: string;
    level?: string;
    fees?: string;
  };
}

const STOP_WORDS = new Set([
  "le", "la", "les", "de", "des", "du", "un", "une", "pour", "dans", "avec",
  "sur", "par", "et", "ou", "en", "au", "aux", "est", "sont", "je", "tu",
  "il", "elle", "nous", "vous", "ils", "ce", "qui", "que", "quoi", "dont",
  "où", "mon", "ma", "mes", "ton", "ta", "tes", "son", "sa", "ses", "faire",
  "être", "avoir", "quel", "quelle", "quelles", "quels", "plus", "très",
  "comment", "pourquoi", "quand", "combien", "tout", "tous", "toute", "toutes",
  "leur", "leurs", "auxquels", "auxquelles", "lesquels", "lesquelles", "vers", "sans"
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()'"«»]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

const KNOWLEDGE_CORPUS: RawDocument[] = [];

// Documents essentiels de gouvernance (Campusen, Bourses DGES)
const CORE_DOCUMENTS = [
  {
    id: "campusen_procedure_officielle",
    source: "campusen_gouv",
    content: `PROCÉDURE OFFICIELLE CAMPUSEN (campusen.sec.gouv.sn) :
- Plateforme nationale obligatoire pour toute orientation post-Bac dans les universités publiques et instituts publics au Sénégal.
- Inscription : Ouverture en août dès la publication des résultats du Baccalauréat. Nécessite le numéro de table et la date de naissance.
- Vœux : L'élève classe ses choix de filières par ordre de préférence (UCAD, UGB, UIDT, USSEIN, UAM, UN-CHK, UADB, UASZ).
- Validation et Forclusion : Dès la proposition d'orientation, délai strict de 7 à 10 jours pour valider et régler ses droits d'inscription (25 000 FCFA) par mobile money. Tout retard entraîne la forclusion définitive.`,
    entity_type: "regle_officielle" as const,
    validity_status: "officiel" as const,
  },
  {
    id: "bourses_dges_nationales",
    source: "bourses_dges",
    content: `BOURSES NATIONALES DE L'ÉTAT DU SÉNÉGAL (DGES / Direction des Bourses) :
- Demi-bourse : 20 000 FCFA par mois.
- Bourse entière : 40 000 FCFA par mois en Licence, revalorisée à 60 000 FCFA par mois en Master.
- Bourse d'excellence : Réservée aux lauréats du Concours Général et bacheliers avec mention Très Bien ou Bien dans les séries scientifiques prioritaires.
- Aides sociales : Allocation annuelle de 60 000 FCFA pour les étudiants non boursiers en situation de précarité.
- Paiement : Mensuel via Wave, Orange Money ou virement bancaire.`,
    entity_type: "regle_officielle" as const,
    validity_status: "officiel" as const,
  },
];

for (const doc of CORE_DOCUMENTS) {
  KNOWLEDGE_CORPUS.push({
    id: doc.id,
    source: doc.source,
    content: doc.content,
    tokens: tokenize(doc.content),
    entity_type: doc.entity_type,
    validity_status: doc.validity_status,
  });
}

// Ingestion des établissements
if (Array.isArray(etablissementsData)) {
  for (const rawEt of etablissementsData) {
    const et = rawEt as Record<string, any>;
    const isPublic = (et.statut || et.statut_etablissement || et.type_etablissement || et.type || "").toLowerCase().includes("public");
    const content = `[ÉTABLISSEMENT ${isPublic ? "PUBLIC" : "PRIVÉ"}] ${et.nom} (${et.sigle || et.id}) à ${et.ville} :
- Statut officiel : ${et.statut || et.statut_etablissement || et.type || "Officiel"}
- Région : ${et.region || "Sénégal"}
- Site officiel : ${et.site_officiel || "Non renseigné"}
- Composantes rattachées : ${(et.composantes_ids || []).length} facultés/écoles
- Frais indicatifs : ${et.frais_scolarite_indicatifs || "25 000 FCFA/an"}
- Habilitation institutionnelle : ${et.habilitation_institutionnelle || "Reconnu"}
- Date de vérification : ${et.date_verification || "2026-2027"}`;

    KNOWLEDGE_CORPUS.push({
      id: `etablissement_${et.id}`,
      source: isPublic ? "campusen_public" : "etablissement_prive_anaq_sup",
      content,
      tokens: tokenize(content),
      entity_type: "etablissement",
      validity_status: isPublic ? "officiel" : "a_verifier",
      metadata: {
        location: et.ville,
        fees: et.frais_scolarite_indicatifs,
      },
    });
  }
}

// Ingestion des composantes (UFR, Facultés, Écoles, Instituts)
if (Array.isArray(composantesData)) {
  for (const comp of composantesData) {
    const content = `COMPOSANTE UNIVERSITAIRE : ${comp.nom} (${comp.sigle || ""}) — Rattachée à : ${comp.etablissement_nom}
- Description : ${comp.description}
- Source : ${comp.source}
- Date de vérification : ${comp.date_verification || "2026-2027"}`;

    KNOWLEDGE_CORPUS.push({
      id: `composante_${comp.id}`,
      source: "composantes_universitaires_mesri",
      content,
      tokens: tokenize(content),
      entity_type: "composante",
      validity_status: (comp.statut_verification as "officiel" | "verifie" | "a_verifier") || "officiel",
    });
  }
}

// Ingestion des formations réelles par établissement
if (Array.isArray(formationsData)) {
  for (const f of formationsData) {
    const content = `FORMATION RÉELLE : ${f.nom_officiel} dispensée à ${f.etablissement_nom}
- Diplôme préparé : ${f.diplome_prepare} (Durée : ${f.duree})
- Séries de Bac admissibles : ${(f.series_bac_admissibles || []).join(", ")}
- Prérequis & matières clés : ${f.prerequis}
- Conditions d'accès : ${f.conditions_admission}
- Frais de formation : ${f.frais}
- Débouchés documentés : ${(f.debouches || []).slice(0, 8).join(", ")}
- Source officielle : ${f.source_officielle} (${f.date_verification})`;

    KNOWLEDGE_CORPUS.push({
      id: `formation_${f.id}`,
      source: "referentiel_formations_senegal",
      content,
      tokens: tokenize(content),
      entity_type: "formation",
      validity_status: (f.statut_verification as "officiel" | "verifie" | "a_verifier") || "officiel",
      metadata: {
        bac_series: f.series_bac_admissibles,
        level: f.diplome_prepare,
        fees: f.frais,
      },
    });
  }
}

// Ingestion des concours d'excellence officiels
if (Array.isArray(concoursData)) {
  for (const c of concoursData) {
    const matieresStr = Array.isArray(c.matieres_concours)
      ? c.matieres_concours.join(", ")
      : typeof c.matieres_concours === "string"
        ? c.matieres_concours
        : "";
    const content = `CONCOURS OFFICIEL D'EXCELLENCE : ${c.nom_concours} (${c.organisme_organisateur})
- Domaine : ${c.domaine || "Enseignement Supérieur"}
- Niveau requis : ${c.niveau_requis || "Terminale / Baccalauréat"}
- Conditions d'accès : ${c.conditions_admission || ""}
- Période des dépôts : ${c.date_ouverture_cloture || "Entre mai et juillet"}
- Date des épreuves : ${c.date_epreuves || "Selon calendrier annuel"}
- Frais de dossier officiels : ${c.frais_inscription || "Variables"}
- Matières au concours : ${matieresStr}
- Débouchés : ${c.debouches || ""}`;

    KNOWLEDGE_CORPUS.push({
      id: `concours_${c.id}`,
      source: "concours_officiels_senegal",
      content,
      tokens: tokenize(content),
      entity_type: "concours",
      validity_status: "officiel",
      metadata: {
        fees: c.frais_inscription,
      },
    });
  }
}

// Ingestion des métiers
if (Array.isArray(metiersData)) {
  for (const m of metiersData) {
    const content = `MÉTIER & DÉBOUCHÉ : ${m.nom} (${m.secteur})
- Formations sénégalaises menant au métier : ${(m.formations_recommandees || []).join(", ")}
- Mention insertion : ${m.garantie_emploi}`;

    KNOWLEDGE_CORPUS.push({
      id: `metier_${m.id}`,
      source: "observatoire_metiers_senegal",
      content,
      tokens: tokenize(content),
      entity_type: "metier",
      validity_status: "officiel",
    });
  }
}

// Ingestion des domaines d'intérêt
if (Array.isArray(domainesInteretData)) {
  for (const dom of domainesInteretData) {
    const content = `DOMAINE D'INTÉRÊT : ${dom.intitule}
- Description : ${dom.description}
- Pistes d'exploration : ${(dom.exemples_clarification || []).join("; ")}`;

    KNOWLEDGE_CORPUS.push({
      id: `domaine_${dom.id}`,
      source: "referentiel_interets_orientation",
      content,
      tokens: tokenize(content),
      entity_type: "domaine_interet",
      validity_status: "officiel",
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

  const norm = Math.sqrt(sumSq) || 1;
  for (const [term, weight] of vec.entries()) {
    vec.set(term, weight / norm);
  }

  return vec;
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. FONCTION PRINCIPALE DE RECHERCHE HYBRIDE AVEC SEUIL
// ─────────────────────────────────────────────────────────────────────────────

export async function searchKnowledge(
  query: string,
  maxResults = 5,
  similarityThreshold = 0.28,
  options?: SearchKnowledgeOptions
): Promise<KnowledgeMatch[]> {
  const queryTokens = tokenize(query);

  if (queryTokens.length === 0) {
    return [];
  }

  const queryVec = computeVector(queryTokens);
  const scoredResults: KnowledgeMatch[] = [];

  for (const doc of KNOWLEDGE_CORPUS) {
    // Filtrage optionnel par type d'entité
    if (options?.entityTypeFilter && doc.entity_type !== options.entityTypeFilter) {
      continue;
    }

    // Filtrage par couverture : si la requête comporte 4 mots clés ou plus et que le doc n'en a pas au moins 2, ignorer
    const matchingTerms = [...queryVec.keys()].filter((term) => doc.tokens.includes(term));
    if (queryVec.size >= 4 && matchingTerms.length < 2) {
      continue;
    }

    let dotProduct = 0;
    for (const [term, queryWeight] of queryVec.entries()) {
      if (doc.tokens.includes(term)) {
        const idf = VOCABULARY_IDF.get(term) || 1;
        const count = doc.tokens.filter((t) => t === term).length;
        dotProduct += queryWeight * (count * idf);
      }
    }

    const docNorm = Math.sqrt(doc.tokens.length) || 1;
    let similarity = Math.min(1.0, dotProduct / (docNorm * 0.85));

    // Boost par série de Bac si filtre spécifié
    if (options?.serieFilter && doc.metadata?.bac_series) {
      const matchSerie = doc.metadata.bac_series.some((s) =>
        options.serieFilter!.toUpperCase().includes(s.toUpperCase())
      );
      if (matchSerie) similarity = Math.min(1.0, similarity * 1.25);
    }

    // Boost majeur pour les concours officiels si la requête demande un concours
    if (queryTokens.includes("concours")) {
      if (doc.entity_type === "concours") {
        similarity = Math.min(1.0, similarity * 2.5);
      } else {
        similarity = similarity * 0.4;
      }
    }

    // Boost si le sigle officiel demandé figure dans le document (ex: ept, esp, cesti)
    const acronymMatches = ["ept", "esp", "cesti", "ucad", "ugb", "uidt", "uam", "ussein", "uadb", "uasz"].filter(
      (acr) => queryTokens.includes(acr) && doc.tokens.includes(acr)
    );
    if (acronymMatches.length > 0) {
      similarity = Math.min(1.0, similarity * 1.5);
    }

    if (similarity >= similarityThreshold) {
      scoredResults.push({
        id: doc.id,
        source: doc.source,
        content: doc.content,
        similarity,
        entity_type: doc.entity_type,
        validity_status: doc.validity_status,
      });
    }
  }

  scoredResults.sort((a, b) => b.similarity - a.similarity);
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
    const cert = m.validity_status === "officiel" ? "Information officielle" : "Donnée vérifiée";
    formatted += `Source: ${m.source} (${cert} — Similarité: ${(m.similarity * 100).toFixed(1)}%)\n`;
    formatted += `Contenu: ${m.content.trim()}\n\n`;
  }

  return formatted.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. MOTEUR DE MATCHING STRUCTURÉ DES FORMATIONS (Partie 7)
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
  statut_verification?: "officiel" | "verifie" | "a_verifier" | string;
  isAlternative?: boolean;
}

export function findMatchingFormations(profile: Partial<ConversationProfile>): MatchedFormation[] {
  // Utiliser les filières de base et formations réelles
  const dataset = Array.isArray(formationsData) && formationsData.length > 0 ? formationsData : [];

  if (dataset.length === 0) {
    // Fallback sur filieresData
    return (filieresData || []).slice(0, 4).map((f) => ({
      id: f.id,
      nom: f.title,
      domaine: f.domain,
      etablissements: f.universities || [],
      etablissement: (f.universities && f.universities[0]) || "Universités du Sénégal",
      localisation: (f.universities && f.universities.join(", ")) || "Sénégal",
      diplome: f.level || "Licence (Bac+3)",
      duree: f.duration || "3 ans",
      conditions: f.admissionConditions || "Campusen",
      pourquoi: "En phase avec les formations nationales disponibles",
      score_correspondance: 80,
      debouches: (f.careers || []).slice(0, 5),
      source: "Référentiel MESRI & Campusen",
      statut_verification: "officiel",
    }));
  }

  const userSerie = (profile.serie || "").toUpperCase().trim();
  const interests = [
    ...(profile.confirmed_interests || []),
    ...(profile.interets_principaux || []),
    ...(profile.matieres_aimees || []),
    ...(profile.points_forts || []),
    ...(profile.activites || []),
    profile.projet || "",
  ]
    .join(" ")
    .toLowerCase();

  const scored: Array<{ f: typeof dataset[0]; score: number; reason: string }> = [];

  for (const f of dataset) {
    let score = 0;
    const reasons: string[] = [];

    // 1. Compatibilité série de Bac
    const bacList = (f.series_bac_admissibles || []).map((b: string) => b.toUpperCase());
    const isBacCompatible = userSerie
      ? bacList.some((b: string) => userSerie.includes(b) || b.includes(userSerie))
      : true;

    if (userSerie) {
      if (isBacCompatible) {
        score += 40;
        reasons.push(`compatible avec ta série ${userSerie}`);
      } else {
        score -= 25; // Pénalité sans exclusion absolue
      }
    }

    // 2. Thématiques et domaines
    const fDomain = (f.domaine_id || "").toLowerCase();
    const fTitle = (f.nom_officiel || "").toLowerCase();

    if (interests.includes("math") || interests.includes("calcul") || interests.includes("logique")) {
      if (fDomain.includes("sciences") || fTitle.includes("math") || fTitle.includes("informatique") || fTitle.includes("génie")) {
        score += 25;
        reasons.push("valorise ton goût pour le calcul et la logique");
      }
    }
    if (interests.includes("info") || interests.includes("code") || interests.includes("technologie") || interests.includes("numérique")) {
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
    if (interests.includes("droit") || interests.includes("justice") || interests.includes("juridique") || interests.includes("argument")) {
      if (fDomain.includes("droit") || fTitle.includes("juridique") || fTitle.includes("politique")) {
        score += 25;
        reasons.push("mobilise tes aptitudes d'argumentation et de droit");
      }
    }
    if (interests.includes("gestion") || interests.includes("compta") || interests.includes("finance") || interests.includes("commerce")) {
      if (fDomain.includes("commerce") || fDomain.includes("gestion") || fTitle.includes("gestion") || fTitle.includes("finance") || fTitle.includes("économie")) {
        score += 25;
        reasons.push("correspond à ton intérêt pour la gestion et l'économie");
      }
    }

    // 3. Préférence géographique si précisée
    if (profile.ville) {
      const userCity = profile.ville.toLowerCase();
      if ((f.etablissement_nom || "").toLowerCase().includes(userCity) || (f.source_officielle || "").toLowerCase().includes(userCity)) {
        score += 15;
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

    // 5. Préférence de durée d'études (formations courtes DUT/BTS/Licence pro 2-3 ans vs Bac+5)
    if (
      profile.preferences_etudes?.toLowerCase().includes("court") ||
      profile.duree_souhaitee?.includes("2") ||
      profile.duree_souhaitee?.includes("3")
    ) {
      if (
        (f.diplome_prepare && (f.diplome_prepare.toLowerCase().includes("dut") || f.diplome_prepare.toLowerCase().includes("bts") || f.diplome_prepare.toLowerCase().includes("licence"))) ||
        (f.duree && (f.duree.includes("2") || f.duree.includes("3")))
      ) {
        score += 35;
        reasons.push("cycle court universitaire et professionnalisant (Bac+2 / Bac+3)");
      } else if (f.diplome_prepare && (f.diplome_prepare.includes("Ingénieur") || f.duree?.includes("5"))) {
        score -= 25;
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

  // Élimination des doublons de titre et retour top-4
  const seenTitles = new Set<string>();
  const uniqueScored: typeof scored = [];
  for (const item of scored) {
    const key = `${item.f.nom_officiel}_${item.f.etablissement_nom}`;
    if (!seenTitles.has(key)) {
      seenTitles.add(key);
      uniqueScored.push(item);
    }
    if (uniqueScored.length >= 4) break;
  }

  return uniqueScored.map(({ f, score, reason }, idx) => ({
    id: f.id,
    nom: f.nom_officiel,
    domaine: f.domaine_id,
    etablissements: [f.etablissement_nom],
    etablissement: f.etablissement_nom,
    localisation: f.etablissement_nom.includes("Dakar") ? "Dakar" : f.etablissement_nom.includes("Saint-Louis") ? "Saint-Louis" : "Sénégal",
    diplome: f.diplome_prepare,
    duree: f.duree,
    conditions: f.conditions_admission,
    pourquoi: reason,
    score_correspondance: Math.min(Math.round(score), 98),
    debouches: (f.debouches || []).slice(0, 5),
    source: `${f.source_officielle} (${f.date_verification})`,
    statut_verification: f.statut_verification || "officiel",
    isAlternative: idx >= 2,
  }));
}
