// ============================================================================
// SENORIENTATION - GESTION DU PROFIL DE CONVERSATION PROGRESSIF (ÉTAPES 1 À 5)
// ============================================================================

import { getAIModel } from "@/lib/ai";
import { generateText } from "ai";

export interface ConversationProfile {
  serie: string | null;
  matieres_aimees: string[];
  points_forts: string[];
  projet: string | null;
  ville: string | null;
  budget: string | null;
  moyenne: number | string | null;
  etape: number; // 1 à 5
}

export const INITIAL_PROFILE: ConversationProfile = {
  serie: null,
  matieres_aimees: [],
  points_forts: [],
  projet: null,
  ville: null,
  budget: null,
  moyenne: null,
  etape: 1,
};

/**
 * Met à jour le profil de manière déterministe par analyse heuristique
 * (Garantie de fonctionnement hors ligne ou en cas de quota dépassé)
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

  // 2. Détection des matières aimées
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

  // 3. Détection des points forts
  const FORTS_MAP: Record<string, string> = {
    logique: "Raisonnement logique",
    rédaction: "Expression écrite & Rédaction",
    redaction: "Expression écrite & Rédaction",
    analyse: "Esprit d'analyse",
    parler: "Aisance orale & Communication",
    créatif: "Créativité & Innovation",
    technique: "Rigueur technique",
  };

  for (const [key, label] of Object.entries(FORTS_MAP)) {
    if (text.includes(key) && !profile.points_forts.includes(label)) {
      profile.points_forts.push(label);
    }
  }

  // 4. Détection du projet ou métier
  if (!profile.projet) {
    if (text.includes("médecin") || text.includes("medecin") || text.includes("santé")) {
      profile.projet = "Médecine & Métiers de la Santé";
    } else if (text.includes("ingénieur") || text.includes("ingenieur") || text.includes("informatique") || text.includes("développeur")) {
      profile.projet = "Ingénierie & Informatique / Nouvelles Technologies";
    } else if (text.includes("avocat") || text.includes("magistrat") || text.includes("juriste") || text.includes("droit")) {
      profile.projet = "Droit, Magistrature & Carrières Juridiques";
    } else if (text.includes("expert-comptable") || text.includes("banque") || text.includes("finance") || text.includes("audit")) {
      profile.projet = "Finance, Audit & Comptabilité";
    } else if (text.includes("journaliste") || text.includes("communication")) {
      profile.projet = "Journalisme & Communication (CESTI / Médias)";
    } else if (text.includes("agronome") || text.includes("agriculture")) {
      profile.projet = "Agronomie & Agro-business";
    }
  }

  // 5. Détection de la ville ou région
  if (!profile.ville) {
    if (text.includes("dakar")) profile.ville = "Dakar";
    else if (text.includes("saint-louis") || text.includes("saint louis")) profile.ville = "Saint-Louis";
    else if (text.includes("thiès") || text.includes("thies")) profile.ville = "Thiès";
    else if (text.includes("ziguinchor")) profile.ville = "Ziguinchor";
    else if (text.includes("kaolack")) profile.ville = "Kaolack";
    else if (text.includes("bambey")) profile.ville = "Bambey";
    else if (text.includes("diamniadio")) profile.ville = "Diamniadio";
  }

  // 6. Détection du budget / public vs privé
  if (!profile.budget) {
    if (text.includes("public") || text.includes("campusen") || text.includes("25 000") || text.includes("25000")) {
      profile.budget = "Universités publiques (Campusen ~25 000 FCFA/an)";
    } else if (text.includes("privé") || text.includes("prive") || text.includes("ecole de commerce")) {
      profile.budget = "Établissement privé accrédité ANAQ-Sup";
    } else if (text.includes("bourse")) {
      profile.budget = "Bourse de l'État sénégalais (DGES) indispensable";
    }
  }

  // 7. Détection de la moyenne
  if (!profile.moyenne) {
    const moyenneMatch = latestMessage.match(/\b([1-2]?[0-9](?:[.,][0-9]{1,2})?)\s*(?:\/20|de moyenne|\s*moyenne)?\b/i);
    if (moyenneMatch && parseFloat(moyenneMatch[1].replace(",", ".")) <= 20) {
      profile.moyenne = moyenneMatch[1].replace(",", ".");
    }
  }

  // 8. Calcul progressif de l'étape (1 à 5, ne régresse jamais)
  let computedEtape = profile.etape || 1;

  if (profile.serie) {
    computedEtape = Math.max(computedEtape, 2);
  }
  if (profile.matieres_aimees.length > 0 || profile.moyenne !== null || profile.points_forts.length > 0) {
    computedEtape = Math.max(computedEtape, 3);
  }
  if (profile.projet !== null || profile.ville !== null) {
    computedEtape = Math.max(computedEtape, 4);
  }
  if (profile.budget !== null || (profile.serie && profile.projet && profile.matieres_aimees.length > 0)) {
    // Si la discussion a déjà bien progressé (plus de 4 messages de l'élève) ou profil rempli
    const userMsgCount = history.filter((h) => h.role === "user").length + 1;
    if (userMsgCount >= 4 || (profile.serie && profile.projet && profile.budget)) {
      computedEtape = 5;
    }
  }

  profile.etape = Math.min(5, Math.max(current.etape || 1, computedEtape));
  return profile;
}

/**
 * Appel court de mise à jour du profil à partir du message utilisateur et de l'historique
 */
export async function updateConversationProfile(
  current: ConversationProfile,
  history: { role: string; content: string }[],
  latestMessage: string
): Promise<ConversationProfile> {
  const model = getAIModel();

  // Si aucun modèle OpenAI configuré, utiliser l'analyse heuristique déterministe
  if (!model) {
    return heuristicUpdateProfile(current, history, latestMessage);
  }

  try {
    const recentHistory = history.slice(-6).map((m) => `${m.role}: ${m.content}`).join("\n");

    const prompt = `Tu es un extracteur d'informations pour un conseiller d'orientation scolaire au Sénégal.
À partir du PROFIL ACTUEL, de l'HISTORIQUE RÉCENT et du DERNIER MESSAGE, retourne l'objet profil mis à jour en JSON strict valide.

PROFIL ACTUEL :
${JSON.stringify(current)}

HISTORIQUE RÉCENT :
${recentHistory}

DERNIER MESSAGE DE L'ÉLÈVE :
"${latestMessage}"

RÈGLES D'EXTRACTION :
1. "serie" : série de Bac au Sénégal (ex: "S1", "S2", "S3", "L1", "L2", "L'", "G / STEG", "T1", "T2") ou null si inconnue.
2. "matieres_aimees" : tableau des matières que l'élève aime ou préfère (ex: ["Mathématiques", "SVT"]).
3. "points_forts" : tableau des points forts ou compétences cités.
4. "projet" : filière souhaitée, domaine ou métier visé (ex: "Médecine", "Informatique", "Droit").
5. "ville" : ville de résidence ou d'études souhaitée au Sénégal (ex: "Dakar", "Saint-Louis", "Thiès").
6. "budget" : indication budgétaire ou préférence ("public uniquement", "privé avec bourse", montant...).
7. "moyenne" : moyenne générale citée au Bac ou en classe (nombre ou string, ex: "13.5") ou null.
8. "etape" : entier de 1 à 5 progressif (ne jamais régresser sous ${current.etape || 1}) :
   - 1 : Découverte initiale (aucune série ni domaine connu)
   - 2 : Série ou domaine général connu
   - 3 : Matières aimées, points forts ou moyenne connus
   - 4 : Projet métier et/ou ville connus
   - 5 : Profil complet avec budget/préférences -> Prêt pour le récapitulatif final

Réponds UNIQUEMENT le JSON strict suivant sans markdown ni balises :
{"serie": string|null, "matieres_aimees": string[], "points_forts": string[], "projet": string|null, "ville": string|null, "budget": string|null, "moyenne": number|string|null, "etape": number}`;

    const { text } = await generateText({
      model,
      prompt,
      maxTokens: 250,
      temperature: 0.1,
    });

    const cleaned = text.trim().replace(/^```json/i, "").replace(/```$/i, "").trim();
    const parsed = JSON.parse(cleaned);

    return {
      serie: parsed.serie ?? current.serie,
      matieres_aimees: Array.isArray(parsed.matieres_aimees) ? parsed.matieres_aimees : current.matieres_aimees,
      points_forts: Array.isArray(parsed.points_forts) ? parsed.points_forts : current.points_forts,
      projet: parsed.projet ?? current.projet,
      ville: parsed.ville ?? current.ville,
      budget: parsed.budget ?? current.budget,
      moyenne: parsed.moyenne ?? current.moyenne,
      etape: Math.min(5, Math.max(current.etape || 1, Number(parsed.etape) || current.etape || 1)),
    };
  } catch {
    // Repli heuristique si le parse ou l'appel échoue
    return heuristicUpdateProfile(current, history, latestMessage);
  }
}
