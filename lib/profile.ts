// ============================================================================
// SENORIENTATION - GESTION DU PROFIL DE CONVERSATION PROGRESSIF (ÉTAPES 1 À 5)
// ============================================================================

export interface ConversationProfile {
  serie: string | null;
  niveau: string | null;
  matieres_aimees: string[];
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
}

export const INITIAL_PROFILE: ConversationProfile = {
  serie: null,
  niveau: null,
  matieres_aimees: [],
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
};

/**
 * Fusionne la mise à jour issue du modèle JSON dans le profil courant
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
    etape: Math.min(
      5,
      Math.max(current.etape || 1, suggestedEtape || update.etape || current.etape || 1)
    ),
  };

  return merged;
}

/**
 * Met à jour le profil de manière déterministe par analyse heuristique
 * (Garantie de fonctionnement sans clé API externe ou en mode secours)
 */
export function heuristicUpdateProfile(
  current: ConversationProfile,
  history: { role: string; content: string }[],
  latestMessage: string
): ConversationProfile {
  const profile: ConversationProfile = {
    ...current,
    matieres_aimees: [...(current.matieres_aimees || [])],
    points_forts: [...(current.points_forts || [])],
    activites: [...(current.activites || [])],
    environnement: [...(current.environnement || [])],
    priorites: [...(current.priorites || [])],
    freins: [...(current.freins || [])],
  };

  const text = (
    history.map((h) => h.content).join(" ") + " " + latestMessage
  ).toLowerCase();

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
    else if (text.includes("bachelier") || text.includes("bac")) profile.niveau = "Nouveau Bachelier";
    else if (text.includes("réorientation") || text.includes("reorientation") || text.includes("changer")) profile.niveau = "Réorientation";
  }

  // 3. Détection des matières aimées
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
    gestion: "Gestion / Comptabilité",
    compta: "Gestion / Comptabilité",
    informatique: "Informatique",
    code: "Informatique",
  };

  for (const [key, label] of Object.entries(MATIERES_MAP)) {
    if (text.includes(key) && !profile.matieres_aimees.includes(label)) {
      profile.matieres_aimees.push(label);
    }
  }

  // 4. Façon de travailler / Points forts
  const FORTS_MAP: Record<string, string> = {
    logique: "Résoudre des problèmes de calcul",
    calcul: "Résoudre des problèmes de calcul",
    rédiger: "Écrire et argumenter",
    ecrire: "Écrire et argumenter",
    argumenter: "Écrire et argumenter",
    bricoler: "Bricoler avec les mains",
    pratique: "Travaux pratiques et terrain",
    aider: "Aider et soigner les gens",
    dessiner: "Créer et dessiner",
  };

  for (const [key, label] of Object.entries(FORTS_MAP)) {
    if (text.includes(key) && !profile.points_forts.includes(label)) {
      profile.points_forts.push(label);
    }
  }

  // 5. Cadre / Environnement de travail
  if (text.includes("bureau") && !profile.environnement.includes("Bureau")) {
    profile.environnement.push("Bureau");
  }
  if ((text.includes("chantier") || text.includes("terrain")) && !profile.environnement.includes("Chantier / Terrain")) {
    profile.environnement.push("Chantier / Terrain");
  }
  if (text.includes("hôpital") || text.includes("hopital") || text.includes("santé")) {
    if (!profile.environnement.includes("Hôpital / Santé")) profile.environnement.push("Hôpital / Santé");
  }
  if (text.includes("écran") || text.includes("ordinateur")) {
    if (!profile.environnement.includes("Devant un écran")) profile.environnement.push("Devant un écran");
  }

  // 6. Détection du projet ou métier
  if (!profile.projet) {
    if (text.includes("médecin") || text.includes("medecin") || text.includes("santé")) {
      profile.projet = "Médecine et santé";
    } else if (text.includes("ingénieur") || text.includes("ingenieur") || text.includes("informatique") || text.includes("développeur")) {
      profile.projet = "Informatique et ingénierie";
    } else if (text.includes("avocat") || text.includes("magistrat") || text.includes("juriste") || text.includes("droit")) {
      profile.projet = "Droit et justice";
    } else if (text.includes("expert-comptable") || text.includes("banque") || text.includes("finance") || text.includes("audit")) {
      profile.projet = "Finance et gestion";
    } else if (text.includes("journaliste") || text.includes("communication")) {
      profile.projet = "Journalisme et communication";
    } else if (text.includes("agronome") || text.includes("agriculture")) {
      profile.projet = "Agronomie et environnement";
    }
  }

  // 7. Détection de la ville ou région
  if (!profile.ville) {
    if (text.includes("dakar")) profile.ville = "Dakar";
    else if (text.includes("saint-louis") || text.includes("saint louis")) profile.ville = "Saint-Louis";
    else if (text.includes("thiès") || text.includes("thies")) profile.ville = "Thiès";
    else if (text.includes("ziguinchor")) profile.ville = "Ziguinchor";
    else if (text.includes("kaolack")) profile.ville = "Kaolack";
    else if (text.includes("bambey")) profile.ville = "Bambey";
  }

  // 8. Détection du budget
  if (!profile.budget) {
    if (text.includes("public") || text.includes("campusen") || text.includes("25 000") || text.includes("25000")) {
      profile.budget = "Public gratuit ou presque (Campusen)";
    } else if (text.includes("privé") || text.includes("prive")) {
      profile.budget = "Privé payant";
    }
  }

  // 9. Détection de la moyenne
  if (!profile.moyenne) {
    const moyenneMatch = latestMessage.match(/\b([1-2]?[0-9](?:[.,][0-9]{1,2})?)\s*(?:\/20|de moyenne|\s*moyenne)?\b/i);
    if (moyenneMatch && parseFloat(moyenneMatch[1].replace(",", ".")) <= 20) {
      profile.moyenne = moyenneMatch[1].replace(",", ".");
    }
  }

  // 10. Progression des étapes (1 à 5)
  // Étape 1 : Accueil / Série
  // Étape 2 : Découverte (matières, façon de travailler, cadre)
  // Étape 3 : Devinette (dès série + au moins un centre d'intérêt)
  // Étape 4 : Approfondissement d'une piste
  // Étape 5 : Plan d'action final
  let computedEtape = profile.etape || 1;

  if (profile.serie) {
    computedEtape = Math.max(computedEtape, 2);
  }

  const hasInterests =
    profile.matieres_aimees.length > 0 ||
    profile.points_forts.length > 0 ||
    profile.activites.length > 0 ||
    profile.environnement.length > 0 ||
    Boolean(profile.projet);

  if (profile.serie && hasInterests) {
    computedEtape = Math.max(computedEtape, 3);
  }

  profile.etape = Math.min(5, Math.max(current.etape || 1, computedEtape));
  return profile;
}
