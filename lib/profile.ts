// ============================================================================
// SENORIENTATION - DOSSIER CONVERSATIONNEL D'ORIENTATION PROFESSIONNELLE
// Profil évolutif, mémoire structurée, 4 niveaux de raisonnement et moteur anti-boucle
// ============================================================================

import domainesInteretData from "@/data/domaines_interet.json";

export interface Indice {
  texte: string;
  statut: "certain" | "probable" | "a_verifier";
}

export interface Hypothese {
  domaine: string;
  confiance: "faible" | "moyenne" | "forte";
}

export type IntentId =
  | "intent_demander_prenom"
  | "intent_demander_situation_scolaire"
  | "intent_reorientation"
  | "intent_post_bac_objectifs"
  | "intent_avant_bac_series"
  | "intent_clarifier_comprendre"
  | "intent_clarifier_reflechir"
  | "intent_clarifier_chiffres"
  | "intent_clarifier_aider"
  | "intent_clarifier_creer"
  | "intent_decouvrir_interets"
  | "intent_exploration_concrete"
  | "intent_approfondir_domaine"
  | "intent_matieres_preferees"
  | "intent_ambitions_pro"
  | "intent_contraintes_duree_ville"
  | "intent_presenter_bilan";

export interface PreferenceGenerale {
  type: "comprendre" | "chiffres" | "aider" | "creer" | "reflechir" | "autre";
  texte: string;
  statut: "en_clarification" | "clarifiee";
}

export interface SerieInfo {
  code: string;
  nom: string;
  description: string;
  matieres_cles: string[];
  domaines: string[];
  metiers_cibles: string[];
}

export const SERIES_SENEGAL: SerieInfo[] = [
  {
    code: "S1",
    nom: "Série S1 (Sciences exactes & Mathématiques)",
    description: "Filière d'excellence axée sur les mathématiques approfondies et la physique-chimie de haut niveau.",
    matieres_cles: ["Mathématiques", "Sciences Physiques"],
    domaines: ["Informatique & Technologies", "Ingénierie & BTP", "Recherche & Sciences"],
    metiers_cibles: ["Ingénieur en informatique / IA", "Ingénieur polytechnicien", "Data scientist", "Chercheur en sciences", "Actuaire"]
  },
  {
    code: "S2",
    nom: "Série S2 (Sciences expérimentales)",
    description: "Filière scientifique équilibrée entre SVT, sciences physiques et mathématiques.",
    matieres_cles: ["SVT (Biologie/Géologie)", "Sciences Physiques", "Mathématiques"],
    domaines: ["Médecine & Santé", "Agriculture & Environnement", "Sciences & Technologies"],
    metiers_cibles: ["Médecin", "Pharmacien", "Chirurgien-dentiste", "Ingénieur agronome", "Biologiste", "Vétérinaire"]
  },
  {
    code: "S3",
    nom: "Série S3 (Sciences et Techniques Industrielles)",
    description: "Filière technique et scientifique centrée sur la construction mécanique et l'ingénierie appliquée.",
    matieres_cles: ["Mathématiques", "Sciences Physiques", "Construction mécanique"],
    domaines: ["Ingénierie & BTP", "Industrie & Électromécanique"],
    metiers_cibles: ["Ingénieur en génie mécanique", "Ingénieur travaux publics", "Ingénieur mécatronique"]
  },
  {
    code: "L1",
    nom: "Série L1 (Lettres Classiques & Langues)",
    description: "Filière littéraire privilégiant les langues, la littérature et l'expression écrite et orale.",
    matieres_cles: ["Français", "Philosophie", "Langues vivantes (Anglais, Espagnol, Arabe)"],
    domaines: ["Communication & Médias", "Enseignement & Recherche", "Diplomatie"],
    metiers_cibles: ["Journaliste", "Diplomate", "Traducteur / Interprète", "Professeur de lettres ou langues"]
  },
  {
    code: "L2",
    nom: "Série L2 (Sciences Humaines & Sociales)",
    description: "Filière littéraire orientée vers l'histoire-géo, la philosophie et le raisonnement critique.",
    matieres_cles: ["Histoire-Géographie", "Philosophie", "Français"],
    domaines: ["Droit & Sciences Politiques", "Sciences Sociales", "Gestion des RH"],
    metiers_cibles: ["Avocat / Magistrat", "Juriste d'entreprise", "Administrateur civil", "Chargé de communication"]
  },
  {
    code: "L'",
    nom: "Série L' (Lettres & Arts)",
    description: "Filière littéraire créative accordant une large place aux arts plastiques et à la culture.",
    matieres_cles: ["Arts plastiques", "Littérature", "Philosophie"],
    domaines: ["Arts & Design", "Culture & Patrimoine", "Communication visuelle"],
    metiers_cibles: ["Designer", "Architecte d'intérieur", "Directeur artistique", "Médiateur culturel"]
  },
  {
    code: "G",
    nom: "Série G / STEG (Gestion, Comptabilité & Commerce)",
    description: "Filière technique tertiaire dédiée à la gestion, la comptabilité et l'économie d'entreprise.",
    matieres_cles: ["Comptabilité & Gestion", "Mathématiques financières", "Économie & Droit"],
    domaines: ["Commerce & Gestion", "Finance & Comptabilité"],
    metiers_cibles: ["Expert-comptable", "Contrôleur de gestion", "Banquier", "Auditeur financier", "Responsable commercial"]
  },
  {
    code: "T1",
    nom: "Série T1 (Technique Industrielle / Fabrication Mécanique)",
    description: "Filière technique industrielle axée sur l'usinage, les machines et la production.",
    matieres_cles: ["Fabrication mécanique", "Technologie", "Mathématiques"],
    domaines: ["Ingénierie & BTP", "Maintenance & Industrie"],
    metiers_cibles: ["Technicien supérieur / Ingénieur de maintenance", "Responsable de production industrielle"]
  },
  {
    code: "T2",
    nom: "Série T2 (Électrotechnique & Énergie)",
    description: "Filière technique orientée vers les installations électriques, l'énergie et l'automatisme.",
    matieres_cles: ["Électrotechnique", "Automatisme", "Physique appliquée"],
    domaines: ["Énergie & Électrotechnique", "Télécoms & Réseaux"],
    metiers_cibles: ["Ingénieur électrotechnicien", "Technicien réseaux électriques", "Spécialiste énergies renouvelables"]
  }
];

export interface ConversationProfile {
  conversation_id?: string;
  prenom?: string | null;
  niveau?: string | null; // Collège, Lycée, Terminale, Bachelier, Université, Réorientation
  serie: string | null;   // S1, S2, S3, L1, L2, L', G, T1, T2
  statut_parcours?: "avant_bac" | "bac" | "post_bac" | null; // Niveaux adaptatifs
  type_post_bac?: "reorientation" | "passerelle_poursuite" | "insertion" | null;
  series_recommandees?: string[];
  metiers_recommandes?: string[];
  interets_principaux: string[];
  interets_secondaires: string[];
  matieres_aimees: string[];
  matieres_competentes: string[];
  matieres_fuies: string[];
  points_forts: string[];
  activites: string[];
  competences_declarees: string[];
  ambitions: string[];
  preferences_etudes?: string | null; // Courte (2-3 ans) vs Longue (Bac+5)
  environnement: string[];
  projet: string | null;
  ville: string | null;
  budget: string | null;
  moyenne: number | string | null;
  duree_souhaitee: string | null;
  priorites: string[];
  freins: string[];
  questions_posees: string[]; // Historique textuel (legacy)
  domaines_explores: string[];
  formations_recommandees: string[];
  etape: number; // 1 à 5 (utilisé pour l'UI)
  current_phase: number; // 1 à 8 (Partie 5)
  current_question_id: string; // IntentId
  questions_asked: string[]; // Liste ordonnée des IntentIds
  questions_answered: Record<string, string>; // IntentId -> Réponse captée
  known_facts: Record<string, any>;
  unresolved_questions: string[];
  preference_generale?: PreferenceGenerale | null;
  explored_interests: string[];
  confirmed_interests: string[];
  tentative_hypotheses: string[];
  rejected_or_corrected_hypotheses: string[];
  profile_completeness: number; // 0 à 100%
  recommendations_already_shown: string[];
  last_assistant_message?: string;
  conversation_status: "en_cours" | "bilan_propose" | "demande_directe_repondue" | "termine";
  nb_je_ne_sais_pas: number;
  indices?: Indice[];
  hypotheses?: Hypothese[];
}

export const INITIAL_PROFILE: ConversationProfile = {
  prenom: null,
  niveau: null,
  serie: null,
  statut_parcours: null,
  type_post_bac: null,
  series_recommandees: [],
  metiers_recommandes: [],
  interets_principaux: [],
  interets_secondaires: [],
  matieres_aimees: [],
  matieres_competentes: [],
  matieres_fuies: [],
  points_forts: [],
  activites: [],
  competences_declarees: [],
  ambitions: [],
  preferences_etudes: null,
  environnement: [],
  projet: null,
  ville: null,
  budget: null,
  moyenne: null,
  duree_souhaitee: null,
  priorites: [],
  freins: [],
  questions_posees: [],
  domaines_explores: [],
  formations_recommandees: [],
  etape: 1,
  current_phase: 1,
  current_question_id: "intent_demander_prenom",
  questions_asked: [],
  questions_answered: {},
  known_facts: {},
  unresolved_questions: [],
  preference_generale: null,
  explored_interests: [],
  confirmed_interests: [],
  tentative_hypotheses: [],
  rejected_or_corrected_hypotheses: [],
  profile_completeness: 0,
  recommendations_already_shown: [],
  conversation_status: "en_cours",
  nb_je_ne_sais_pas: 0,
  indices: [],
  hypotheses: [],
};

// ─────────────────────────────────────────────────────────────────────────────
// CALCUL DU NIVEAU DE COMPLÉTUDE DU PROFIL (Partie 4.1)
// ─────────────────────────────────────────────────────────────────────────────
export function calculateCompleteness(p: ConversationProfile): number {
  let score = 0;
  if (p.prenom && p.prenom !== "l'ami") score += 10;
  if (p.niveau || p.statut_parcours) score += 15;
  if (p.serie || p.statut_parcours === "avant_bac") score += 20;
  if (p.confirmed_interests.length > 0 || p.interets_principaux.length > 0) score += 25;
  if (p.matieres_aimees.length > 0 || p.points_forts.length > 0) score += 15;
  if (p.preferences_etudes || p.duree_souhaitee) score += 10;
  if (p.ville || p.budget) score += 5;
  return Math.min(100, score);
}

// ─────────────────────────────────────────────────────────────────────────────
// DÉTECTION DES PRÉFÉRENCES GÉNÉRALES (Niveau 1 — Partie 3.1 & 3.2)
// ─────────────────────────────────────────────────────────────────────────────
function detectGeneralPreference(text: string): PreferenceGenerale | null {
  const t = text.toLowerCase();
  if (
    t.includes("comprendre les choses") ||
    t.includes("comprendre comment") ||
    t.includes("comprendre le fonctionnement") ||
    t.includes("comprendre le monde") ||
    (t.includes("comprendre") && !t.includes("informatique") && !t.includes("math"))
  ) {
    return { type: "comprendre", texte: "comprendre le fonctionnement des choses", statut: "en_clarification" };
  }
  if (
    t.includes("réfléchir") ||
    t.includes("reflechir") ||
    t.includes("penser") ||
    t.includes("cogiter")
  ) {
    return { type: "reflechir", texte: "réfléchir et analyser", statut: "en_clarification" };
  }
  if (
    t.includes("chiffres") ||
    t.includes("les nombres") ||
    (t.includes("calcul") && !t.includes("cours de math"))
  ) {
    return { type: "chiffres", texte: "travailler avec les chiffres", statut: "en_clarification" };
  }
  if (
    t.includes("aider les gens") ||
    t.includes("aider les personnes") ||
    t.includes("aider les autres") ||
    t.includes("accompagner les gens")
  ) {
    return { type: "aider", texte: "aider et accompagner les personnes", statut: "en_clarification" };
  }
  if (
    t.includes("créer") ||
    t.includes("creer") ||
    t.includes("inventer") ||
    t.includes("concevoir des choses")
  ) {
    return { type: "creer", texte: "créer et concevoir", statut: "en_clarification" };
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// FUSION DES MISES À JOUR DU DOSSIER
// ─────────────────────────────────────────────────────────────────────────────
export function mergeProfileUpdate(
  current: ConversationProfile,
  update?: Partial<ConversationProfile> | null,
  suggestedEtape?: number
): ConversationProfile {
  if (!update) return current;

  const merged: ConversationProfile = {
    ...current,
    prenom: update.prenom || current.prenom,
    niveau: update.niveau || current.niveau,
    serie: update.serie || current.serie,
    statut_parcours: update.statut_parcours || current.statut_parcours,
    type_post_bac: update.type_post_bac || current.type_post_bac,
    series_recommandees: Array.from(
      new Set([...(current.series_recommandees || []), ...(update.series_recommandees || [])])
    ).filter(Boolean),
    metiers_recommandes: Array.from(
      new Set([...(current.metiers_recommandes || []), ...(update.metiers_recommandes || [])])
    ).filter(Boolean),
    projet: update.projet || current.projet,
    ville: update.ville || current.ville,
    budget: update.budget || current.budget,
    moyenne: update.moyenne || current.moyenne,
    duree_souhaitee: update.duree_souhaitee || current.duree_souhaitee,
    preferences_etudes: update.preferences_etudes || current.preferences_etudes,
    interets_principaux: Array.from(
      new Set([...(current.interets_principaux || []), ...(update.interets_principaux || [])])
    ).filter(Boolean),
    interets_secondaires: Array.from(
      new Set([...(current.interets_secondaires || []), ...(update.interets_secondaires || [])])
    ).filter(Boolean),
    confirmed_interests: Array.from(
      new Set([...(current.confirmed_interests || []), ...(update.confirmed_interests || [])])
    ).filter(Boolean),
    explored_interests: Array.from(
      new Set([...(current.explored_interests || []), ...(update.explored_interests || [])])
    ).filter(Boolean),
    matieres_aimees: Array.from(
      new Set([...(current.matieres_aimees || []), ...(update.matieres_aimees || [])])
    ).filter(Boolean),
    matieres_competentes: Array.from(
      new Set([...(current.matieres_competentes || []), ...(update.matieres_competentes || [])])
    ).filter(Boolean),
    matieres_fuies: Array.from(
      new Set([...(current.matieres_fuies || []), ...(update.matieres_fuies || [])])
    ).filter(Boolean),
    points_forts: Array.from(
      new Set([...(current.points_forts || []), ...(update.points_forts || [])])
    ).filter(Boolean),
    activites: Array.from(
      new Set([...(current.activites || []), ...(update.activites || [])])
    ).filter(Boolean),
    competences_declarees: Array.from(
      new Set([...(current.competences_declarees || []), ...(update.competences_declarees || [])])
    ).filter(Boolean),
    ambitions: Array.from(
      new Set([...(current.ambitions || []), ...(update.ambitions || [])])
    ).filter(Boolean),
    questions_asked: Array.from(
      new Set([...(current.questions_asked || []), ...(update.questions_asked || [])])
    ).filter(Boolean),
    questions_answered: {
      ...(current.questions_answered || {}),
      ...(update.questions_answered || {}),
    },
    known_facts: {
      ...(current.known_facts || {}),
      ...(update.known_facts || {}),
    },
    indices: update.indices || current.indices || [],
    hypotheses: update.hypotheses || current.hypotheses || [],
    preference_generale: update.preference_generale !== undefined ? update.preference_generale : current.preference_generale,
    nb_je_ne_sais_pas: update.nb_je_ne_sais_pas !== undefined ? update.nb_je_ne_sais_pas : current.nb_je_ne_sais_pas,
    current_phase: update.current_phase || current.current_phase || 1,
    current_question_id: update.current_question_id || current.current_question_id || "intent_demander_prenom",
    conversation_status: update.conversation_status || current.conversation_status || "en_cours",
  };

  merged.profile_completeness = calculateCompleteness(merged);
  merged.etape = Math.min(
    5,
    Math.max(current.etape || 1, suggestedEtape || update.etape || (merged.profile_completeness > 70 ? 5 : merged.profile_completeness > 45 ? 4 : merged.profile_completeness > 25 ? 3 : merged.profile_completeness > 10 ? 2 : 1))
  );

  return merged;
}

// ─────────────────────────────────────────────────────────────────────────────
// ANALYSE HEURISTIQUE DES MESSAGES & ACTUALISATION D'ÉTAT (Parties 3, 4 & 5)
// ─────────────────────────────────────────────────────────────────────────────
export function heuristicUpdateProfile(
  arg1: ConversationProfile | string,
  arg2?: { role: string; content: string }[] | ConversationProfile | string,
  arg3?: string | { role: string; content: string }[] | ConversationProfile
): ConversationProfile {
  let current: ConversationProfile;
  let history: { role: string; content: string }[] = [];
  let latestMessage = "";

  if (typeof arg1 === "string") {
    latestMessage = arg1;
    if (Array.isArray(arg2)) {
      history = arg2;
      current = (typeof arg3 === "object" && arg3 !== null && !Array.isArray(arg3))
        ? (arg3 as ConversationProfile)
        : INITIAL_PROFILE;
    } else if (typeof arg2 === "object" && arg2 !== null && !Array.isArray(arg2)) {
      current = arg2 as ConversationProfile;
      if (Array.isArray(arg3)) history = arg3;
    } else {
      current = (typeof arg3 === "object" && arg3 !== null && !Array.isArray(arg3))
        ? (arg3 as ConversationProfile)
        : INITIAL_PROFILE;
    }
  } else {
    current = arg1 || INITIAL_PROFILE;
    if (Array.isArray(arg2)) {
      history = arg2;
      latestMessage = typeof arg3 === "string" ? arg3 : "";
    } else if (typeof arg2 === "string") {
      latestMessage = arg2;
      if (Array.isArray(arg3)) history = arg3;
    } else {
      latestMessage = typeof arg3 === "string" ? arg3 : "";
    }
  }

  const profile: ConversationProfile = {
    ...current,
    interets_principaux: [...(current.interets_principaux || [])],
    interets_secondaires: [...(current.interets_secondaires || [])],
    confirmed_interests: [...(current.confirmed_interests || [])],
    explored_interests: [...(current.explored_interests || [])],
    matieres_aimees: [...(current.matieres_aimees || [])],
    matieres_competentes: [...(current.matieres_competentes || [])],
    matieres_fuies: [...(current.matieres_fuies || [])],
    points_forts: [...(current.points_forts || [])],
    activites: [...(current.activites || [])],
    competences_declarees: [...(current.competences_declarees || [])],
    ambitions: [...(current.ambitions || [])],
    questions_asked: [...(current.questions_asked || [])],
    questions_answered: { ...(current.questions_answered || {}) },
    known_facts: { ...(current.known_facts || {}) },
    indices: [...(current.indices || [])],
    hypotheses: [...(current.hypotheses || [])],
    rejected_or_corrected_hypotheses: [...(current.rejected_or_corrected_hypotheses || [])],
    recommendations_already_shown: [...(current.recommendations_already_shown || [])],
  };

  const latestLower = latestMessage.toLowerCase().trim();
  const text = (history.map((h) => h.content).join(" ") + " " + latestMessage).toLowerCase();

  // 1. Détection de "Je ne sais pas" (Partie 4.3)
  if (
    latestLower === "je ne sais pas" ||
    latestLower === "je sais pas" ||
    latestLower === "jsp" ||
    latestLower === "aucune idée" ||
    latestLower === "aucune idee" ||
    latestLower.includes("je ne sais pas encore") ||
    latestLower.includes("je suis perdu")
  ) {
    profile.nb_je_ne_sais_pas = (profile.nb_je_ne_sais_pas || 0) + 1;
  }

  // 2. Gestion des changements d'avis (Partie 9 — Test 10)
  if (
    latestLower.includes("ne veux plus") ||
    latestLower.includes("change d'avis") ||
    latestLower.includes("en fait je préfère") ||
    latestLower.includes("finalement") ||
    latestLower.includes("plutôt que")
  ) {
    if (latestLower.includes("santé") || latestLower.includes("médecine")) {
      profile.interets_principaux = profile.interets_principaux.filter((i) => !i.includes("Santé") && !i.includes("Médecine"));
      profile.confirmed_interests = profile.confirmed_interests.filter((i) => !i.includes("Santé") && !i.includes("Médecine"));
      if (!profile.rejected_or_corrected_hypotheses.includes("Médecine & Santé")) {
        profile.rejected_or_corrected_hypotheses.push("Médecine & Santé");
      }
    }
    if (latestLower.includes("informatique") || latestLower.includes("numérique")) {
      profile.interets_principaux = profile.interets_principaux.filter((i) => !i.includes("Informatique"));
      profile.confirmed_interests = profile.confirmed_interests.filter((i) => !i.includes("Informatique"));
      if (!profile.rejected_or_corrected_hypotheses.includes("Informatique & Technologies")) {
        profile.rejected_or_corrected_hypotheses.push("Informatique & Technologies");
      }
    }
  }

  // 3. Extraction du prénom
  if (!profile.prenom) {
    if (
      latestLower.includes("préfère ne pas le dire") ||
      latestLower.includes("prefere pas") ||
      latestLower.includes("anonyme")
    ) {
      profile.prenom = "l'ami";
      profile.questions_answered["intent_demander_prenom"] = "anonyme";
    } else {
      const explicitMatch = latestMessage.match(
        /(?:je m['’]appelle|moi c['’]est|mon pr[ée]nom est|mon nom est|c['’]est)\s+([A-Za-zÀ-ÿ\-]+(?:\s+[A-Za-zÀ-ÿ\-]+)?)/i
      );
      if (explicitMatch && explicitMatch[1]) {
        let candidate = explicitMatch[1].trim();
        // Éliminer les mots de liaison comme "Amadou et", "Fatou je"
        candidate = candidate.replace(/\s+(?:et|je|j'|de|du|qui|moi|suis|dans)$/i, "").trim();
        const candLower = candidate.toLowerCase();
        if (
          !candLower.includes("bac") &&
          !candLower.includes("terminale") &&
          !candLower.includes("perdu") &&
          !candLower.includes("élève")
        ) {
          profile.prenom = candidate.charAt(0).toUpperCase() + candidate.slice(1);
          profile.questions_answered["intent_demander_prenom"] = profile.prenom;
        }
      } else if (
        history.length <= 2 &&
        !latestLower.includes("bonjour") &&
        !latestLower.includes("salut") &&
        !latestLower.includes("s1") &&
        !latestLower.includes("s2") &&
        !latestLower.includes("l1") &&
        !latestLower.includes("l2") &&
        !latestLower.includes("bac") &&
        !latestLower.includes("terminale")
      ) {
        const cleanName = latestMessage.replace(/[.!?,]/g, "").trim();
        const words = cleanName.split(/\s+/);
        if (words.length >= 1 && words.length <= 3 && words.every((w) => /^[A-Za-zÀ-ÿ\-]+$/.test(w))) {
          profile.prenom = words.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
          profile.questions_answered["intent_demander_prenom"] = profile.prenom;
        }
      }
    }
  }

  // 4. Détection du statut de parcours et niveau scolaire
  if (!profile.statut_parcours || !profile.niveau) {
    if (
      text.includes("réorient") ||
      text.includes("changer de filière") ||
      text.includes("changement de parcours") ||
      text.includes("erreur campusen") ||
      text.includes("l1 difficile")
    ) {
      profile.niveau = "Réorientation / Étudiant";
      profile.statut_parcours = "post_bac";
      profile.type_post_bac = "reorientation";
      profile.questions_answered["intent_demander_situation_scolaire"] = "Réorientation";
    } else if (
      text.includes("collège") ||
      text.includes("college") ||
      text.includes("bfem") ||
      text.includes("classe de 3e") ||
      text.includes("classe de 3ème") ||
      text.includes("en 3e") ||
      text.includes("en 3ème") ||
      text.includes("troisième") ||
      text.includes("troisieme")
    ) {
      profile.niveau = "Collège (3e / BFEM)";
      profile.statut_parcours = "avant_bac";
      profile.questions_answered["intent_demander_situation_scolaire"] = "Collège (3e / BFEM)";
    } else if (
      (text.includes("seconde") ||
        text.includes("2nde") ||
        text.includes("classe de première") ||
        text.includes("classe de premiere") ||
        (text.includes("première") && !text.includes("première année")) ||
        (text.includes("premiere") && !text.includes("premiere annee")) ||
        text.includes("1ère s") ||
        text.includes("1ère l") ||
        text.includes("1ere s") ||
        text.includes("1ere l") ||
        (text.includes("lycée") && !text.includes("terminale") && !text.includes("bac"))) &&
      !text.includes("première année") &&
      !text.includes("premiere annee")
    ) {
      profile.niveau = "Lycée (Seconde / Première)";
      profile.statut_parcours = "avant_bac";
      profile.questions_answered["intent_demander_situation_scolaire"] = "Lycée (Seconde / Première)";
    } else if (
      text.includes("passerelle") ||
      text.includes("après dut") ||
      text.includes("après bts") ||
      text.includes("après ma licence") ||
      text.includes("poursuite") ||
      text.includes("faire un master")
    ) {
      profile.niveau = "Université / Poursuite d'études";
      profile.statut_parcours = "post_bac";
      profile.type_post_bac = "passerelle_poursuite";
      profile.questions_answered["intent_demander_situation_scolaire"] = "Poursuite d'études";
    } else if (
      text.includes("l1") ||
      text.includes("l2") ||
      text.includes("l3") ||
      text.includes("licence") ||
      text.includes("étudiant") ||
      text.includes("etudiant") ||
      text.includes("université") ||
      text.includes("fac")
    ) {
      profile.niveau = "Université / Post-bac";
      profile.statut_parcours = "post_bac";
      profile.questions_answered["intent_demander_situation_scolaire"] = "Université";
    } else if (text.includes("terminale") || text.includes("tle")) {
      profile.niveau = "Terminale";
      profile.statut_parcours = "bac";
      profile.questions_answered["intent_demander_situation_scolaire"] = "Terminale";
    } else if (text.includes("nouveau bachelier") || text.includes("bachelier") || text.includes("ai eu mon bac")) {
      profile.niveau = "Nouveau Bachelier";
      profile.statut_parcours = "bac";
      profile.questions_answered["intent_demander_situation_scolaire"] = "Nouveau Bachelier";
    }
  }

  // 5. Détection de la série (si au lycée, terminale ou post-bac)
  if (!profile.serie) {
    if (/\b(s1)\b/i.test(text)) profile.serie = "S1";
    else if (/\b(s2)\b/i.test(text)) profile.serie = "S2";
    else if (/\b(s3)\b/i.test(text)) profile.serie = "S3";
    else if (/\b(l1)\b/i.test(text)) profile.serie = "L1";
    else if (/\b(l2)\b/i.test(text) || text.includes("littéraire")) profile.serie = "L2";
    else if (text.includes("l'")) profile.serie = "L'";
    else if (/\b(steg|bac\s*g|terminale\s*g|série\s*g|série\s*de\s*bac\s*g|\bg\b)/i.test(text)) profile.serie = "G";
    else if (/\b(t1)\b/i.test(text)) profile.serie = "T1";
    else if (/\b(t2)\b/i.test(text)) profile.serie = "T2";

    if (profile.serie) {
      profile.questions_answered["intent_demander_situation_scolaire"] = `${profile.niveau || "Bac"} ${profile.serie}`;
      if (!profile.statut_parcours) {
        profile.statut_parcours = "bac";
      }
    }
  }

  // 6. Gestion du Niveau 1 : Préférence générale (Partie 3.1 & 3.2)
  // RÈGLE ABSOLUE : Si l'utilisateur exprime une préférence générale, ne PAS affecter de domaine directement
  const genPref = detectGeneralPreference(latestMessage);
  if (profile.preference_generale && profile.preference_generale.statut === "en_clarification") {
    // L'utilisateur répond à la question de clarification (Niveau 2 : Type d'activité)
    profile.preference_generale.statut = "clarifiee";
    profile.questions_answered[`intent_clarifier_${profile.preference_generale.type}`] = latestMessage;

    // Déduction de l'activité clarifiée (Niveau 2 -> Niveau 3)
    if (profile.preference_generale.type === "comprendre") {
      if (latestLower.includes("machine") || latestLower.includes("objet") || latestLower.includes("mécanique")) {
        profile.activites.push("Comprendre le fonctionnement des machines et objets techniques");
        profile.confirmed_interests.push("Ingénierie & BTP");
      } else if (latestLower.includes("nature") || latestLower.includes("phénomène") || latestLower.includes("biologie") || latestLower.includes("science")) {
        profile.activites.push("Comprendre les phénomènes naturels et la biologie");
        profile.confirmed_interests.push("Sciences & Technologies");
      } else if (latestLower.includes("humain") || latestLower.includes("société") || latestLower.includes("pensent")) {
        profile.activites.push("Comprendre le comportement humain et la société");
        profile.confirmed_interests.push("Droit, Lettres & Sciences Sociales");
      } else if (latestLower.includes("problème") || latestLower.includes("logique") || latestLower.includes("calcul")) {
        profile.points_forts.push("Résolution de problèmes logiques");
        profile.confirmed_interests.push("Informatique & Technologies");
      }
    } else if (profile.preference_generale.type === "chiffres") {
      if (latestLower.includes("finance") || latestLower.includes("gestion") || latestLower.includes("compta") || latestLower.includes("banque")) {
        profile.confirmed_interests.push("Commerce & Gestion");
      } else if (latestLower.includes("statistique") || latestLower.includes("données") || latestLower.includes("data")) {
        profile.confirmed_interests.push("Statistique & Analyse de données");
      } else if (latestLower.includes("math") || latestLower.includes("pur") || latestLower.includes("calcul")) {
        profile.confirmed_interests.push("Mathématiques & Sciences");
      } else if (latestLower.includes("économie") || latestLower.includes("commerce")) {
        profile.confirmed_interests.push("Sciences Économiques");
      }
    } else if (profile.preference_generale.type === "aider") {
      if (latestLower.includes("santé") || latestLower.includes("soin") || latestLower.includes("médic")) {
        profile.confirmed_interests.push("Médecine & Santé");
      } else if (latestLower.includes("enseign") || latestLower.includes("transmett") || latestLower.includes("prof")) {
        profile.confirmed_interests.push("Enseignement & Recherche");
      } else if (latestLower.includes("droit") || latestLower.includes("justice") || latestLower.includes("conseil")) {
        profile.confirmed_interests.push("Droit & Sciences Politiques");
      } else if (latestLower.includes("social") || latestLower.includes("écout")) {
        profile.confirmed_interests.push("Action Sociale & Accompagnement");
      }
    }
  } else if (genPref && !profile.preference_generale) {
    profile.preference_generale = genPref;
  }

  // 7. Détection des grands domaines confirmés si mention explicite (Niveau 3)
  const DOMAIN_EXPLICIT_MAP: Record<string, string> = {
    informatique: "Informatique & Technologies",
    "programmation informatique": "Informatique & Technologies",
    logiciel: "Informatique & Technologies",
    cybersécurité: "Informatique & Technologies",
    santé: "Médecine & Santé",
    médecine: "Médecine & Santé",
    biologie: "Médecine & Santé",
    pharmacie: "Médecine & Santé",
    droit: "Droit & Sciences Politiques",
    commerce: "Commerce & Gestion",
    gestion: "Commerce & Gestion",
    comptabilité: "Commerce & Gestion",
    finance: "Commerce & Gestion",
    journalisme: "Communication & Médias",
    agronomie: "Agriculture & Environnement",
    agriculture: "Agriculture & Environnement",
    bâtiment: "Ingénierie & BTP",
    "génie civil": "Ingénierie & BTP",
  };

  for (const [key, domain] of Object.entries(DOMAIN_EXPLICIT_MAP)) {
    // Si l'élève a expressément rejeté ce domaine, ne JAMAIS le réassigner
    if (profile.rejected_or_corrected_hypotheses.includes(domain)) {
      continue;
    }
    // Ne pas ajouter le domaine si mentionné dans une formule de rejet
    if (
      latestLower.includes(`ne veux plus de ${key}`) ||
      latestLower.includes(`ne veux plus faire de ${key}`) ||
      latestLower.includes(`pas de ${key}`) ||
      latestLower.includes(`abandonne ${key}`)
    ) {
      continue;
    }
    if (text.includes(key) && !profile.interets_principaux.includes(domain)) {
      profile.interets_principaux.push(domain);
      if (!profile.confirmed_interests.includes(domain)) {
        profile.confirmed_interests.push(domain);
      }
      profile.questions_answered["intent_decouvrir_interets"] = domain;
    }
  }

  // 8. Matières aimées et compétences déclarées (Partie 5 — Phase 4)
  const MATIERES_MAP: Record<string, string> = {
    math: "Mathématiques",
    physique: "Sciences Physiques",
    chimie: "Chimie",
    svt: "SVT / Biologie",
    biologie: "SVT / Biologie",
    philo: "Philosophie",
    francais: "Français",
    français: "Français",
    anglais: "Anglais",
    histoire: "Histoire-Géographie",
    économie: "Économie",
    gestion: "Gestion",
  };

  for (const [key, label] of Object.entries(MATIERES_MAP)) {
    if (text.includes(`fuis ${key}`) || text.includes(`déteste ${key}`) || text.includes(`nul en ${key}`)) {
      if (!profile.matieres_fuies.includes(label)) profile.matieres_fuies.push(label);
    } else if (text.includes(`à l'aise en ${key}`) || text.includes(`bon en ${key}`) || text.includes(`fort en ${key}`)) {
      if (!profile.matieres_competentes.includes(label)) profile.matieres_competentes.push(label);
      if (!profile.matieres_aimees.includes(label)) profile.matieres_aimees.push(label);
      profile.questions_answered["intent_matieres_preferees"] = label;
    } else if (text.includes(key) && !profile.matieres_aimees.includes(label) && !profile.matieres_fuies.includes(label)) {
      profile.matieres_aimees.push(label);
      profile.questions_answered["intent_matieres_preferees"] = label;
    }
  }

  // 9. Moyenne scolaire déclarée
  if (!profile.moyenne) {
    const moyMatch =
      text.match(/(?:avec|environ|eu|ma|de)\s+(\d{1,2}(?:[.,]\d+)?)(?:\s*(?:\/20|de moyenne|moyenne))/i) ||
      text.match(/(\d{1,2}(?:[.,]\d+)?)\s*(?:\/20|de moyenne)/i) ||
      text.match(/\bmoyenne\s*(?:de|est|:)?\s*(\d{1,2}(?:[.,]\d+)?)/i);
    if (moyMatch && moyMatch[1]) {
      profile.moyenne = moyMatch[1].replace(",", ".");
    }
  }

  // 10. Contraintes et préférences d'études (Partie 5 — Phase 6)
  if (text.includes("courte") || text.includes("dut") || text.includes("bts") || text.includes("licence pro") || text.includes("2 ans") || text.includes("3 ans")) {
    profile.preferences_etudes = "Courte (Bac+2 / Bac+3)";
    profile.duree_souhaitee = "2 à 3 ans";
    profile.questions_answered["intent_contraintes_duree_ville"] = "Courte (2-3 ans)";
  } else if (text.includes("longue") || text.includes("master") || text.includes("ingénieur") || text.includes("bac+5") || text.includes("doctorat")) {
    profile.preferences_etudes = "Longue (Bac+5 et plus)";
    profile.duree_souhaitee = "5 ans";
    profile.questions_answered["intent_contraintes_duree_ville"] = "Longue (Bac+5)";
  }

  if (!profile.ville) {
    if (text.includes("dakar")) profile.ville = "Dakar";
    else if (text.includes("saint-louis") || text.includes("saint louis")) profile.ville = "Saint-Louis";
    else if (text.includes("thiès") || text.includes("thies")) profile.ville = "Thiès";
  }

  if (!profile.budget) {
    if (text.includes("public") || text.includes("campusen") || text.includes("25 000")) {
      profile.budget = "Public Campusen (25 000 FCFA/an)";
    } else if (text.includes("privé") || text.includes("prive")) {
      profile.budget = "Établissement privé accrédité";
    }
  }

  profile.profile_completeness = calculateCompleteness(profile);

  // Synchronisation avec l'étape UI (1 à 5)
  if (profile.profile_completeness >= 75) {
    profile.etape = 5;
    profile.current_phase = 8;
  } else if (profile.profile_completeness >= 50) {
    profile.etape = 4;
    profile.current_phase = 6;
  } else if (profile.profile_completeness >= 30) {
    profile.etape = 3;
    profile.current_phase = 4;
  } else if (profile.profile_completeness >= 15) {
    profile.etape = 2;
    profile.current_phase = 2;
  } else {
    profile.etape = 1;
    profile.current_phase = 1;
  }

  return profile;
}

// ─────────────────────────────────────────────────────────────────────────────
// MOTEUR DE DÉCISION ANTI-BOUCLE ET SÉLECTION DE LA QUESTION (Parties 3, 4 & 5)
// ─────────────────────────────────────────────────────────────────────────────
export interface OrientationDecision {
  type: "question" | "bilan";
  intent_id: IntentId;
  question: string;
  suggestions: string[];
  vise: string;
  phase: number;
  etape: number;
}

export function getNextOrientationQuestion(profile: ConversationProfile): OrientationDecision {
  const namePart = profile.prenom && profile.prenom !== "l'ami" ? profile.prenom : "";
  const nameGreet = namePart ? `${namePart}, ` : "";
  const lastAskedIntent = profile.questions_asked[profile.questions_asked.length - 1];

  // RÈGLE ANTI-BOUCLE : Ne jamais poser deux fois consécutivement la même intention
  const isAsked = (intent: IntentId) =>
    profile.questions_asked.includes(intent) && Boolean(profile.questions_answered[intent]);

  // ── PRIORITÉ 1 ABSOLUE : CLARIFICATION DES PRÉFÉRENCES GÉNÉRALES (Parties 3.1 & 3.3) ──
  // Si l'utilisateur a exprimé une préférence générale de Niveau 1, lever l'ambiguïté avant toute orientation
  if (profile.preference_generale && profile.preference_generale.statut === "en_clarification") {
    const pType = profile.preference_generale.type;
    const intentClarif: IntentId = `intent_clarifier_${pType}` as IntentId;

    if (lastAskedIntent !== intentClarif) {
      if (pType === "comprendre") {
        return {
          type: "question",
          intent_id: "intent_clarifier_comprendre",
          question: "C'est intéressant. Quand tu dis que tu aimes comprendre les choses, tu parles plutôt de comprendre comment fonctionnent les objets et les machines, pourquoi certains phénomènes naturels ou biologiques se produisent, comment les gens pensent et la société fonctionne, ou comment résoudre des problèmes ?",
          suggestions: [
            "Le fonctionnement des machines et objets",
            "Les phénomènes naturels et la biologie",
            "Le comportement humain et la société",
            "Résoudre des problèmes logiques",
          ],
          vise: "Clarifier la préférence générale 'comprendre' sans conclure prématurément",
          phase: 3,
          etape: 2,
        };
      }

      if (pType === "reflechir") {
        return {
          type: "question",
          intent_id: "intent_clarifier_reflechir",
          question: "Quel type de réflexion apprécies-tu le plus au quotidien : résoudre des problèmes logiques et scientifiques, analyser des idées et des textes, ou réfléchir à comment organiser des projets réels ?",
          suggestions: [
            "Problèmes logiques et calculs",
            "Analyser des idées et argumenter",
            "Organiser et planifier des projets",
            "Je ne sais pas encore",
          ],
          vise: "Clarifier la préférence générale 'réfléchir'",
          phase: 3,
          etape: 2,
        };
      }

      if (pType === "chiffres") {
        return {
          type: "question",
          intent_id: "intent_clarifier_chiffres",
          question: "Les chiffres ouvrent beaucoup de voies différentes. Ce qui t'attire le plus, c'est le calcul et la logique pure (maths), la finance et la comptabilité en entreprise, l'analyse de données (statistique), ou l'économie générale ?",
          suggestions: [
            "Mathématiques et logique pure",
            "Finance, gestion et comptabilité",
            "Statistiques et analyse de données",
            "Économie et commerce",
          ],
          vise: "Clarifier la passion pour les chiffres sans présumer d'un domaine",
          phase: 3,
          etape: 2,
        };
      }

      if (pType === "aider") {
        return {
          type: "question",
          intent_id: "intent_clarifier_aider",
          question: "Aider les autres est une belle motivation. Pour toi, cela passe plutôt par soigner des personnes et veiller sur la santé, enseigner et transmettre du savoir, conseiller et défendre des droits (justice), ou accompagner des personnes dans le travail social ?",
          suggestions: [
            "Soins médicaux et santé",
            "Enseigner et transmettre",
            "Défendre les droits et conseiller",
            "Accompagnement social et écoute",
          ],
          vise: "Clarifier la volonté d'aider sans la restreindre à la médecine",
          phase: 3,
          etape: 2,
        };
      }

      if (pType === "creer") {
        return {
          type: "question",
          intent_id: "intent_clarifier_creer",
          question: "La création prend plein de formes. Préfères-tu concevoir des applications ou solutions techniques, inventer des visuels et du design, fabriquer des objets concrets, ou créer des projets d'entreprise ?",
          suggestions: [
            "Applications et outils numériques",
            "Design, graphisme et visuels",
            "Objets concrets et mécanique",
            "Projets d'entreprise",
          ],
          vise: "Clarifier le type de création souhaité",
          phase: 3,
          etape: 2,
        };
      }
    }
  }

  // ── DÉBLOCAGE SI "JE NE SAIS PAS" RÉPÉTÉ (Partie 4.3 — Règle anti-boucle) ──
  if (profile.nb_je_ne_sais_pas >= 2 && !isAsked("intent_exploration_concrete") && lastAskedIntent !== "intent_exploration_concrete") {
    return {
      type: "question",
      intent_id: "intent_exploration_concrete",
      question: "C'est tout à fait normal d'hésiter à ce stade, pas d'inquiétude. Pour y voir plus clair, imagine une journée de travail idéale : dans quelle situation te verrais-tu le plus ?",
      suggestions: [
        "Sur un ordinateur à concevoir des solutions",
        "En contact direct avec des gens à les conseiller ou soigner",
        "Sur le terrain ou en atelier à manipuler des équipements",
        "À gérer des documents, organiser et négocier",
      ],
      vise: "Débloquer l'indécision par des situations concrètes du quotidien professionnel",
      phase: 2,
      etape: 2,
    };
  }

  // ── APPROFONDISSEMENT D'UN DOMAINE CONFIRMÉ (Partie 9 — Test 7) ───────────
  // Si un domaine précis est confirmé mais sans projet sous-jacent détaillé
  const topDomain = profile.confirmed_interests[0] || profile.interets_principaux[0];
  if (topDomain && !profile.projet && !isAsked("intent_approfondir_domaine") && lastAskedIntent !== "intent_approfondir_domaine") {
    if (topDomain.includes("Informatique")) {
      return {
        type: "question",
        intent_id: "intent_approfondir_domaine",
        question: `${nameGreet}dans le numérique et l'informatique, qu'est-ce qui te plairait le plus : concevoir des applications, analyser des données et l'IA, ou sécuriser les systèmes (cybersécurité) ?`,
        suggestions: [
          "Créer des applications et logiciels",
          "Intelligence Artificielle & Data",
          "Cybersécurité & Réseaux",
          "Je ne sais pas",
        ],
        vise: "Approfondir le sous-domaine informatique",
        phase: 5,
        etape: 3,
      };
    }
    if (topDomain.includes("Santé") || topDomain.includes("Médecine")) {
      return {
        type: "question",
        intent_id: "intent_approfondir_domaine",
        question: `${nameGreet}dans le domaine de la santé, es-tu plutôt attiré(e) par la médecine générale, la pharmacie, les soins infirmiers, ou la recherche en laboratoire ?`,
        suggestions: [
          "Médecine ou odontologie",
          "Pharmacie & Laboratoires",
          "Soins infirmiers / Santé publique",
          "Je ne sais pas",
        ],
        vise: "Approfondir la filière santé",
        phase: 5,
        etape: 3,
      };
    }
    if (topDomain.includes("Commerce") || topDomain.includes("Gestion")) {
      return {
        type: "question",
        intent_id: "intent_approfondir_domaine",
        question: `${nameGreet}en gestion et commerce, qu'est-ce qui t'attire le plus : la comptabilité et la finance, le marketing et la vente, la logistique, ou la création d'entreprise ?`,
        suggestions: [
          "Comptabilité & Finance",
          "Marketing & Vente",
          "Création d'entreprise & Management",
          "Je ne sais pas",
        ],
        vise: "Approfondir le secteur gestion et commerce",
        phase: 5,
        etape: 3,
      };
    }
  }

  // ── PHASE 1 : SITUATION SCOLAIRE (Prénom, niveau, série) ──────────────────
  if (!profile.prenom && lastAskedIntent !== "intent_demander_prenom") {
    return {
      type: "question",
      intent_id: "intent_demander_prenom",
      question: "Bonjour ! Je suis ton conseiller d'orientation SenOrientation. Pour faire connaissance et personnaliser notre échange, comment puis-je t'appeler ?",
      suggestions: ["Je préfère ne pas le dire"],
      vise: "Faire connaissance en demandant le prénom",
      phase: 1,
      etape: 1,
    };
  }

  if (!profile.serie && !profile.niveau && !profile.statut_parcours && lastAskedIntent !== "intent_demander_situation_scolaire") {
    return {
      type: "question",
      intent_id: "intent_demander_situation_scolaire",
      question: `Ravi de faire ta connaissance${namePart ? " " + namePart : ""} ! Où en es-tu actuellement dans tes études (collège, lycée en seconde/première, classe de Terminale, nouveau bachelier, ou déjà étudiant) ?`,
      suggestions: [
        "Collège (3e / BFEM)",
        "Lycée (Seconde ou 1ère)",
        "Terminale ou Nouveau bachelier",
        "Étudiant ou Réorientation",
      ],
      vise: "Identifier le niveau scolaire (avant-bac, bac ou post-bac) et la situation",
      phase: 1,
      etape: 1,
    };
  }

  if (profile.type_post_bac === "reorientation" && !isAsked("intent_reorientation") && lastAskedIntent !== "intent_reorientation") {
    return {
      type: "question",
      intent_id: "intent_reorientation",
      question: `${nameGreet}qu'est-ce qui a été difficile ou ne t'a pas convenu dans ton parcours initial (trop de théorie, mauvaise attribution Campusen, manque d'intérêt), et quel nouveau cap aimerais-tu prendre ?`,
      suggestions: [
        "Filière courte et pratique (BTS / Licence pro)",
        "Changer vers l'informatique et le numérique",
        "Changer vers la gestion et le commerce",
        "Changer vers la santé ou le social",
      ],
      vise: "Comprendre les motifs de réorientation et le nouveau cap",
      phase: 1,
      etape: 2,
    };
  }

  if (profile.type_post_bac === "passerelle_poursuite" && !isAsked("intent_post_bac_objectifs") && lastAskedIntent !== "intent_post_bac_objectifs") {
    return {
      type: "question",
      intent_id: "intent_post_bac_objectifs",
      question: `${nameGreet}pour ta poursuite d'études après ton diplôme actuel (BTS, DUT ou Licence), vises-tu une Licence professionnelle, un Master universitaire classique (Bac+5), ou un concours d'école ?`,
      suggestions: [
        "Licence professionnelle spécialisée",
        "Master universitaire (Bac+5)",
        "Concours d'école d'ingénieur ou gestion",
        "Je ne sais pas encore",
      ],
      vise: "Préciser la passerelle de poursuite d'études post-bac",
      phase: 6,
      etape: 4,
    };
  }

  // ── PHASE 2 : DÉCOUVERTE DES CENTRES D'INTÉRÊT (Partie 5) ────────────────
  if (profile.confirmed_interests.length === 0 && profile.interets_principaux.length === 0 && !isAsked("intent_decouvrir_interets") && lastAskedIntent !== "intent_decouvrir_interets") {
    const contextPrefix = profile.serie
      ? `Intéressant avec ta série ${profile.serie}. `
      : profile.niveau
      ? `Parfait pour ton niveau (${profile.niveau}). `
      : "";
    return {
      type: "question",
      intent_id: "intent_decouvrir_interets",
      question: `${contextPrefix}Pour cibler ce qui te correspond vraiment, quels sont les domaines qui t'attirent le plus au quotidien ?`,
      suggestions: [
        "Sciences, maths & informatique",
        "Médecine, santé & biologie",
        "Commerce, gestion & finance",
        "Droit, communication & lettres",
        "Je ne sais pas encore",
      ],
      vise: "Découvrir les centres d'intérêt majeurs",
      phase: 2,
      etape: 2,
    };
  }

  // ── PHASE 4 : MATIÈRES ET APTITUDES (Partie 5) ───────────────────────────
  if (profile.matieres_aimees.length === 0 && profile.points_forts.length === 0 && !isAsked("intent_matieres_preferees") && lastAskedIntent !== "intent_matieres_preferees") {
    return {
      type: "question",
      intent_id: "intent_matieres_preferees",
      question: "Dans quelles matières ou façons d'agir te sens-tu le plus à l'aise : résoudre des problèmes de calcul, rédiger et argumenter, ou manipuler et pratiquer ?",
      suggestions: [
        "Calcul, logique et rigueur",
        "Rédaction, langues et argumentation",
        "Pratique, manipulation et terrain",
        "Je ne sais pas",
      ],
      vise: "Identifier les aptitudes et matières fortes déclarées",
      phase: 4,
      etape: 3,
    };
  }

  // ── PHASE 6 : CONTRAINTES DE DURÉE ET LOCALISATION / SÉRIES AVANT-BAC (Partie 5) ──
  if (profile.statut_parcours === "avant_bac" && !profile.serie && !isAsked("intent_avant_bac_series") && lastAskedIntent !== "intent_avant_bac_series") {
    return {
      type: "question",
      intent_id: "intent_avant_bac_series",
      question: `${nameGreet}au lycée, vers quel type de série penches-tu le plus : les séries scientifiques (S1, S2), les séries littéraires (L1, L2), la gestion et le commerce (série G / STEG), ou la technique industrielle (T1, T2) ?`,
      suggestions: [
        "Séries scientifiques (S1 ou S2)",
        "Séries littéraires (L1 ou L2)",
        "Série gestion & commerce (G / STEG)",
        "Séries techniques (T1 ou T2)",
      ],
      vise: "Guider l'élève avant-bac vers le choix de sa série de lycée",
      phase: 6,
      etape: 4,
    };
  }

  if (!profile.preferences_etudes && !profile.duree_souhaitee && !isAsked("intent_contraintes_duree_ville") && lastAskedIntent !== "intent_contraintes_duree_ville" && profile.statut_parcours !== "avant_bac") {
    return {
      type: "question",
      intent_id: "intent_contraintes_duree_ville",
      question: "Envisages-tu plutôt des études courtes pour t'insérer rapidement dans l'emploi (2 à 3 ans : BTS, DUT, Licence pro) ou un cursus universitaire long (Bac+5 : Master, école d'ingénieurs) ?",
      suggestions: [
        "Études courtes (2 à 3 ans)",
        "Études longues (Bac+5)",
        "Les deux m'intéressent",
        "Je ne sais pas",
      ],
      vise: "Cerner la durée et le format d'études envisagés",
      phase: 6,
      etape: 4,
    };
  }

  // ── PHASE 8 : BILAN FINAL STRUCTURÉ (Partie 5 & Partie 9) ─────────────────
  if (profile.statut_parcours === "avant_bac") {
    return {
      type: "bilan",
      intent_id: "intent_presenter_bilan",
      question: "Parmi ces séries de Bac et ces métiers d'avenir, quelle option te motive le plus pour ton parcours au lycée ?",
      suggestions: [
        "Approfondir la série recommandée",
        "En savoir plus sur les métiers cibles",
        "Conseils pour réussir mes matières clés",
        "Je souhaite ajuster mon profil",
      ],
      vise: "Présenter le bilan d'orientation avant-bac (séries de lycée et métiers d'avenir)",
      phase: 8,
      etape: 5,
    };
  }

  if (profile.statut_parcours === "post_bac") {
    return {
      type: "bilan",
      intent_id: "intent_presenter_bilan",
      question: "Parmi ces pistes de réorientation et passerelles, quelle opportunité souhaites-tu détailler en priorité ?",
      suggestions: [
        "Approfondir la filière recommandée",
        "Conditions de transfert et passerelles",
        "Comparer les débouchés professionnels",
        "Je souhaite ajuster mon profil",
      ],
      vise: "Présenter le bilan post-bac (réorientation, passerelles et diplômes professionnels)",
      phase: 8,
      etape: 5,
    };
  }

  return {
    type: "bilan",
    intent_id: "intent_presenter_bilan",
    question: "Parmi ces parcours recommandés, lequel aimerais-tu approfondir en premier ?",
    suggestions: [
      "Approfondir la première option",
      "Voir les démarches Campusen",
      "Comparer les débouchés",
      "Je souhaite ajuster mon profil",
    ],
    vise: "Présenter le bilan final structuré et orienter les démarches",
    phase: 8,
    etape: 5,
  };
}
