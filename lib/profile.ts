// ============================================================================
// SENORIENTATION - DOSSIER DE L'ENQUÊTEUR (PROFIL PROGRESSIF ÉTAPES 1 À 5)
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
  serie: string | null;
  niveau: string | null;
  matieres_aimees: string[];
  matieres_fuies: string[];
  points_forts: string[];
  activites: string[];
  environnement: string[];
  projet: string | null;
  ville: string | null;
  budget: string | null;
  moyenne: number | string | null;
  duree_souhaitee: string | null;
  priorites: string[];
  freins: string[];
  etape: number; // 1 à 5
  indices?: Indice[];
  hypotheses?: Hypothese[];
}

export const INITIAL_PROFILE: ConversationProfile = {
  serie: null,
  niveau: null,
  matieres_aimees: [],
  matieres_fuies: [],
  points_forts: [],
  activites: [],
  environnement: [],
  projet: null,
  ville: null,
  budget: null,
  moyenne: null,
  duree_souhaitee: null,
  priorites: [],
  freins: [],
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
    serie: update.serie || current.serie,
    niveau: update.niveau || current.niveau,
    projet: update.projet || current.projet,
    ville: update.ville || current.ville,
    budget: update.budget || current.budget,
    moyenne: update.moyenne || current.moyenne,
    duree_souhaitee: update.duree_souhaitee || current.duree_souhaitee,
    matieres_aimees: Array.from(
      new Set([...(current.matieres_aimees || []), ...(update.matieres_aimees || [])])
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
    environnement: Array.from(
      new Set([...(current.environnement || []), ...(update.environnement || [])])
    ).filter(Boolean),
    priorites: Array.from(
      new Set([...(current.priorites || []), ...(update.priorites || [])])
    ).filter(Boolean),
    freins: Array.from(
      new Set([...(current.freins || []), ...(update.freins || [])])
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
  current: ConversationProfile,
  history: { role: string; content: string }[],
  latestMessage: string
): ConversationProfile {
  const profile: ConversationProfile = {
    ...current,
    matieres_aimees: [...(current.matieres_aimees || [])],
    matieres_fuies: [...(current.matieres_fuies || [])],
    points_forts: [...(current.points_forts || [])],
    activites: [...(current.activites || [])],
    environnement: [...(current.environnement || [])],
    priorites: [...(current.priorites || [])],
    freins: [...(current.freins || [])],
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

  // 1. Détection de la série
  if (!profile.serie) {
    if (text.includes("s1")) profile.serie = "S1";
    else if (text.includes("s2")) profile.serie = "S2";
    else if (text.includes("s3")) profile.serie = "S3";
    else if (text.includes("l1")) profile.serie = "L1";
    else if (text.includes("l2") || text.includes("littéraire")) profile.serie = "L2";
    else if (text.includes("l'")) profile.serie = "L'";
    else if (text.includes("steg") || text.includes("bac g")) profile.serie = "G / STEG";
    else if (text.includes("t1")) profile.serie = "T1";
    else if (text.includes("t2")) profile.serie = "T2";
  }

  // 2. Détection du niveau
  if (!profile.niveau) {
    if (text.includes("terminale") || text.includes("tle")) profile.niveau = "Terminale";
    else if (text.includes("bachelier")) profile.niveau = "Nouveau Bachelier";
  }

  // 3. Détection des matières aimées et fuies
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
    code: "Informatique",
  };

  for (const [key, label] of Object.entries(MATIERES_MAP)) {
    if (text.includes(`fuis ${key}`) || text.includes(`déteste ${key}`) || text.includes(`nul en ${key}`)) {
      if (!profile.matieres_fuies.includes(label)) profile.matieres_fuies.push(label);
    } else if (text.includes(key) && !profile.matieres_aimees.includes(label) && !profile.matieres_fuies.includes(label)) {
      profile.matieres_aimees.push(label);
    }
  }

  // 4. Activités et points forts
  if ((text.includes("fifa") || text.includes("jeux vidéo") || text.includes("gaming")) && !profile.activites.includes("Jeux vidéo / Compétition")) {
    profile.activites.push("Jeux vidéo / Compétition");
  }
  if ((text.includes("calcul") || text.includes("logique") || text.includes("énigme")) && !profile.points_forts.includes("Calcul et logique")) {
    profile.points_forts.push("Calcul et logique");
  }
  if ((text.includes("rédiger") || text.includes("écrire") || text.includes("argumenter")) && !profile.points_forts.includes("Écriture et argumentation")) {
    profile.points_forts.push("Écriture et argumentation");
  }
  if ((text.includes("bricoler") || text.includes("réparer") || text.includes("mains")) && !profile.points_forts.includes("Bricolage et réparation")) {
    profile.points_forts.push("Bricolage et réparation");
  }
  if ((text.includes("aider") || text.includes("soigner")) && !profile.points_forts.includes("Aide et écoute")) {
    profile.points_forts.push("Aide et écoute");
  }

  // 5. Cadre professionnel
  if (text.includes("bureau") && !profile.environnement.includes("Bureau")) profile.environnement.push("Bureau");
  if ((text.includes("chantier") || text.includes("terrain")) && !profile.environnement.includes("Terrain")) profile.environnement.push("Terrain");
  if (text.includes("hôpital") || text.includes("hopital")) profile.environnement.push("Hôpital");
  if (text.includes("écran") || text.includes("ordinateur")) profile.environnement.push("Devant un écran");

  // 6. Projet
  if (!profile.projet) {
    if (text.includes("médecin") || text.includes("santé")) profile.projet = "Médecine et santé";
    else if (text.includes("ingénieur") || text.includes("développeur")) profile.projet = "Ingénierie et informatique";
    else if (text.includes("avocat") || text.includes("juriste")) profile.projet = "Droit et justice";
    else if (text.includes("comptable") || text.includes("finance")) profile.projet = "Finance et gestion";
  }

  // 7. Ville & Budget
  if (!profile.ville) {
    if (text.includes("dakar")) profile.ville = "Dakar";
    else if (text.includes("saint-louis")) profile.ville = "Saint-Louis";
    else if (text.includes("thiès")) profile.ville = "Thiès";
  }
  if (!profile.budget) {
    if (text.includes("public") || text.includes("campusen") || text.includes("25 000")) profile.budget = "Public Campusen";
    else if (text.includes("privé")) profile.budget = "Privé";
  }

  // Calcul d'étape selon la règle d'or de la section 3 :
  // On ne passe à l'étape 3 (verdict/pistes) QUE SI :
  // (a) série ou niveau connu ET (b) au moins DEUX indices certains parmi matières_aimees, points_forts, activites, projet, environnement
  let certainIndicesCount = 0;
  if (profile.matieres_aimees.length > 0) certainIndicesCount += profile.matieres_aimees.length;
  if (profile.points_forts.length > 0) certainIndicesCount += profile.points_forts.length;
  if (profile.activites.length > 0) certainIndicesCount += profile.activites.length;
  if (profile.environnement.length > 0) certainIndicesCount += profile.environnement.length;
  if (profile.projet) certainIndicesCount += 1;

  let computedEtape = profile.etape || 1;

  if (profile.serie || profile.niveau) {
    computedEtape = Math.max(computedEtape, 2);
  }

  // Section 3 : minimum série + 2 indices certains pour étape 3
  if ((profile.serie || profile.niveau) && certainIndicesCount >= 2) {
    computedEtape = Math.max(computedEtape, 3);
  }

  profile.etape = Math.min(5, Math.max(current.etape || 1, computedEtape));
  return profile;
}
