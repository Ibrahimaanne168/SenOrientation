// Recherche sémantique dans la base de connaissances sénégalaise (pgvector Supabase + fallback local).
import { createClient } from "./supabase/server";

export interface KnowledgeMatch {
  id?: string;
  content: string;
  source: string;
  similarity?: number;
}

// Base documentaire locale de référence (Sénégal) pour le RAG
const FALLBACK_KNOWLEDGE: KnowledgeMatch[] = [
  {
    source: "campusen_ucad",
    content: `Université Cheikh Anta Diop (UCAD, Dakar) :
- Facultés principales : FMPOS (Médecine, Pharmacie, Odontostomatologie), FST (Sciences et Technologies : Mathématiques, Physique, Chimie, Informatique), FSJP (Droit et Sciences Politiques), FLSH (Lettres et Sciences Humaines), FASEG (Sciences Économiques et de Gestion).
- Grandes Écoles : ESP (École Supérieure Polytechnique : Génie Informatique, Télécoms, Génie Civil, Génie Électrique), EBAD (Documentation et Archives), CESTI (Journalisme et Communication).
- Admission : Exclusivement via Campusen (campusen.sec.gouv.sn) sur la base des notes du Bac. Concours spécifique pour ESP, CESTI, EBAD.
- Séries privilégiées : S1/S2 pour FMPOS, FST, ESP ; L1/L2 pour FSJP, FLSH ; G/STEG pour FASEG.`,
  },
  {
    source: "campusen_ugb",
    content: `Université Gaston Berger (UGB, Saint-Louis) :
- UFR d'excellence : SAT (Sciences Appliquées et Technologies : Informatique, Maths Appliquées), SEG (Sciences Économiques et Gestion), SJP (Droit), 2S (Sciences de la Santé), CRAC (Civilisations, Religions, Arts et Communication), LSH (Lettres et Sciences Humaines).
- Institut d'ingénieurs : IPSL (Institut Polytechnique de Saint-Louis : Génie Civil, Électromécanique, Agronomie).
- Admission : Sélection Campusen très rigoureuse basée sur les moyennes obtenues au Bac sénégalais.
- Débouchés : Data analyst, développeur logiciel, magistrat, avocat d'affaires, auditeur financier, médecin, ingénieur BTP.`,
  },
  {
    source: "campusen_uam",
    content: `Université Amadou Mahtar Mbow (UAM, Diamniadio) :
- Spécialisation dans les métiers d'avenir, les sciences appliquées et les technologies innovantes.
- Écoles internes : ESMG (Mines et Géologie), ESUAA (Urbanisme et Architecture), ESI-TIC (Ingénierie des TIC, Cloud, Cybersécurité, Intelligence Artificielle), HEG (Haute École de Gestion).
- Profils cibles : Bacs scientifiques et techniques S1, S2, S3, T1, T2.
- Débouchés majeurs : Ingénieur géologue, ingénieur cybersécurité, urbaniste, architecte de données, spécialiste énergie solaire.`,
  },
  {
    source: "campusen_uidt",
    content: `Université Iba Der Thiam (UIDT, Thiès) :
- Pôles : Sciences et Technologies (Génie Informatique, Mathématiques, Électrotechnique), Santé (UFR Sciences de la Santé), Sciences Économiques et Sociales.
- Partenariats avec le tissu industriel de la région de Thiès et des transports (chemins de fer, mines).
- Séries recommandées : S1, S2, S3, T1, T2.`,
  },
  {
    source: "campusen_ussein",
    content: `Université du Sine Saloum El-Hâdj Ibrahima NIASS (USSEIN, Kaolack/Fatick/Kaffrine) :
- Vocation : Agriculture, Élevage, Pêche, Agroalimentaire et Développement Durable.
- UFR : Productions Végétales, Productions Animales, Sciences Halieutiques et Aquacoles, Transformation Agroalimentaire, Économie Rurale.
- Profils : Bacs scientifiques S1, S2 et techniques agricoles S4, S5.
- Débouchés : Ingénieur agronome, responsable de ferme moderne, expert en sécurité alimentaire, agro-entrepreneur.`,
  },
  {
    source: "bourses_dge",
    content: `Bourses Nationales de l'État du Sénégal (Direction des Bourses / DGES / MESRI) :
- Demi-bourse : 20 000 FCFA par mois (attribuée sur critères de résultats au Bac et de contingentement).
- Bourse entière : 40 000 FCFA par mois pour la Licence (revalorisée à 60 000 FCFA en Master).
- Bourse d'excellence : Destinée aux lauréats du Concours Général et aux bacheliers avec mention 'Très Bien' ou 'Bien' dans les séries S1/S2 pour des études prioritaires.
- Aides d'études : 60 000 FCFA alloués en une seule tranche annuelle pour les étudiants non boursiers en situation précaire.
- Candidature : Intégrée automatiquement ou validée via le portail officiel des bourses lié à Campusen.`,
  },
  {
    source: "campusen_procedure",
    content: `Guide officiel Campusen (Orientation Post-Bac au Sénégal) :
- Calendrier : Ouverture générale des inscriptions en ligne en août après les résultats du Bac.
- Pièces requises : Numéro de table au Baccalauréat, date de naissance, numéro d'identification national (NIN) ou pièce d'identité.
- Étapes clés : Création du compte, validation du numéro de téléphone, saisie et hiérarchisation des choix (filières publiques et privées subventionnées).
- Règle d'or : Respecter les délais stricts pour valider la proposition d'orientation reçue par SMS/Email sous peine de forclusion définitive.`,
  },
];

/**
 * Recherche les connaissances les plus pertinentes pour enrichir le prompt de l'agent (RAG)
 */
export async function searchKnowledge(query: string, maxResults = 4): Promise<KnowledgeMatch[]> {
  const lowerQuery = query.toLowerCase();

  try {
    const supabase = await createClient();

    // 1. Tenter la recherche par similarité vectorielle si une extension vectorielle / embedding existe
    const { data: vectorResults, error: rpcError } = await supabase.rpc("match_knowledge", {
      match_threshold: 0.4,
      match_count: maxResults,
    });

    if (!rpcError && Array.isArray(vectorResults) && vectorResults.length > 0) {
      return vectorResults.map((r) => ({
        id: r.id,
        content: r.content,
        source: r.source,
        similarity: r.similarity,
      }));
    }
  } catch {
    // Si Supabase RPC n'est pas disponible, on continue sur la recherche locale
  }

  // 2. Recherche textuelle sémantique de repli (scoring par mots-clés)
  const keywords = lowerQuery
    .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);

  const scored = FALLBACK_KNOWLEDGE.map((item) => {
    let score = 0;
    const contentLower = item.content.toLowerCase();
    for (const kw of keywords) {
      if (contentLower.includes(kw)) {
        score += 1;
      }
    }
    return { ...item, score };
  });

  scored.sort((a, b) => b.score - a.score);

  const matched = scored.filter((item) => item.score > 0).slice(0, maxResults);

  // Si aucun mot clé spécifique n'a matché (ex: salutation "bonjour"), retourner les éléments généraux
  if (matched.length === 0) {
    return FALLBACK_KNOWLEDGE.slice(0, 2);
  }

  return matched;
}

/**
 * Formate les extraits trouvés pour injection dans le contexte système
 */
export function formatKnowledgeForPrompt(matches: KnowledgeMatch[]): string {
  if (matches.length === 0) {
    return "Aucun document spécifique trouvé dans la base.";
  }

  return matches
    .map(
      (m, idx) =>
        `[DOCUMENT ${idx + 1} - Source: ${m.source}]\n${m.content.trim()}`
    )
    .join("\n\n---\n\n");
}
