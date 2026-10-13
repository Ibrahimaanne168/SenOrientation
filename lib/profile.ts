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
  | "intent_demander_serie"
  | "intent_reorientation"
  | "intent_post_bac_objectifs"
  | "intent_avant_bac_series"
  | "intent_clarifier_comprendre"
  | "intent_clarifier_reflechir"
  | "intent_clarifier_chiffres"
  | "intent_clarifier_aider"
  | "intent_clarifier_creer"
  | "intent_decouvrir_interets"
  | "intent_autre_domaine"
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
    description: "Filière technique et scientifique centrée sur la construction mécanique, le génie civil et l'ingénierie.",
    matieres_cles: ["Mathématiques", "Sciences Physiques", "Construction mécanique"],
    domaines: ["Génie Mécanique & Ingénierie", "Génie Civil & BTP", "Industrie & Électromécanique"],
    metiers_cibles: ["Ingénieur mécanicien", "Ingénieur travaux publics", "Ingénieur mécatronique", "Technicien supérieur"]
  },
  {
    code: "S4",
    nom: "Série S4 (Sciences et Technologie de l'Agriculture et de l'Environnement)",
    description: "Filière agronomique et environnementale préparant au développement durable et à la gestion des ressources.",
    matieres_cles: ["Agronomie", "Biologie / Écologie", "Mathématiques", "Sciences Physiques"],
    domaines: ["Agronomie & Environnement", "Agroécologie & Développement rural"],
    metiers_cibles: ["Ingénieur agronome", "Conseiller agricole", "Spécialiste de l'environnement", "Technicien agricole"]
  },
  {
    code: "S5",
    nom: "Série S5 (Sciences et Technologie du Produit Agroalimentaire)",
    description: "Filière axée sur la transformation, la conservation et le contrôle qualité des produits alimentaires.",
    matieres_cles: ["Biochimie alimentaire", "Microbiologie", "Procédés agroalimentaires"],
    domaines: ["Industries Agroalimentaires", "Qualité & Sécurité Alimentaire"],
    metiers_cibles: ["Technologue alimentaire", "Responsable qualité", "Technicien de laboratoire", "Chef de production"]
  },
  {
    code: "S1A",
    nom: "Série S1A (Sciences exactes franco-arabes)",
    description: "Filière scientifique bilingue combinant mathématiques et physique approfondies avec la langue arabe.",
    matieres_cles: ["Mathématiques", "Sciences Physiques", "Langue & Littérature arabes"],
    domaines: ["Sciences & Ingénierie", "Informatique & Data", "Recherche & Enseignement"],
    metiers_cibles: ["Ingénieur", "Développeur", "Statisticien", "Chercheur scientifique"]
  },
  {
    code: "S2A",
    nom: "Série S2A (Sciences expérimentales franco-arabes)",
    description: "Filière biomédicale bilingue préparant aux études de santé, de biologie et d'agronomie.",
    matieres_cles: ["SVT", "Sciences Physiques", "Mathématiques", "Langue arabe"],
    domaines: ["Santé & Médecine", "Sciences de la Vie", "Agronomie & Environnement"],
    metiers_cibles: ["Professionnel de santé", "Biologiste", "Agronome", "Spécialiste environnement"]
  },
  {
    code: "L1",
    nom: "Série L1 (Langues & Civilisations classiques et modernes : L1a, L1b, L'1)",
    description: "Filière littéraire privilégiant les langues, la littérature, la traduction et la communication.",
    matieres_cles: ["Français & Littérature", "Philosophie", "Langues vivantes (Anglais, Espagnol, Arabe, Allemand)"],
    domaines: ["Langues & Traduction", "Communication & Médias", "Enseignement & Édition", "Tourisme & Diplomatie"],
    metiers_cibles: ["Traducteur / Interprète", "Journaliste", "Chargé de communication", "Professeur de lettres / langues", "Éditeur", "Guide touristique"]
  },
  {
    code: "L2",
    nom: "Série L2 (Sciences Humaines & Sociales)",
    description: "Filière littéraire orientée vers le droit, les sciences politiques, la sociologie et l'administration.",
    matieres_cles: ["Histoire-Géographie", "Philosophie", "Français"],
    domaines: ["Droit & Sciences Politiques", "Administration & RH", "Sciences Humaines & Sociales", "Journalisme"],
    metiers_cibles: ["Juriste / Avocat / Magistrat", "Administrateur civil", "Chargé de RH", "Sociologue", "Journaliste", "Travailleur social"]
  },
  {
    code: "LA",
    nom: "Série LA / L-AR (Bac littéraire franco-arabe)",
    description: "Filière littéraire franco-arabe approfondissant la langue, la civilisation arabes, le droit et les sciences humaines.",
    matieres_cles: ["Langue & Littérature arabes", "Français", "Philosophie", "Histoire-Géo"],
    domaines: ["Traduction & Interprétation", "Droit & Sciences Humaines", "Diplomatie", "Enseignement"],
    metiers_cibles: ["Traducteur / Interprète bilingue", "Diplomate", "Enseignant", "Administrateur", "Journaliste"]
  },
  {
    code: "G",
    nom: "Série G / STEG (Techniques quantitatives d'économie et de gestion)",
    description: "Filière technique tertiaire dédiée à la comptabilité, la finance, le commerce et l'administration.",
    matieres_cles: ["Comptabilité & Gestion", "Mathématiques financières", "Économie & Droit", "Commerce"],
    domaines: ["Comptabilité & Finance", "Banque & Assurance", "Commerce & Marketing", "Gestion & RH"],
    metiers_cibles: ["Comptable / Auditeur", "Banquier", "Responsable commercial", "Gestionnaire de stock", "Assistant de direction"]
  },
  {
    code: "T1",
    nom: "Série T1 (Fabrication mécanique & Conception)",
    description: "Filière technique industrielle axée sur l'usinage, la mécanique industrielle et la FAO.",
    matieres_cles: ["Fabrication mécanique", "Dessin industriel / CAO", "Technologie", "Mathématiques"],
    domaines: ["Mécanique Industrielle & Usinage", "Conception & Bureau d'études", "Maintenance Industrielle"],
    metiers_cibles: ["Technicien fabrication mécanique", "Dessinateur industriel", "Technicien méthodes / maintenance", "Ingénieur mécanicien"]
  },
  {
    code: "T2",
    nom: "Série T2 (Électronique et Électrotechnique)",
    description: "Filière technique industrielle orientée vers l'électricité, l'électronique, l'automatisme et les réseaux.",
    matieres_cles: ["Électrotechnique", "Électronique", "Automatisme", "Physique appliquée"],
    domaines: ["Électrotechnique & Énergie", "Électronique & Télécoms", "Automatisme & Robotique"],
    metiers_cibles: ["Électrotechnicien", "Automaticien", "Technicien électronique", "Technicien réseaux d'énergie"]
  },
  {
    code: "F6",
    nom: "Série F6 (Chimie industrielle & Laboratoire)",
    description: "Filière technique scientifique spécialisée dans les procédés chimiques, les analyses et le contrôle qualité.",
    matieres_cles: ["Chimie industrielle", "Analyses de laboratoire", "Procédés industriels", "Mathématiques"],
    domaines: ["Chimie Industrielle", "Analyses & Contrôle Qualité", "Chimie Environnementale"],
    metiers_cibles: ["Technicien chimiste", "Technicien de laboratoire", "Contrôleur qualité", "Opérateur procédés industriels"]
  },
  {
    code: "STIDD",
    nom: "Série STIDD (Sciences et Technologies de l'Industrie et du Développement Durable)",
    description: "Filière polyvalente associant mécanique, énergie, automatisme et informatique industrielle.",
    matieres_cles: ["Ingénierie industrielle", "Énergie & Environnement", "Systèmes numériques"],
    domaines: ["Ingénierie & BTP", "Énergie & Systèmes Industriels", "Automatisme"],
    metiers_cibles: ["Technicien supérieur industriel", "Concepteur technique", "Chargé d'énergie renouvelable"]
  }
];

/**
 * Associe chaque série de Bac sénégalaise aux grands univers de carrière prioritaires
 * selon les préconisations officielles du CNOSP (Centre National d'Orientation Scolaire et Professionnelle)
 */
export function getSerieOrientationSuggestions(serieRaw: string | null): {
  question: string;
  suggestions: string[];
} {
  if (!serieRaw) {
    return {
      question: "Parmi ces grands univers professionnels, lesquels t'attirent le plus au quotidien ?",
      suggestions: [
        "Sciences, maths & informatique",
        "Médecine, santé & biologie",
        "Droit, communication & lettres",
        "Commerce, gestion & finance",
        "Ingénierie, mécanique & BTP",
        "Je ne sais pas encore",
      ],
    };
  }

  const s = serieRaw.toUpperCase().trim();

  // 1. SÉRIE L1 (L1, L1a, L1b, L'1, Lettres classiques & modernes)
  if (s.startsWith("L1") || s.includes("L'1") || s === "L'") {
    return {
      question: `Avec ta série ${serieRaw} (axée sur les langues et les lettres), plusieurs beaux débouchés s'offrent à toi. Quels univers professionnels t'attirent le plus au quotidien ?`,
      suggestions: [
        "Langues, traduction & interprétation",
        "Journalisme, communication & médias",
        "Enseignement, lettres & édition",
        "Tourisme & relations internationales",
        "Un autre domaine m'intéresse",
        "Je ne sais pas encore",
      ],
    };
  }

  // 2. SÉRIE L2 (Sciences humaines et sociales)
  if (s.startsWith("L2") || s.includes("L2")) {
    return {
      question: `Avec ta série ${serieRaw} (sciences humaines et sociales), de nombreuses voies prestigieuses te sont ouvertes. Quels domaines correspondent le mieux à tes aspirations ?`,
      suggestions: [
        "Droit, sciences politiques & diplomatie",
        "Administration publique, RH & gestion sociale",
        "Sociologie, psychologie & travail social",
        "Journalisme, communication & médias",
        "Un autre domaine m'intéresse",
        "Je ne sais pas encore",
      ],
    };
  }

  // 3. SÉRIES FRANCO-ARABES LITTÉRAIRES (LA, L-AR)
  if (s === "LA" || s.includes("L-AR") || s.includes("ARABE") || s.includes("FRANCO")) {
    return {
      question: `Avec ta série ${serieRaw} (bac franco-arabe littéraire), de riches opportunités s'offrent à toi. Quels univers t'attirent le plus au quotidien ?`,
      suggestions: [
        "Langue, littérature & civilisation arabes",
        "Traduction, interprétation & communication",
        "Droit, sciences humaines & enseignement",
        "Administration & diplomatie",
        "Un autre domaine m'intéresse",
        "Je ne sais pas encore",
      ],
    };
  }

  // 4. SÉRIE S1 (Sciences exactes & Mathématiques)
  if (s === "S1") {
    return {
      question: `Avec ta série ${serieRaw} (sciences exactes et fondamentales), de prestigieuses filières scientifiques et technologiques te sont ouvertes. Quels domaines t'intéressent le plus ?`,
      suggestions: [
        "Informatique, IA, data & développement",
        "Grandes écoles d'ingénieurs & physique appliquée",
        "Mathématiques, statistiques & finance quant",
        "Recherche scientifique & enseignement",
        "Un autre domaine m'intéresse",
        "Je ne sais pas encore",
      ],
    };
  }

  // 5. SÉRIE S2 (Sciences expérimentales & de la vie)
  if (s === "S2") {
    return {
      question: `Avec ta série ${serieRaw} (sciences expérimentales), de multiples parcours d'avenir s'offrent à toi. Vers quel grand secteur te projettes-tu le plus naturellement ?`,
      suggestions: [
        "Médecine, pharmacie & santé (odontologie, soins)",
        "Biologie, biochimie & biotechnologies",
        "Agronomie, agroécologie & environnement",
        "Informatique & sciences appliquées",
        "Un autre domaine m'intéresse",
        "Je ne sais pas encore",
      ],
    };
  }

  // 6. SÉRIE S3 (Sciences et Techniques Industrielles)
  if (s === "S3") {
    return {
      question: `Avec ta série ${serieRaw} (sciences et techniques), tu as de solides atouts pour l'ingénierie et l'industrie. Quels domaines t'attirent le plus ?`,
      suggestions: [
        "Génie mécanique & conception industrielle",
        "Génie civil, bâtiment & travaux publics (BTP)",
        "Électromécanique, énergie & maintenance",
        "Informatique industrielle & automatique",
        "Un autre domaine m'intéresse",
        "Je ne sais pas encore",
      ],
    };
  }

  // 7. SÉRIE S4 (Agriculture et Environnement)
  if (s === "S4") {
    return {
      question: `Avec ta série ${serieRaw} (sciences et technologie de l'agriculture et de l'environnement), tu es au cœur des enjeux du développement rural et durable. Quels domaines te motivent ?`,
      suggestions: [
        "Agronomie & production végétale",
        "Gestion des ressources naturelles & environnement",
        "Agroécologie & développement rural",
        "Conseil agricole & gestion d'exploitation",
        "Un autre domaine m'intéresse",
        "Je ne sais pas encore",
      ],
    };
  }

  // 8. SÉRIE S5 (Agroalimentaire)
  if (s === "S5") {
    return {
      question: `Avec ta série ${serieRaw} (sciences et technologie du produit agroalimentaire), tes compétences ciblent la transformation et la qualité. Quels univers t'attirent ?`,
      suggestions: [
        "Industries & transformation agroalimentaires",
        "Contrôle qualité & sécurité sanitaire des aliments",
        "Microbiologie alimentaire & bio-industries",
        "Gestion de production agroalimentaire",
        "Un autre domaine m'intéresse",
        "Je ne sais pas encore",
      ],
    };
  }

  // 9. SÉRIES FRANCO-ARABES SCIENTIFIQUES (S1A, S2A)
  if (s === "S1A") {
    return {
      question: `Avec ta série ${serieRaw} (sciences exactes franco-arabes), de beaux parcours d'ingénierie et de sciences s'ouvrent à toi. Vers quel univers te diriges-tu ?`,
      suggestions: [
        "Mathématiques, physique & ingénierie",
        "Informatique, statistiques & data",
        "Recherche scientifique & enseignement",
        "Un autre domaine m'intéresse",
        "Je ne sais pas encore",
      ],
    };
  }
  if (s === "S2A") {
    return {
      question: `Avec ta série ${serieRaw} (sciences expérimentales franco-arabes), tu as accès aux filières scientifiques et biomédicales. Quels domaines t'attirent le plus ?`,
      suggestions: [
        "Santé, médecine & biologie",
        "Agronomie, environnement & sciences du vivant",
        "Enseignement & sciences appliquées",
        "Un autre domaine m'intéresse",
        "Je ne sais pas encore",
      ],
    };
  }

  // 10. SÉRIE T1 (Fabrication mécanique)
  if (s === "T1") {
    return {
      question: `Avec ta série ${serieRaw} (fabrication mécanique), tes compétences techniques sont très recherchées dans l'industrie. Quels domaines t'intéressent le plus ?`,
      suggestions: [
        "Mécanique industrielle, usinage & FAO",
        "Conception mécanique & dessin industriel",
        "Maintenance industrielle & productique",
        "Un autre domaine m'intéresse",
        "Je ne sais pas encore",
      ],
    };
  }

  // 11. SÉRIE T2 (Électronique et électrotechnique)
  if (s === "T2") {
    return {
      question: `Avec ta série ${serieRaw} (électronique et électrotechnique), tu disposes d'un socle technique solide. Vers quelles technologies souhaites-tu t'orienter ?`,
      suggestions: [
        "Électrotechnique & réseaux d'énergie",
        "Électronique, télécommunications & systèmes embarqués",
        "Automatisme, robotique & maintenance",
        "Un autre domaine m'intéresse",
        "Je ne sais pas encore",
      ],
    };
  }

  // 12. SÉRIE F6 (Chimie industrielle)
  if (s === "F6") {
    return {
      question: `Avec ta série ${serieRaw} (chimie industrielle), tes compétences de laboratoire et de procédés ouvrent des perspectives industrielles variées. Quels secteurs t'attirent ?`,
      suggestions: [
        "Chimie industrielle & procédés de fabrication",
        "Analyses chimiques en laboratoire & contrôle qualité",
        "Chimie environnementale & traitement des eaux",
        "Un autre domaine m'intéresse",
        "Je ne sais pas encore",
      ],
    };
  }

  // 13. SÉRIE G / STEG (Gestion, Comptabilité & Commerce)
  if (s === "G" || s.includes("STEG")) {
    return {
      question: `Avec ta série ${serieRaw} (techniques quantitatives d'économie et de gestion), de nombreuses filières tertiaires et financières te sont ouvertes. Quels secteurs t'attirent le plus ?`,
      suggestions: [
        "Comptabilité, audit & finance d'entreprise",
        "Banque, assurance & microfinance",
        "Commerce, marketing & vente",
        "Gestion d'entreprise, logistique & RH",
        "Un autre domaine m'intéresse (ex: informatique de gestion)",
        "Je ne sais pas encore",
      ],
    };
  }

  // 14. STIDD
  if (s.includes("STIDD")) {
    return {
      question: `Avec ta série ${serieRaw} (sciences et technologies industrielles), tu as accès aux filières d'ingénierie appliquée. Quels secteurs t'intéressent ?`,
      suggestions: [
        "Ingénierie industrielle & mécanique",
        "Énergie, électricité & automatisme",
        "Informatique industrielle & systèmes",
        "Un autre domaine m'intéresse",
        "Je ne sais pas encore",
      ],
    };
  }

  // Fallback série littéraire générique
  if (s.includes("LIT") || s.startsWith("L")) {
    return {
      question: `Avec ta série littéraire ${serieRaw}, de nombreux débouchés s'offrent à toi. Quels domaines professionnels t'attirent le plus ?`,
      suggestions: [
        "Droit, sciences politiques & diplomatie",
        "Langues, traduction & communication",
        "Journalisme, médias & édition",
        "Administration publique & RH",
        "Un autre domaine m'intéresse",
        "Je ne sais pas encore",
      ],
    };
  }

  // Fallback général
  return {
    question: `Avec ta série ${serieRaw}, plusieurs grands univers professionnels te sont ouverts. Lesquels t'attirent le plus au quotidien ?`,
    suggestions: [
      "Sciences, maths & informatique",
      "Médecine, santé & biologie",
      "Droit, communication & lettres",
      "Commerce, gestion & finance",
      "Ingénierie, mécanique & BTP",
      "Un autre domaine m'intéresse",
      "Je ne sais pas encore",
    ],
  };
}

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
  recherche_autre_domaine?: boolean;
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
  recherche_autre_domaine: false,
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
  // IMPORTANT : N'extraire les faits et centres d'intérêt QUE depuis les messages de l'UTILISATEUR
  // pour éviter toute pollution par les questions ou suggestions de l'assistant !
  const userHistoryText = history
    .filter((h) => h.role === "user")
    .map((h) => h.content)
    .join(" ");
  const text = (userHistoryText + " " + latestMessage).toLowerCase();

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
    const cleanLower = text.toLowerCase();
    if (/\b(s1a)\b/i.test(text)) profile.serie = "S1A";
    else if (/\b(s2a)\b/i.test(text)) profile.serie = "S2A";
    else if (/\b(s1)\b/i.test(text)) profile.serie = "S1";
    else if (/\b(s2)\b/i.test(text)) profile.serie = "S2";
    else if (/\b(s3)\b/i.test(text)) profile.serie = "S3";
    else if (/\b(s4)\b/i.test(text)) profile.serie = "S4";
    else if (/\b(s5)\b/i.test(text)) profile.serie = "S5";
    else if (/\b(l1a)\b/i.test(text)) profile.serie = "L1a";
    else if (/\b(l1b)\b/i.test(text)) profile.serie = "L1b";
    else if (/\bl['’]1\b|\bl1['’]\b/i.test(text)) profile.serie = "L'1";
    else if (/\b(l1)\b/i.test(text)) profile.serie = "L1";
    else if (/\b(l2)\b/i.test(text)) profile.serie = "L2";
    else if (/\b(la)\b/i.test(text) && !cleanLower.includes("la ")) profile.serie = "LA";
    else if (/\b(l-ar|l\s*ar)\b/i.test(text) || cleanLower.includes("franco-arabe") || cleanLower.includes("franco arabe")) {
      profile.serie = cleanLower.includes("s1") ? "S1A" : cleanLower.includes("s2") ? "S2A" : "L-AR";
    }
    else if (cleanLower.includes("littéraire")) profile.serie = "L2";
    else if (cleanLower.includes("l'")) profile.serie = "L'1";
    else if (/\b(steg|bac\s*g|terminale\s*g|série\s*g|série\s*de\s*bac\s*g)\b/i.test(text)) profile.serie = "G";
    else if (/\b(t1)\b/i.test(text)) profile.serie = "T1";
    else if (/\b(t2)\b/i.test(text)) profile.serie = "T2";
    else if (/\b(f6)\b/i.test(text)) profile.serie = "F6";
    else if (/\b(stidd)\b/i.test(text)) profile.serie = "STIDD";
    else if (/\b(g)\b/i.test(text) && !cleanLower.includes("génie") && (cleanLower.includes("bac") || cleanLower.includes("série") || cleanLower.includes("gestion"))) profile.serie = "G";

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

  // 6.b Détection du choix explicite d'explorer un autre domaine en dehors de sa série
  if (
    latestLower.includes("autre domaine") ||
    latestLower.includes("autre univers") ||
    latestLower.includes("autre chose") ||
    latestLower.includes("autre filière")
  ) {
    profile.recherche_autre_domaine = true;
    profile.questions_answered["intent_decouvrir_interets"] = "Autre domaine";
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
    "sciences politiques": "Droit & Sciences Politiques",
    diplomatie: "Droit & Sciences Politiques",
    traduction: "Langues & Traduction",
    interprétation: "Langues & Traduction",
    langues: "Langues & Traduction",
    linguistique: "Langues & Traduction",
    journalisme: "Communication & Médias",
    communication: "Communication & Médias",
    médias: "Communication & Médias",
    lettres: "Lettres & Enseignement",
    enseignement: "Lettres & Enseignement",
    édition: "Lettres & Enseignement",
    tourisme: "Tourisme & Relations Internationales",
    "relations internationales": "Tourisme & Relations Internationales",
    administration: "Administration & Ressources Humaines",
    "ressources humaines": "Administration & Ressources Humaines",
    rh: "Administration & Ressources Humaines",
    sociologie: "Sciences Humaines & Sociales",
    psychologie: "Sciences Humaines & Sociales",
    "travail social": "Sciences Humaines & Sociales",
    commerce: "Commerce & Gestion",
    gestion: "Commerce & Gestion",
    comptabilité: "Commerce & Gestion",
    finance: "Commerce & Gestion",
    banque: "Banque, Assurance & Finance",
    assurance: "Banque, Assurance & Finance",
    marketing: "Marketing & Vente",
    vente: "Marketing & Vente",
    agronomie: "Agriculture & Environnement",
    agriculture: "Agriculture & Environnement",
    agroécologie: "Agriculture & Environnement",
    agroalimentaire: "Agroalimentaire & Qualité",
    "génie mécanique": "Génie Mécanique & Fabrication",
    mécanique: "Génie Mécanique & Fabrication",
    usinage: "Génie Mécanique & Fabrication",
    bâtiment: "Ingénierie & BTP",
    "génie civil": "Ingénierie & BTP",
    électrotechnique: "Génie Électrique & Électronique",
    électronique: "Génie Électrique & Électronique",
    automatisme: "Automatisme & Robotique",
    chimie: "Chimie Industrielle & Laboratoire",
    arabe: "Langues & Civilisations Arabes",
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

  // ── PHASE 1 : IDENTITÉ & SITUATION SCOLAIRE (Prénom, niveau, série) ─────
  // 1. Demande du prénom si inconnu
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

  // 2. Demande de la situation scolaire / niveau si inconnu
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

  // 3. Demande de la série du Bac (si Terminale, Nouveau Bachelier ou public Bac) si non encore précisée
  const isBacAudience =
    profile.niveau === "Terminale" ||
    profile.niveau === "Nouveau Bachelier" ||
    profile.statut_parcours === "bac";

  if (isBacAudience && !profile.serie && !isAsked("intent_demander_serie") && lastAskedIntent !== "intent_demander_serie") {
    return {
      type: "question",
      intent_id: "intent_demander_serie",
      question: `Félicitations pour ton parcours${namePart ? " " + namePart : ""} ! Quelle est ta série de Bac (ou celle que tu prépares cette année) ?`,
      suggestions: [
        "Bac S1 ou S2",
        "Bac L1 ou L2",
        "Bac G ou STEG",
        "Bac technique T1 ou T2",
        "Autre série",
      ],
      vise: "Identifier la série de Baccalauréat avant d'explorer les formations",
      phase: 1,
      etape: 1,
    };
  }

  // 4. Si profil post-bac réorientation ou passerelle : cadrer le motif
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

  // ── GESTION DU CHOIX "UN AUTRE DOMAINE M'INTÉRESSE" (Passerelle / Reconversion) ──
  if (profile.recherche_autre_domaine && profile.confirmed_interests.length === 0 && !isAsked("intent_autre_domaine") && lastAskedIntent !== "intent_autre_domaine") {
    return {
      type: "question",
      intent_id: "intent_autre_domaine",
      question: `C'est une excellente démarche d'élargir tes horizons ! Quel autre univers professionnel t'attire en dehors des filières classiques de ta série ${profile.serie || ""} ? Je t'expliquerai les passerelles possibles, les matières déterminantes et les conditions réelles d'accès (dossier, concours ou formation complémentaire).`,
      suggestions: [
        "Informatique & Métiers du numérique",
        "Commerce, marketing & gestion",
        "Santé, soins & paramédical",
        "Arts, design & audiovisuel",
        "Je préfère préciser mon idée",
      ],
      vise: "Identifier l'autre domaine souhaité et évaluer les conditions d'accès / passerelles",
      phase: 2,
      etape: 2,
    };
  }

  // ── PHASE 2 : DÉCOUVERTE DES GRANDS CENTRES D'INTÉRÊT (Partie 5 & CNOSP) ───
  // Propose des univers pertinents liés à la série réelle, avec option d'ouverture en dernier
  if (profile.confirmed_interests.length === 0 && profile.interets_principaux.length === 0 && !isAsked("intent_decouvrir_interets") && lastAskedIntent !== "intent_decouvrir_interets") {
    const guide = getSerieOrientationSuggestions(profile.serie);
    const questionText = profile.serie
      ? guide.question
      : profile.niveau
      ? `Pour ton niveau (${profile.niveau}), ${guide.question}`
      : guide.question;

    return {
      type: "question",
      intent_id: "intent_decouvrir_interets",
      question: questionText,
      suggestions: guide.suggestions,
      vise: "Découvrir les centres d'intérêt majeurs cohérents avec la série sans l'enfermer",
      phase: 2,
      etape: 2,
    };
  }

  // ── PHASE 5 : APPROFONDISSEMENT D'UN DOMAINE CONFIRMÉ (Partie 9 — Test 7) ──
  // UNIQUEMENT après que l'élève a clairement exprimé son intérêt pour ce domaine !
  const topDomain = profile.confirmed_interests[0] || profile.interets_principaux[0];
  if (topDomain && !profile.projet && !isAsked("intent_approfondir_domaine") && lastAskedIntent !== "intent_approfondir_domaine") {
    if (topDomain.includes("Langues") || topDomain.includes("Traduction") || topDomain.includes("Lettres") || topDomain.includes("Édition")) {
      return {
        type: "question",
        intent_id: "intent_approfondir_domaine",
        question: `${nameGreet}dans les langues, lettres et la traduction, qu'est-ce qui te plairait le plus : la traduction et l'interprétation professionnelle, les relations internationales et le tourisme, ou l'enseignement et l'édition ?`,
        suggestions: [
          "Traduction & Interprétation",
          "Relations internationales & Tourisme",
          "Enseignement des langues & Édition",
          "Je ne sais pas",
        ],
        vise: "Approfondir la filière langues, lettres et traduction",
        phase: 5,
        etape: 3,
      };
    }
    if (topDomain.includes("Communication") || topDomain.includes("Journalisme") || topDomain.includes("Médias")) {
      return {
        type: "question",
        intent_id: "intent_approfondir_domaine",
        question: `${nameGreet}dans la communication et les médias, es-tu plus attiré(e) par le journalisme (presse écrite, radio, TV), la communication d'entreprise / relations publiques, ou la création de contenu digital ?`,
        suggestions: [
          "Journalisme d'investigation & Presse",
          "Communication d'entreprise & RP",
          "Médias digitaux & Création de contenu",
          "Je ne sais pas",
        ],
        vise: "Approfondir la filière communication et journalisme",
        phase: 5,
        etape: 3,
      };
    }
    if (topDomain.includes("Droit") || topDomain.includes("Politique")) {
      return {
        type: "question",
        intent_id: "intent_approfondir_domaine",
        question: `${nameGreet}en droit et sciences politiques, vers quelle spécialité te projettes-tu : les carrières judiciaires (avocat, magistrat, greffier), le droit des affaires et des contrats, ou la diplomatie et l'administration ?`,
        suggestions: [
          "Carrières judiciaires (avocat, magistrat)",
          "Droit des affaires & entreprises",
          "Diplomatie & Sciences politiques",
          "Je ne sais pas",
        ],
        vise: "Approfondir la filière droit et sciences politiques",
        phase: 5,
        etape: 3,
      };
    }
    if (topDomain.includes("Administration") || topDomain.includes("Ressources Humaines") || topDomain.includes("RH")) {
      return {
        type: "question",
        intent_id: "intent_approfondir_domaine",
        question: `${nameGreet}dans l'administration et les RH, préfères-tu la gestion des ressources humaines en entreprise, les concours de la fonction publique (ENA, Douanes), ou la gestion de projets sociaux ?`,
        suggestions: [
          "Ressources Humaines en entreprise",
          "Concours administratifs (ENA, Douanes)",
          "Gestion de projets sociaux",
          "Je ne sais pas",
        ],
        vise: "Approfondir la filière administration et RH",
        phase: 5,
        etape: 3,
      };
    }
    if (topDomain.includes("Sociales") || topDomain.includes("Sociologie") || topDomain.includes("Psychologie")) {
      return {
        type: "question",
        intent_id: "intent_approfondir_domaine",
        question: `${nameGreet}dans les sciences humaines, qu'est-ce qui t'intéresse le plus : la sociologie et l'analyse de société, la psychologie et l'accompagnement, ou l'histoire-géographie et l'aménagement ?`,
        suggestions: [
          "Sociologie & Études sociales",
          "Psychologie & Accompagnement",
          "Histoire, géographie & Aménagement",
          "Je ne sais pas",
        ],
        vise: "Approfondir les sciences humaines et sociales",
        phase: 5,
        etape: 3,
      };
    }
    if (topDomain.includes("Mécanique") || topDomain.includes("Usinage") || topDomain.includes("Fabrication")) {
      return {
        type: "question",
        intent_id: "intent_approfondir_domaine",
        question: `${nameGreet}en mécanique industrielle et fabrication, te diriges-tu plutôt vers la conception et le bureau d'études (CAO/DAO), l'usinage assisté par ordinateur (FAO), ou la maintenance industrielle ?`,
        suggestions: [
          "Conception & Bureau d'études (CAO)",
          "Usinage & Fabrication (FAO)",
          "Maintenance industrielle",
          "Je ne sais pas",
        ],
        vise: "Approfondir le génie mécanique et l'usinage",
        phase: 5,
        etape: 3,
      };
    }
    if (topDomain.includes("Électrique") || topDomain.includes("Électronique") || topDomain.includes("Électrotechnique") || topDomain.includes("Automatisme")) {
      return {
        type: "question",
        intent_id: "intent_approfondir_domaine",
        question: `${nameGreet}dans l'électricité et l'électronique, préfères-tu les réseaux d'énergie et énergies renouvelables, l'électronique et télécoms, ou l'automatisme et la robotique ?`,
        suggestions: [
          "Énergies & Réseaux électriques",
          "Électronique & Télécommunications",
          "Automatisme & Robotique",
          "Je ne sais pas",
        ],
        vise: "Approfondir le génie électrique et télécoms",
        phase: 5,
        etape: 3,
      };
    }
    if (topDomain.includes("Chimie")) {
      return {
        type: "question",
        intent_id: "intent_approfondir_domaine",
        question: `${nameGreet}en chimie industrielle, es-tu plus attiré(e) par les analyses et le contrôle qualité en laboratoire, les procédés industriels de fabrication, ou la chimie environnementale ?`,
        suggestions: [
          "Laboratoire & Contrôle qualité",
          "Procédés industriels de fabrication",
          "Chimie environnementale & Traitement de l'eau",
          "Je ne sais pas",
        ],
        vise: "Approfondir la chimie industrielle",
        phase: 5,
        etape: 3,
      };
    }
    if (topDomain.includes("Agroalimentaire")) {
      return {
        type: "question",
        intent_id: "intent_approfondir_domaine",
        question: `${nameGreet}dans l'agroalimentaire, t'intéresses-tu davantage à la transformation des produits locaux, au contrôle qualité et sécurité sanitaire des aliments, ou à la gestion de production ?`,
        suggestions: [
          "Transformation des produits locaux",
          "Contrôle qualité & Sécurité sanitaire",
          "Gestion de production agroalimentaire",
          "Je ne sais pas",
        ],
        vise: "Approfondir l'agroalimentaire",
        phase: 5,
        etape: 3,
      };
    }
    if (topDomain.includes("Agriculture") || topDomain.includes("Agronomie") || topDomain.includes("Environnement")) {
      return {
        type: "question",
        intent_id: "intent_approfondir_domaine",
        question: `${nameGreet}dans l'agriculture et l'environnement, vises-tu l'agronomie et la production végétale, l'agroécologie et le développement rural, ou la gestion des ressources naturelles ?`,
        suggestions: [
          "Agronomie & Production végétale",
          "Agroécologie & Développement rural",
          "Gestion des ressources naturelles",
          "Je ne sais pas",
        ],
        vise: "Approfondir l'agronomie et l'environnement",
        phase: 5,
        etape: 3,
      };
    }
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
