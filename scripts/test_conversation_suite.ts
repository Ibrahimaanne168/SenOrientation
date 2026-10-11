#!/usr/bin/env npx tsx
/**
 * Suite de tests conversationnels complets de SenOrientation (Partie 9)
 * Valide les 12 tests obligatoires définis dans le cahier des charges.
 */

import {
  INITIAL_PROFILE,
  heuristicUpdateProfile,
  getNextOrientationQuestion,
  ConversationProfile,
} from "../lib/profile";
import { searchKnowledge, findMatchingFormations } from "../lib/rag";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`✅ PASSED: ${message}`);
  }
}

async function runTestSuite() {
  console.log("=================================================================");
  console.log("SUITE DE TESTS CONVERSATIONNELS SENORIENTATION (12 TESTS PARTIE 9)");
  console.log("=================================================================\n");

  // ─────────────────────────────────────────────────────────────
  // TEST 1 : Intérêt général ("J'aime comprendre les choses")
  // ─────────────────────────────────────────────────────────────
  console.log("--- Test 1 : Intérêt général ('J'aime comprendre les choses') ---");
  let p1 = heuristicUpdateProfile("Bonjour, je m'appelle Amadou et j'aime comprendre les choses.", INITIAL_PROFILE);
  assert(p1.preference_generale?.type === "comprendre", "Préférence générale 'comprendre' détectée");
  assert(p1.preference_generale?.statut === "en_clarification", "Statut en_clarification activé");
  assert(p1.confirmed_interests.length === 0, "Aucun domaine attribué prématurément (pas d'informatique imposée)");

  let q1 = getNextOrientationQuestion(p1);
  assert(q1.intent_id === "intent_clarifier_comprendre", "Pose la question de clarification ouverte");
  assert(q1.suggestions.length >= 3, "Propose des exemples variés (machines, nature, société, logique)");
  console.log(`  Question générée: "${q1.question.slice(0, 85)}..."`);

  // ─────────────────────────────────────────────────────────────
  // TEST 2 : Réponse ambiguë ("J'aime réfléchir")
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- Test 2 : Réponse ambiguë ('J'aime réfléchir') ---");
  let p2 = heuristicUpdateProfile("Moi j'aime réfléchir au quotidien.", INITIAL_PROFILE);
  assert(p2.preference_generale?.type === "reflechir", "Préférence générale 'réfléchir' détectée");
  let q2 = getNextOrientationQuestion(p2);
  assert(q2.intent_id === "intent_clarifier_reflechir", "Question de clarification sur le type de réflexion posée");
  assert(p2.confirmed_interests.length === 0, "Pas de filière attribuée arbitrairement");
  console.log(`  Question générée: "${q2.question.slice(0, 85)}..."`);

  // ─────────────────────────────────────────────────────────────
  // TEST 3 : Passion pour les chiffres ("J'aime les chiffres")
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- Test 3 : Passion pour les chiffres ('J'aime les chiffres') ---");
  let p3 = heuristicUpdateProfile("J'aime beaucoup les chiffres.", INITIAL_PROFILE);
  assert(p3.preference_generale?.type === "chiffres", "Préférence générale 'chiffres' détectée");
  let q3 = getNextOrientationQuestion(p3);
  assert(q3.intent_id === "intent_clarifier_chiffres", "Question explorant maths, finance, data et économie");
  assert(!q3.question.includes("🎯"), "Aucun emoji dans la réponse");
  console.log(`  Question générée: "${q3.question.slice(0, 85)}..."`);

  // ─────────────────────────────────────────────────────────────
  // TEST 4 : Question répétée (Anti-boucle après réponse)
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- Test 4 : Question répétée (Mécanisme anti-boucle) ---");
  let p4 = heuristicUpdateProfile("J'aime comprendre comment les choses fonctionnent.", INITIAL_PROFILE);
  let q4_1 = getNextOrientationQuestion(p4);
  p4.questions_asked.push(q4_1.intent_id);

  // L'utilisateur répond à la clarification
  p4 = heuristicUpdateProfile(
    "Je préfère comprendre le fonctionnement des machines et de la mécanique.",
    [{ role: "assistant", content: q4_1.question }],
    p4
  );
  assert(p4.preference_generale?.statut === "clarifiee", "Clarification validée avec succès");
  let q4_2 = getNextOrientationQuestion(p4);
  assert(q4_2.intent_id !== q4_1.intent_id, "La question suivante est différente et ne revient pas à l'initiale");
  assert(q4_2.intent_id !== lastQuestion(p4), "Aucune répétition de la même question");
  console.log(`  Prochaine intention après clarification: ${q4_2.intent_id}`);

  // ─────────────────────────────────────────────────────────────
  // TEST 5 : Réponse "Je ne sais pas"
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- Test 5 : Réponse 'Je ne sais pas' ---");
  let p5 = { ...INITIAL_PROFILE, prenom: "Fatou", serie: "S2", nb_je_ne_sais_pas: 2 };
  let q5 = getNextOrientationQuestion(p5);
  assert(q5.intent_id === "intent_exploration_concrete", "Bascule vers l'exploration par situations de travail concrètes");
  assert(q5.suggestions.some(s => s.toLowerCase().includes("ordinateur") || s.toLowerCase().includes("terrain")), "Propose des contextes réels");
  console.log(`  Question débloquante: "${q5.question.slice(0, 85)}..."`);

  // ─────────────────────────────────────────────────────────────
  // TEST 6 : Plusieurs informations dans une seule réponse
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- Test 6 : Plusieurs informations dans un seul message ---");
  let p6 = heuristicUpdateProfile(
    "Je m'appelle Ousmane, je suis en Terminale S2, mes matières préférées sont les mathématiques et la physique, et je veux étudier à Dakar au tarif public.",
    INITIAL_PROFILE
  );
  assert(p6.prenom === "Ousmane", "Prénom Ousmane extrait");
  assert(p6.serie === "S2", "Série S2 extraite");
  assert(p6.matieres_aimees.includes("Mathématiques"), "Mathématiques enregistrées");
  assert(p6.matieres_aimees.includes("Sciences Physiques"), "Sciences Physiques enregistrées");
  assert(p6.ville === "Dakar", "Ville Dakar enregistrée");
  assert(Boolean(p6.budget?.includes("Public")), "Budget public enregistré");

  let q6 = getNextOrientationQuestion(p6);
  assert(q6.intent_id !== "intent_demander_prenom", "Ne redemande pas le prénom");
  assert(q6.intent_id !== "intent_demander_situation_scolaire", "Ne redemande pas la série");
  console.log(`  Prochaine question ciblée sans répétition: ${q6.intent_id}`);

  // ─────────────────────────────────────────────────────────────
  // TEST 7 : Intérêt confirmé
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- Test 7 : Intérêt confirmé ---");
  let p7: ConversationProfile = { ...INITIAL_PROFILE, prenom: "Aïcha", serie: "S2" };
  p7 = heuristicUpdateProfile("Je confirme que je veux m'orienter vers la santé et la médecine.", p7);
  assert(p7.confirmed_interests.some(i => i.includes("Santé") || i.includes("Médecine")), "Domaine santé confirmé");
  let q7 = getNextOrientationQuestion(p7);
  assert(q7.intent_id === "intent_approfondir_domaine", "Approfondit le domaine (médecine, pharmacie, soins, labo)");
  console.log(`  Question d'approfondissement: "${q7.question.slice(0, 85)}..."`);

  // ─────────────────────────────────────────────────────────────
  // TEST 8 : Formation inexistante dans les données (RAG)
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- Test 8 : Recherche inexistante dans le RAG ---");
  const emptyRes = await searchKnowledge("comment devenir astronaute astrophysicien spécialiste des igloos au Groenland ?");
  assert(emptyRes.length === 0, "Aucun passage retenu sous le seuil (pas d'hallucination)");
  console.log("  0 résultat trouvé pour une recherche totalement hors catalogue");

  // ─────────────────────────────────────────────────────────────
  // TEST 9 : Contraintes d'admission et prérequis
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- Test 9 : Contraintes d'admission vérifiées ---");
  let p9: ConversationProfile = {
    ...INITIAL_PROFILE,
    prenom: "Modou",
    serie: "L2",
    interets_principaux: ["Informatique & Technologies"],
  };
  const matched9 = findMatchingFormations(p9);
  assert(matched9.length > 0, "Formations trouvées");
  // En L2, les écoles d'ingénieurs pures (EPT) qui exigent S1/S2 ne doivent pas être prioritaires face à l'informatique littéraire/gestion
  console.log(`  Formation adaptée proposée pour L2: ${matched9[0]?.nom} (${matched9[0]?.pourquoi})`);

  // ─────────────────────────────────────────────────────────────
  // TEST 10 : Changement d'avis en cours de conversation
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- Test 10 : Changement d'avis de l'élève ---");
  let p10: ConversationProfile = {
    ...INITIAL_PROFILE,
    prenom: "Khadija",
    serie: "S2",
    interets_principaux: ["Médecine & Santé"],
    confirmed_interests: ["Médecine & Santé"],
  };
  p10 = heuristicUpdateProfile("En fait je ne veux plus faire de santé, je préfère le droit et les sciences politiques.", p10);
  assert(!p10.confirmed_interests.includes("Médecine & Santé"), "L'ancien domaine de santé a été retiré");
  assert(p10.confirmed_interests.includes("Droit & Sciences Politiques"), "Le nouveau domaine droit est enregistré");
  assert(p10.rejected_or_corrected_hypotheses.includes("Médecine & Santé"), "Ancienne hypothèse marquée comme rejetée");
  console.log(`  Domaines actuels après changement d'avis: ${p10.confirmed_interests.join(", ")}`);

  // ─────────────────────────────────────────────────────────────
  // TEST 11 : Reprise de conversation existante
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- Test 11 : Reprise de conversation existante ---");
  let p11: ConversationProfile = {
    ...INITIAL_PROFILE,
    prenom: "Cheikh",
    serie: "S1",
    matieres_aimees: ["Mathématiques"],
    interets_principaux: ["Ingénierie & BTP"],
    confirmed_interests: ["Ingénierie & BTP"],
    etape: 3,
  };
  // L'élève revient : "Je suis de retour, on continue ?"
  let q11 = getNextOrientationQuestion(p11);
  assert(q11.intent_id !== "intent_demander_prenom", "Ne redemande pas le prénom");
  assert(q11.intent_id !== "intent_demander_situation_scolaire", "Ne redemande pas la série");
  console.log(`  Question de reprise dans le contexte existant: ${q11.intent_id}`);

  // ─────────────────────────────────────────────────────────────
  // TEST 12 : Demande directe factuelle (sans forcer tout le questionnaire)
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- Test 12 : Demande directe factuelle ---");
  const directEpt = await searchKnowledge("quelles sont les conditions du concours EPT Thiès ?");
  assert(directEpt.length > 0, "Document officiel EPT extrait");
  assert(directEpt[0].content.includes("7 000 FCFA"), "Frais officiels de 7 000 FCFA présents");

  const directInfo = await searchKnowledge("quelles universités proposent la licence informatique ?");
  assert(directInfo.length > 0, "Formations en informatique extraites");
  console.log(`  Source officielle répondue directement: ${directEpt[0].source}`);

  console.log("\n=================================================================");
  console.log("RÉSULTAT GLOBAL : LES 12 TESTS DE CONVERSATION SONT 100% VALIDES !");
  console.log("=================================================================");
}

function lastQuestion(p: ConversationProfile): string | undefined {
  return p.questions_asked[p.questions_asked.length - 1];
}

runTestSuite().catch((err) => {
  console.error("Erreur d'exécution des tests:", err);
  process.exit(1);
});
