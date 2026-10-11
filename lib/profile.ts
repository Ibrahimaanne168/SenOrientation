// ============================================================================
// SENORIENTATION - DOSSIER CONVERSATIONNEL D'ORIENTATION PROFESSIONNELLE
// Profil évolutif, mémoire structurée et moteur de sélection de la prochaine question
// ============================================================================

export interface Indice {
  texte: string;
  statut: "certain" | "probable" | "a_verifier";
}

export interface Hypothese {
  domaine: string;
  confiance: "faible" | "moyenne" | "forte";
}

export interface ConversationProfile {
  prenom?: string | null;
  niveau?: string | null; // Collège, Lycée, Terminale, Bachelier, Université, Réorientation
  serie: string | null;   // S1, S2, S3, L1, L2, L', G/STEG, T1, T2
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
  questions_posees: string[];
  domaines_explores: string[];
  formations_recommandees: string[];
  etape: number; // 1 à 5
  indices?: Indice[];
  hypotheses?: Hypothese[];
}

export const INITIAL_PROFILE: ConversationProfile = {
  prenom: null,
  niveau: null,
  serie: null,
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
  indices: [],
  hypotheses: [],
};

/**
 * Fusionne la mise à jour du dossier dans le profil courant
 */
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
    environnement: Array.from(
      new Set([...(current.environnement || []), ...(update.environnement || [])])
    ).filter(Boolean),
    priorites: Array.from(
      new Set([...(current.priorites || []), ...(update.priorites || [])])
    ).filter(Boolean),
    freins: Array.from(
      new Set([...(current.freins || []), ...(update.freins || [])])
    ).filter(Boolean),
    questions_posees: Array.from(
      new Set([...(current.questions_posees || []), ...(update.questions_posees || [])])
    ).filter(Boolean),
    domaines_explores: Array.from(
      new Set([...(current.domaines_explores || []), ...(update.domaines_explores || [])])
    ).filter(Boolean),
    formations_recommandees: Array.from(
      new Set([...(current.formations_recommandees || []), ...(update.formations_recommandees || [])])
    ).filter(Boolean),
    indices: update.indices || current.indices || [],
    hypotheses: update.hypotheses || current.hypotheses || [],
    etape: Math.min(
      5,
      Math.max(current.etape || 1, suggestedEtape || update.etape || current.etape || 1)
    ),
  };

  return merged;
}

/**
 * Analyse heuristique des indices du dossier
 */
export function heuristicUpdateProfile(
  arg1: ConversationProfile | string,
  arg2?: { role: string; content: string }[] | ConversationProfile | string,
  arg3?: string | { role: string; content: string }[]
): ConversationProfile {
  let current: ConversationProfile;
  let history: { role: string; content: string }[] = [];
  let latestMessage = "";

  if (typeof arg1 === "string") {
    latestMessage = arg1;
    current = (typeof arg2 === "object" && arg2 !== null && !Array.isArray(arg2))
      ? (arg2 as ConversationProfile)
      : INITIAL_PROFILE;
    if (Array.isArray(arg3)) history = arg3;
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
    matieres_aimees: [...(current.matieres_aimees || [])],
    matieres_competentes: [...(current.matieres_competentes || [])],
    matieres_fuies: [...(current.matieres_fuies || [])],
    points_forts: [...(current.points_forts || [])],
    activites: [...(current.activites || [])],
    competences_declarees: [...(current.competences_declarees || [])],
    ambitions: [...(current.ambitions || [])],
    environnement: [...(current.environnement || [])],
    priorites: [...(current.priorites || [])],
    freins: [...(current.freins || [])],
    questions_posees: [...(current.questions_posees || [])],
    domaines_explores: [...(current.domaines_explores || [])],
    formations_recommandees: [...(current.formations_recommandees || [])],
    indices: [...(current.indices || [])],
    hypotheses: [...(current.hypotheses || [])],
  };

  const text = (
    history.map((h) => h.content).join(" ") + " " + latestMessage
  ).toLowerCase();

  const latestLower = latestMessage.toLowerCase().trim();

  // Gestion du cas où l'élève clique sur "Autre série ou réorientation"
  if (latestLower.includes("autre série") || latestLower.includes("réorientation")) {
    profile.serie = null;
    profile.niveau = "Réorientation";
    profile.hypotheses = [];
    profile.etape = 1;
    return profile;
  }

  // 0. Détection du prénom si non renseigné
  if (!profile.prenom) {
    if (
      latestLower.includes("préfère ne pas le dire") ||
      latestLower.includes("prefere pas") ||
      latestLower.includes("anonyme")
    ) {
      profile.prenom = "l'ami";
    } else {
      const explicitMatch = latestMessage.match(
        /(?:je m['’]appelle|moi c['’]est|mon pr[ée]nom est|mon nom est|c['’]est)\s+([A-Za-zÀ-ÿ\-]+(?:\s+[A-Za-zÀ-ÿ\-]+)?)/i
      );
      if (explicitMatch && explicitMatch[1]) {
        const candidate = explicitMatch[1].trim();
        const candLower = candidate.toLowerCase();
        if (
          !candLower.includes("bac") &&
          !candLower.includes("terminale") &&
          !candLower.includes("perdu") &&
          !candLower.includes("élève")
        ) {
          profile.prenom = candidate.charAt(0).toUpperCase() + candidate.slice(1);
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
        // Réponse directe à la question du prénom
        const cleanName = latestMessage.replace(/[.!?,]/g, "").trim();
        const words = cleanName.split(/\s+/);
        if (words.length >= 1 && words.length <= 3 && words.every((w) => /^[A-Za-zÀ-ÿ\-]+$/.test(w))) {
          profile.prenom = words.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
        }
      }
    }
  }

  // 1. Détection de la série
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
  }

  // 2. Détection du niveau scolaire
  if (!profile.niveau) {
    if (text.includes("réorient") || text.includes("changer de filière") || text.includes("changement de parcours")) {
      profile.niveau = "Réorientation / Étudiant";
    } else if (text.includes("terminale") || text.includes("tle")) {
      profile.niveau = "Terminale";
    } else if (text.includes("nouveau bachelier") || text.includes("bachelier")) {
      profile.niveau = "Nouveau Bachelier";
    } else if (text.includes("lycée") || text.includes("première") || text.includes("seconde")) {
      profile.niveau = "Lycée";
    } else if (text.includes("collège")) {
      profile.niveau = "Collège";
    } else if (text.includes("université") || text.includes("licence") || text.includes("étudiant")) {
      profile.niveau = "Université";
    }
  }

  // 3. Détection des grands domaines d'intérêt
  const DOMAIN_MAP: Record<string, string> = {
    informatique: "Informatique & Technologies",
    code: "Informatique & Technologies",
    logiciel: "Informatique & Technologies",
    ia: "Informatique & Technologies",
    "intelligence artificielle": "Informatique & Technologies",
    cybersécurité: "Informatique & Technologies",
    math: "Mathématiques & Sciences",
    calcul: "Mathématiques & Sciences",
    santé: "Médecine & Santé",
    médecine: "Médecine & Santé",
    biologie: "Médecine & Santé",
    svt: "Médecine & Santé",
    pharmacie: "Médecine & Santé",
    droit: "Droit & Sciences Politiques",
    justice: "Droit & Sciences Politiques",
    gestion: "Commerce & Gestion",
    commerce: "Commerce & Gestion",
    finance: "Commerce & Gestion",
    comptab: "Commerce & Gestion",
    marketing: "Commerce & Gestion",
    communication: "Communication & Médias",
    journalisme: "Communication & Médias",
    médias: "Communication & Médias",
    ingénierie: "Ingénierie & BTP",
    btp: "Ingénierie & BTP",
    "génie civil": "Ingénierie & BTP",
    agronomie: "Agriculture & Environnement",
    agriculture: "Agriculture & Environnement",
    environnement: "Agriculture & Environnement",
    enseignement: "Enseignement & Recherche",
    art: "Arts & Design",
    design: "Arts & Design",
  };

  for (const [key, domain] of Object.entries(DOMAIN_MAP)) {
    if (text.includes(key) && !profile.interets_principaux.includes(domain)) {
      profile.interets_principaux.push(domain);
      if (!profile.domaines_explores.includes(domain)) {
        profile.domaines_explores.push(domain);
      }
    }
  }

  // 4. Détection des matières aimées, compétentes et fuies
  const MATIERES_MAP: Record<string, string> = {
    math: "Mathématiques",
    calcul: "Mathématiques",
    physique: "Sciences Physiques",
    chimie: "Chimie",
    svt: "SVT / Biologie",
    biologie: "SVT / Biologie",
    philo: "Philosophie",
    francais: "Français",
    français: "Français",
    anglais: "Anglais",
    histoire: "Histoire-Géographie",
    géo: "Histoire-Géographie",
    économie: "Économie",
    gestion: "Gestion",
    informatique: "Informatique",
  };

  for (const [key, label] of Object.entries(MATIERES_MAP)) {
    if (text.includes(`fuis ${key}`) || text.includes(`déteste ${key}`) || text.includes(`nul en ${key}`) || text.includes(`nulle en ${key}`)) {
      if (!profile.matieres_fuies.includes(label)) profile.matieres_fuies.push(label);
    } else if (text.includes(`à l'aise en ${key}`) || text.includes(`bon en ${key}`) || text.includes(`bonne en ${key}`) || text.includes(`fort en ${key}`)) {
      if (!profile.matieres_competentes.includes(label)) profile.matieres_competentes.push(label);
      if (!profile.matieres_aimees.includes(label)) profile.matieres_aimees.push(label);
    } else if (text.includes(key) && !profile.matieres_aimees.includes(label) && !profile.matieres_fuies.includes(label)) {
      profile.matieres_aimees.push(label);
    }
  }

  // 5. Activités et points forts
  if ((text.includes("fifa") || text.includes("jeux vidéo") || text.includes("gaming")) && !profile.activites.includes("Jeux vidéo / Stratégie numérique")) {
    profile.activites.push("Jeux vidéo / Stratégie numérique");
  }
  if ((text.includes("calcul") || text.includes("logique") || text.includes("énigme")) && !profile.points_forts.includes("Calcul et raisonnement logique")) {
    profile.points_forts.push("Calcul et raisonnement logique");
    if (!profile.competences_declarees.includes("Résolution de problèmes complexes")) {
      profile.competences_declarees.push("Résolution de problèmes complexes");
    }
  }
  if ((text.includes("rédiger") || text.includes("écrire") || text.includes("argumenter")) && !profile.points_forts.includes("Écriture et argumentation")) {
    profile.points_forts.push("Écriture et argumentation");
  }
  if ((text.includes("bricoler") || text.includes("réparer") || text.includes("mains")) && !profile.points_forts.includes("Technique et bricolage")) {
    profile.points_forts.push("Technique et bricolage");
  }
  if ((text.includes("aider") || text.includes("soigner") || text.includes("écouter")) && !profile.points_forts.includes("Aide et écoute active")) {
    profile.points_forts.push("Aide et écoute active");
  }

  // 6. Moyenne générale
  if (!profile.moyenne) {
    const moyMatch =
      text.match(/(?:avec|environ|eu|ma|de)\s+(\d{1,2}(?:[.,]\d+)?)(?:\s*(?:\/20|de moyenne|moyenne))/i) ||
      text.match(/(\d{1,2}(?:[.,]\d+)?)\s*(?:\/20|de moyenne)/i) ||
      text.match(/\bmoyenne\s*(?:de|est|:)?\s*(\d{1,2}(?:[.,]\d+)?)/i);
    if (moyMatch && moyMatch[1]) {
      profile.moyenne = moyMatch[1].replace(",", ".");
    }
  }

  // 7. Ambitions et préférences d'études
  if (text.includes("courte") || text.includes("dut") || text.includes("bts") || text.includes("licence pro") || text.includes("2 ans") || text.includes("3 ans")) {
    profile.preferences_etudes = "Courte (Bac+2 / Bac+3)";
    profile.duree_souhaitee = "2 à 3 ans";
  } else if (text.includes("longue") || text.includes("master") || text.includes("ingénieur") || text.includes("bac+5") || text.includes("doctorat")) {
    profile.preferences_etudes = "Longue (Bac+5 et plus)";
    profile.duree_souhaitee = "5 ans";
  }

  // 7. Ville & Budget
  if (!profile.ville) {
    if (text.includes("dakar")) profile.ville = "Dakar";
    else if (text.includes("saint-louis") || text.includes("saint louis")) profile.ville = "Saint-Louis";
    else if (text.includes("thiès") || text.includes("thies")) profile.ville = "Thiès";
  }
  if (!profile.budget) {
    if (text.includes("public") || text.includes("campusen") || text.includes("25 000")) profile.budget = "Public Campusen (25 000 FCFA/an)";
    else if (text.includes("privé")) profile.budget = "Établissement privé accrédité";
  }

  // 8. Calcul de l'étape de la conversation
  let computedEtape = profile.etape || 1;

  if (profile.prenom) {
    computedEtape = Math.max(computedEtape, 1);
  }
  if (profile.serie || profile.niveau) {
    computedEtape = Math.max(computedEtape, 2);
  }
  if ((profile.serie || profile.niveau) && (profile.interets_principaux.length > 0 || profile.matieres_aimees.length > 0)) {
    computedEtape = Math.max(computedEtape, 3);
  }
  if (
    (profile.serie || profile.niveau) &&
    profile.interets_principaux.length > 0 &&
    (profile.points_forts.length > 0 || profile.matieres_competentes.length > 0 || profile.preferences_etudes)
  ) {
    computedEtape = Math.max(computedEtape, 4);
  }
  // Passer au bilan final si profil solide et cohérent
  if (
    (profile.serie || profile.niveau) &&
    profile.interets_principaux.length > 0 &&
    (profile.matieres_aimees.length > 0 || profile.points_forts.length > 0) &&
    (profile.preferences_etudes || profile.duree_souhaitee || profile.budget || profile.ville || profile.projet)
  ) {
    computedEtape = Math.max(computedEtape, 5);
  }

  profile.etape = Math.min(5, Math.max(current.etape || 1, computedEtape));
  return profile;
}

// ─────────────────────────────────────────────────────────────────────────────
// MOTEUR DE DÉCISION ADAPTATIF : SÉLECTION DE LA PROCHAINE QUESTION (SECTION 6)
// ─────────────────────────────────────────────────────────────────────────────

export interface OrientationDecision {
  type: "question" | "bilan";
  question: string;
  suggestions: string[];
  vise: string;
  etape: number;
}

export function getNextOrientationQuestion(profile: ConversationProfile): OrientationDecision {
  const namePart = profile.prenom && profile.prenom !== "l'ami" ? profile.prenom : "";
  const nameGreet = namePart ? `${namePart}, ` : "";

  // 1. Prénom non renseigné
  if (!profile.prenom) {
    return {
      type: "question",
      question: "Bonjour ! Je suis ton conseiller d'orientation SenOrientation. Pour faire connaissance et personnaliser notre échange, comment puis-je t'appeler ?",
      suggestions: ["Je préfère ne pas le dire"],
      vise: "Faire connaissance en demandant le prénom",
      etape: 1,
    };
  }

  // 2. Niveau ou série de Bac non renseigné
  if (!profile.serie && !profile.niveau) {
    return {
      type: "question",
      question: `Ravi de faire ta connaissance${namePart ? " " + namePart : ""} ! Où en es-tu actuellement dans tes études (lycée, classe de Terminale, nouveau bachelier, ou réorientation) et quelle est ta série ?`,
      suggestions: [
        "Terminale S1 ou S2",
        "Terminale L1 ou L2",
        "Nouveau bachelier",
        "Autre série ou réorientation",
      ],
      vise: "Identifier le niveau scolaire et la série de Bac",
      etape: 1,
    };
  }

  // 3. Cas de la réorientation
  if (profile.niveau === "Réorientation" && profile.interets_principaux.length === 0) {
    return {
      type: "question",
      question: `${namePart ? namePart + ", " : ""}qu'est-ce qui ne t'a pas convenu dans ton parcours précédent, et vers quel type de domaine aimerais-tu te diriger cette fois-ci ?`,
      suggestions: [
        "Sciences et informatique",
        "Commerce et gestion",
        "Santé ou social",
        "Je ne sais pas encore",
      ],
      vise: "Comprendre les motifs de réorientation et le nouveau cap",
      etape: 2,
    };
  }

  // 4. Découverte des centres d'intérêt principaux
  if (profile.interets_principaux.length === 0 && profile.matieres_aimees.length === 0) {
    return {
      type: "question",
      question: `Intéressant avec ta série ${profile.serie || "actuelle"}. Pour cibler les formations qui te correspondent vraiment, quels sont les domaines qui t'attirent le plus au quotidien ?`,
      suggestions: [
        "Sciences, maths & informatique",
        "Médecine, santé & biologie",
        "Commerce, gestion & finance",
        "Droit, communication & lettres",
        "Je ne sais pas encore",
      ],
      vise: "Découvrir les centres d'intérêt majeurs",
      etape: 2,
    };
  }

  // 5. Approfondissement ciblé d'un domaine sélectionné
  if (profile.interets_principaux.includes("Informatique & Technologies") && !profile.projet) {
    return {
      type: "question",
      question: `${nameGreet}dans le numérique et l'informatique, qu'est-ce qui te plairait le plus : concevoir des applications, analyser des données et l'IA, ou sécuriser les systèmes (cybersécurité) ?`,
      suggestions: [
        "Créer des applications et logiciels",
        "Intelligence Artificielle & Data",
        "Cybersécurité & Réseaux",
        "Je ne sais pas",
      ],
      vise: "Approfondir le sous-domaine informatique",
      etape: 3,
    };
  }

  if (profile.interets_principaux.includes("Médecine & Santé") && !profile.projet) {
    return {
      type: "question",
      question: `${nameGreet}dans le domaine de la santé, es-tu plutôt attiré(e) par la médecine générale, la pharmacie, les soins infirmiers, ou la recherche en laboratoire ?`,
      suggestions: [
        "Médecine ou odontologie",
        "Pharmacie & Laboratoires",
        "Soins infirmiers / Santé publique",
        "Je ne sais pas",
      ],
      vise: "Approfondir la filière santé",
      etape: 3,
    };
  }

  // 6. Matières de prédilection et compétences déclarées
  if (profile.points_forts.length === 0 && profile.matieres_competentes.length === 0) {
    return {
      type: "question",
      question: "Dans quelles matières ou façons d'agir te sens-tu le plus à l'aise : résoudre des problèmes de calcul, rédiger et argumenter, ou manipuler et pratiquer ?",
      suggestions: [
        "Calcul, logique et rigueur",
        "Rédaction, langues et argumentation",
        "Pratique, manipulation et terrain",
        "Je ne sais pas",
      ],
      vise: "Identifier les aptitudes et points forts concrets",
      etape: 3,
    };
  }

  // 7. Durée des études et type de formation (courte vs longue)
  if (!profile.preferences_etudes && !profile.duree_souhaitee) {
    return {
      type: "question",
      question: "Envisages-tu plutôt des études courtes pour t'insérer rapidement dans l'emploi (2 à 3 ans : BTS, DUT, Licence pro) ou un cursus universitaire long (Bac+5 : Master, école d'ingénieurs) ?",
      suggestions: [
        "Études courtes (2 à 3 ans)",
        "Études longues (Bac+5)",
        "Les deux m'intéressent",
        "Je ne sais pas",
      ],
      vise: "Cerner la durée et le format d'études envisagés",
      etape: 4,
    };
  }

  // 8. Contraintes de budget ou de ville (si tout le reste est renseigné)
  if (!profile.budget && !profile.ville) {
    return {
      type: "question",
      question: "As-tu une préférence entre les universités publiques (Campusen) et les instituts privés, ou une ville spécifique au Sénégal où tu souhaites étudier ?",
      suggestions: [
        "Public Campusen en priorité",
        "Dakar en priorité",
        "Peu importe, le meilleur cursus",
        "Je ne sais pas",
      ],
      vise: "Identifier les contraintes de budget et de localisation",
      etape: 4,
    };
  }

  // 9. Profil suffisant pour le Bilan Final (Étape 5)
  return {
    type: "bilan",
    question: "Parmi ces parcours recommandés, lequel aimerais-tu approfondir en premier ?",
    suggestions: [
      "Approfondir la première option",
      "Voir les démarches Campusen",
      "Comparer les débouchés",
      "Je souhaite ajuster mon profil",
    ],
    vise: "Présenter le bilan final structuré et orienter les démarches",
    etape: 5,
  };
}
