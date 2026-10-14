#!/usr/bin/env npx tsx
/**
 * Test Suite des 15 Scénarios Obligatoires de SenOrientation (Section 8 du cahier des charges)
 */

import {
  INITIAL_PROFILE,
  heuristicUpdateProfile,
  getNextOrientationQuestion,
  ConversationProfile,
} from "../lib/profile";
import { searchKnowledge, findMatchingFormations } from "../lib/rag";

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, testNum: number, title: string, detail: string) {
  if (!condition) {
    console.error(`❌ [Scénario ${testNum}] FAILED: ${title} — ${detail}`);
    failedCount++;
    process.exitCode = 1;
  } else {
    console.log(`✅ [Scénario ${testNum}] PASSED: ${title} — ${detail}`);
    passedCount++;
  }
}

async function run15Scenarios() {
  console.log("========================================================================");
  console.log("VALIDATION DES 15 SCÉNARIOS OBLIGATOIRES — PIPELINE SENORIENTATION");
  console.log("========================================================================\n");

  // ─────────────────────────────────────────────────────────────────────────
  // SCÉNARIO 1 : L'étudiant donne toutes ses informations scolaires dans un seul message
  // ─────────────────────────────────────────────────────────────────────────
  console.log("--- Scénario 1 : Informations scolaires complètes en un message ---");
  const p1 = heuristicUpdateProfile("Je suis au lycée de Rufisque, en Terminale S2.", INITIAL_PROFILE);
  assert(p1.etablissement_actuel === "Lycée de Rufisque", 1, "Établissement extrait", `etablissement=${p1.etablissement_actuel}`);
  assert(p1.classe_actuelle === "Terminale", 1, "Classe extraite", `classe=${p1.classe_actuelle}`);
  assert(p1.serie === "S2", 1, "Série extraite", `serie=${p1.serie}`);
  assert(p1.phase_actuelle === "B", 1, "Phase B engagée", `phase=${p1.phase_actuelle}`);
  const q1 = getNextOrientationQuestion(p1);
  assert(
    q1.intent_id !== "intent_demander_situation_scolaire" &&
    q1.intent_id !== "intent_demander_serie" &&
    q1.intent_id !== "intent_clarifier_s1_s2",
    1,
    "Pas de redemande redondante",
    `prochaine_question=${q1.intent_id}`
  );

  // ─────────────────────────────────────────────────────────────────────────
  // SCÉNARIO 2 : L'étudiant répond librement sans sélectionner aucune carte
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n--- Scénario 2 : Réponse libre sans sélection de cartes ---");
  const p2 = heuristicUpdateProfile(
    "Franchement je préfère les projets sur maquettes et le travail concret plutôt que les longs cours théoriques magistraux.",
    p1
  );
  assert(p2.style_travail?.pratique_vs_theorie === "pratique", 2, "Style de travail pratique détecté", "pratique_vs_theorie=pratique");
  assert(p2.activites.includes("Projets concrets et pratiques"), 2, "Activité concrète enregistrée", "activite ok");

  // ─────────────────────────────────────────────────────────────────────────
  // SCÉNARIO 3 : L'étudiant dit seulement : « J’aime comprendre les choses. »
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n--- Scénario 3 : Intérêt général non concluant ('J'aime comprendre les choses.') ---");
  const p3 = heuristicUpdateProfile("J'aime comprendre les choses.", INITIAL_PROFILE);
  assert(p3.preference_generale?.type === "comprendre", 3, "Préférence 'comprendre' détectée", "type=comprendre");
  assert(p3.preference_generale?.statut === "en_clarification", 3, "Statut en_clarification", "statut ok");
  assert(p3.confirmed_interests.length === 0, 3, "Zéro extrapolation hâtive", "confirmed_interests vide");
  const q3 = getNextOrientationQuestion(p3);
  assert(q3.intent_id === "intent_clarifier_comprendre", 3, "Clarification neutre posée", `question=${q3.intent_id}`);
  assert(q3.question.includes("phénomènes physiques") || q3.question.includes("machines"), 3, "Formulation ouverte neutre", "question ouverte");

  // ─────────────────────────────────────────────────────────────────────────
  // SCÉNARIO 4 : L'étudiant mentionne plusieurs matières sans préciser son projet pro
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n--- Scénario 4 : Matières aimées sans projet pro imposé ---");
  const p4 = heuristicUpdateProfile("J'aime les maths et la physique.", INITIAL_PROFILE);
  assert(p4.matieres_aimees.includes("Mathématiques") && p4.matieres_aimees.includes("Sciences Physiques"), 4, "Matières enregistrées", `matieres=${p4.matieres_aimees.join(", ")}`);
  assert(p4.projet === undefined || p4.projet === null || p4.projet === "", 4, "Pas de métier inventé", "aucun métier arbitraire");

  // ─────────────────────────────────────────────────────────────────────────
  // SCÉNARIO 5 : Préférence + Contrainte + Refus explicite dans la même réponse
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n--- Scénario 5 : Préférence + Contrainte + Refus dans la même réponse ---");
  const p5 = heuristicUpdateProfile(
    "J'aime les maths et la physique, mais je ne veux pas devenir enseignant. J'aimerais travailler sur des projets concrets à Dakar.",
    p1
  );
  assert(p5.professions_rejetees?.some((pr) => pr.metier === "Enseignant") === true, 5, "Refus enseignant enregistré", "professions_rejetees contient Enseignant");
  assert(p5.ville === "Dakar", 5, "Ville Dakar enregistrée", `ville=${p5.ville}`);
  assert(p5.style_travail?.pratique_vs_theorie === "pratique", 5, "Préférence pratique enregistrée", "style=pratique");
  const forms5 = findMatchingFormations(p5, 5);
  const hasEnseignement = forms5.some((f) => f.nom.toLowerCase().includes("fastef") || f.nom.toLowerCase().includes("enseignement"));
  assert(!hasEnseignement, 5, "Exclusion totale des filières d'enseignement", "aucun enseignement proposé");

  // ─────────────────────────────────────────────────────────────────────────
  // SCÉNARIO 6 : L'étudiant répond « je ne sais pas »
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n--- Scénario 6 : Réponse 'je ne sais pas' sans boucle mécanique ---");
  const p6 = heuristicUpdateProfile("Je ne sais pas", INITIAL_PROFILE);
  assert((p6.nb_je_ne_sais_pas || 0) >= 1, 6, "Compteur d'indécision incrémenté", `nb=${p6.nb_je_ne_sais_pas}`);
  const q6 = getNextOrientationQuestion(p6);
  assert(q6.suggestions.length >= 3, 6, "Propose des situations concrètes pour débloquer", "suggestions concrètes fournies");

  // ─────────────────────────────────────────────────────────────────────────
  // SCÉNARIO 7 : L'étudiant corrige une information donnée plus tôt
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n--- Scénario 7 : Correction explicite d'une information antérieure ---");
  let p7: ConversationProfile = { ...INITIAL_PROFILE, serie: "S2", filiere_actuelle: "S2" };
  p7 = heuristicUpdateProfile("En fait je me suis trompé je suis en S1 pas en S2", p7);
  assert(p7.serie === "S1", 7, "Série mise à jour à S1", `serie=${p7.serie}`);
  assert(p7.rejected_or_corrected_hypotheses.includes("S2"), 7, "Ancienne valeur S2 marquée rejetée", "S2 corrigée");

  // ─────────────────────────────────────────────────────────────────────────
  // SCÉNARIO 8 : Changement de domaine après avoir reçu des propositions
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n--- Scénario 8 : Changement de domaine après propositions ---");
  let p8: ConversationProfile = {
    ...INITIAL_PROFILE,
    confirmed_interests: ["Informatique & Technologies"],
    interets_principaux: ["Informatique & Technologies"],
  };
  p8 = heuristicUpdateProfile("Finalement la santé m'intéresse plus que l'informatique", p8);
  assert(p8.confirmed_interests.includes("Médecine & Santé"), 8, "Nouveau domaine Santé adopté", "Santé dans confirmed_interests");
  assert(!p8.confirmed_interests.includes("Informatique & Technologies"), 8, "Ancien domaine Informatique retiré", "Informatique retiré");
  assert(p8.rejected_or_corrected_hypotheses.includes("Informatique & Technologies"), 8, "Informatique marqué rejeté", "Informatique dans rejected");

  // ─────────────────────────────────────────────────────────────────────────
  // SCÉNARIO 9 : Refus des 5 choix avec explication
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n--- Scénario 9 : Refus des 5 choix et explication (Phase F) ---");
  let p9: ConversationProfile = {
    ...p1,
    phase_actuelle: "E",
    confirmed_interests: ["Sciences & Technologies"],
    formations_recommandees: [
      "Licence Informatique",
      "Licence Mathématiques Appliquées",
      "Licence Physique-Chimie",
      "Licence Télécommunications",
      "Licence Électronique",
    ],
  };
  p9 = heuristicUpdateProfile("Ces choix sont trop théoriques, je préfère des formations pratiques courtes", p9);
  assert(p9.phase_actuelle === "F", 9, "Basculement en Phase F", "phase=F");
  assert((p9.formations_rejetees?.length || 0) === 5, 9, "5 formations enregistrées comme rejetées", `rejets=${p9.formations_rejetees?.length}`);
  assert(p9.motifs_insatisfaction?.includes("trop théorique") === true, 9, "Motif d'insatisfaction consigné", "motif ok");
  const newForms9 = findMatchingFormations(p9, 5);
  const overlap = newForms9.filter((f) => p9.formations_rejetees?.some((fr) => fr.formation === f.nom));
  assert(overlap.length === 0, 9, "Zéro répétition des formations rejetées", `overlap=${overlap.length}`);

  // ─────────────────────────────────────────────────────────────────────────
  // SCÉNARIO 10 : Rejet des choix sans donner de raison ("aucune ne me plaît")
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n--- Scénario 10 : Rejet sans motif explicite ('Aucune ne me plaît') ---");
  let p10: ConversationProfile = {
    ...p1,
    phase_actuelle: "E",
    formations_recommandees: ["Licence Informatique", "DUT Génie Logiciel"],
  };
  p10 = heuristicUpdateProfile("Aucune ne me plaît", p10);
  assert(p10.phase_actuelle === "F", 10, "Basculement en Phase F", "phase=F");
  const q10 = getNextOrientationQuestion(p10);
  assert(q10.intent_id === "intent_phase_f_insatisfaction", 10, "Question d'exploration bienveillante posée", `question=${q10.intent_id}`);
  assert(!q10.question.includes("au revoir"), 10, "La discussion n'est pas close", "dialogue maintenu");

  // ─────────────────────────────────────────────────────────────────────────
  // SCÉNARIO 11 : Une formation recherchée est absente de la base (zéro hallucination)
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n--- Scénario 11 : Formation absente de la base de données ---");
  const absentMatches = await searchKnowledge("formation astronaute spationaute astrophysique spatiale martienne", 5, 0.28);
  assert(absentMatches.length === 0, 11, "Zéro résultat erroné renvoyé pour formation inconnue", `matches=${absentMatches.length}`);

  // ─────────────────────────────────────────────────────────────────────────
  // SCÉNARIO 12 : Reprise d'une ancienne conversation (continuité)
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n--- Scénario 12 : Reprise d'une ancienne conversation ---");
  const savedProfile: ConversationProfile = {
    ...INITIAL_PROFILE,
    conversation_id: "conv-12345",
    prenom: "Ousmane",
    etablissement_actuel: "Lycée Lamine Guèye",
    classe_actuelle: "Terminale",
    serie: "S2",
    matieres_aimees: ["Mathématiques", "SVT / Biologie"],
    confirmed_interests: ["Médecine & Santé"],
    phase_actuelle: "C",
  };
  const p12 = heuristicUpdateProfile("Bonjour je reviens vers toi pour continuer notre échange", savedProfile);
  assert(p12.serie === "S2", 12, "Profil préservé", `serie=${p12.serie}`);
  assert(p12.etablissement_actuel === "Lycée Lamine Guèye", 12, "Établissement préservé", `etablissement=${p12.etablissement_actuel}`);
  const q12 = getNextOrientationQuestion(p12);
  assert(
    q12.intent_id !== "intent_demander_prenom" &&
    q12.intent_id !== "intent_demander_situation_scolaire",
    12,
    "Reprise sans redémarrer le questionnaire à zéro",
    `prochaine_question=${q12.intent_id}`
  );

  // ─────────────────────────────────────────────────────────────────────────
  // SCÉNARIO 13 : Demande d'information précise avant d'avoir terminé le pipeline
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n--- Scénario 13 : Question factuelle directe en cours de route ---");
  const matchesEPT = await searchKnowledge("conditions du concours EPT", 5, 0.28);
  assert(matchesEPT.length > 0, 13, "Documents officiels du concours EPT trouvés", `docs=${matchesEPT.length}`);
  assert(matchesEPT[0].content.toLowerCase().includes("ept") || matchesEPT[0].content.toLowerCase().includes("polytechnique"), 13, "Contenu factuel EPT vérifié", "source officielle confirmée");

  // ─────────────────────────────────────────────────────────────────────────
  // SCÉNARIO 14 : Réponse qui ne correspond à aucune carte
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n--- Scénario 14 : Réponse libre hors-cartes standard ---");
  const p14 = heuristicUpdateProfile(
    "Je suis passionné par l'agro-écologie et l'irrigation goutte-à-goutte en milieu sahélien",
    p1
  );
  assert(p14.confirmed_interests.includes("Agriculture & Environnement"), 14, "Domaine Agriculture & Environnement extrait de la réponse libre", "domaine extrait avec succès");

  // ─────────────────────────────────────────────────────────────────────────
  // SCÉNARIO 15 : Information contradictoire avec une réponse antérieure
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n--- Scénario 15 : Résolution de contradiction antérieure ---");
  let p15: ConversationProfile = {
    ...INITIAL_PROFILE,
    matieres_aimees: ["Gestion", "Mathématiques"],
    confirmed_interests: ["Commerce & Gestion"],
  };
  p15 = heuristicUpdateProfile("En fait je déteste la comptabilité et les chiffres, je ne veux plus faire de gestion", p15);
  assert(!p15.matieres_aimees.includes("Gestion"), 15, "Matière rejetée retirée de matieres_aimees", "Gestion retirée");
  assert(!p15.confirmed_interests.includes("Commerce & Gestion"), 15, "Domaine rejeté retiré de confirmed_interests", "Commerce & Gestion retiré");
  assert(p15.rejected_or_corrected_hypotheses.includes("Commerce & Gestion"), 15, "Domaine consigné dans les hypothèses rejetées", "Consigné dans rejected");

  console.log("\n========================================================================");
  console.log(`RÉSUMÉ DES TESTS : ${passedCount} RÉUSSIS, ${failedCount} ÉCHECS SUR 15 SCÉNARIOS`);
  console.log("========================================================================");

  if (failedCount > 0) {
    process.exit(1);
  }
}

run15Scenarios().catch((err) => {
  console.error("Erreur inattendue :", err);
  process.exit(1);
});
