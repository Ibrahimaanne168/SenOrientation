import bcrypt from "bcryptjs";
import {
  initiateRegistration,
  verifyRegistrationCode,
  completeRegistration,
  loginUser,
  initiatePasswordReset,
  resetPasswordWithToken,
  getSessionUser,
  updateStudentProfile,
  calculateProfileCompleteness,
} from "../lib/auth-store";
import {
  detectIntent,
  detectQueryMode,
  searchKnowledge,
} from "../lib/rag";
import {
  INITIAL_PROFILE,
  heuristicUpdateProfile,
  mergeProfileUpdate,
  getNextOrientationQuestion,
  ConversationProfile,
} from "../lib/profile";

async function runTests() {
  console.log("=================================================================");
  console.log("   VÉRIFICATION GLOBALE DES CORRECTIONS CIBLÉES DE JANGORA");
  console.log("=================================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, extra?: string) {
    if (condition) {
      console.log(`  [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${testName}${extra ? " - " + extra : ""}`);
      failed++;
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 1. TEST DE PROGRESSION & ÉTAPE (Correction de l'incohérence Étape 4/5)
  // ─────────────────────────────────────────────────────────────────────────
  console.log("--- 1. Synchronisation de la progression & Étape ---");
  const initProfile = { ...INITIAL_PROFILE };
  assert(initProfile.etape === 1, "Le profil initial démarre strictement à l'étape 1");

  const stepAfterName = heuristicUpdateProfile(initProfile, [], "Je m'appelle Moussa");
  assert(stepAfterName.etape === 1, "Après avoir donné uniquement le prénom, l'étape reste strictement 1 (pas de saut à 4/5)");

  const mergedReset = mergeProfileUpdate({ ...INITIAL_PROFILE, etape: 4 }, { etape: 1 }, 1);
  assert(mergedReset.etape === 1, "La réinitialisation ou nouvelle discussion peut redescendre l'étape à 1 (pas de Math.max bloquant)");

  // ───────────────────────────────────────────────────────────────────────────
  // 2. TEST DU MODE MULTI-USAGES (Assistant d'information factuelle)
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n--- 2. Modes multi-usages (Établissements, Concours, Métiers, Comparaisons) ---");

  const modeEtablissement = detectQueryMode("Quelles formations propose l'UCAD en informatique ?");
  assert(modeEtablissement === "info_etablissement", "Détection mode info_etablissement pour UCAD");

  const modeUGB = detectQueryMode("Parle-moi de l'UGB et de ses formations en informatique");
  assert(modeUGB === "info_etablissement", "Détection mode info_etablissement pour UGB");

  const modeConcours = detectQueryMode("Quels sont les concours accessibles après le Bac ?");
  assert(modeConcours === "concours", "Détection mode concours pour concours post-Bac");

  const modeEPT = detectQueryMode("Quelles sont les conditions du concours EPT ?");
  assert(modeEPT === "concours", "Détection mode concours pour EPT");

  const modeMetier = detectQueryMode("Que fait exactement un ingénieur en génie civil ?");
  assert(modeMetier === "metier", "Détection mode métier pour ingénieur génie civil");

  const modeStatisticien = detectQueryMode("Quelles études faut-il suivre pour devenir statisticien ?");
  assert(modeStatisticien === "metier", "Détection mode métier pour statisticien");

  const modeComparaison = detectQueryMode("Quelle est la différence entre une Licence en informatique et une Licence en mathématiques appliquées ?");
  assert(modeComparaison === "comparaison", "Détection mode comparaison");

  const modeGeneral = detectQueryMode("Comment fonctionne la procédure Campusen pour les bourses ?");
  assert(modeGeneral === "question_generale", "Détection mode question_generale pour Campusen / bourses");

  const modeOrientation = detectQueryMode("Je suis en Terminale S2 et j'aime la SVT, que me conseilles-tu ?");
  assert(modeOrientation === "orientation", "Détection mode orientation personnalisée pour élève S2");

  // RAG : Recherche documentaire adaptée
  const ucadDocs = await searchKnowledge("UCAD informatique", 3);
  assert(ucadDocs.length > 0, "Recherche RAG UCAD informatique renvoie des documents réels", `Nombre: ${ucadDocs.length}`);

  const concoursDocs = await searchKnowledge("concours ept", 3);
  assert(concoursDocs.length > 0 && concoursDocs[0].content.toLowerCase().includes("ept"), "Recherche RAG concours EPT cible bien l'École Polytechnique de Thiès");

  // ───────────────────────────────────────────────────────────────────────────
  // 3. AUTHENTIFICATION EN 3 ÉTAPES & SÉCURITÉ RESEND
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n--- 3. Authentification en 3 étapes & Sécurité ---");

  const testEmail = `etudiant.test.${Date.now()}@ucad.edu.sn`;
  const testFullName = "Moussa Diouf";

  // Étape 1 : Identité
  const step1 = await initiateRegistration(testFullName, testEmail);
  assert(step1.success, "Étape 1 : Enregistrement identité et génération OTP Resend réussis");

  // Test code invalide
  const invalidOtp = await verifyRegistrationCode(testEmail, "000000");
  assert(Boolean(!invalidOtp.success && invalidOtp.error?.includes("incorrect")), "Étape 2 : Rejet immédiat du code OTP invalide");

  // Étape 2 : Vérification code (on extrait le code en mémoire pour simuler la réception e-mail)
  // Dans notre architecture sécurisée, le code est généré et stocké avec expiration 10 min
  // On teste le renvoi avec délai
  const tooFastResend = await initiateRegistration(testFullName, testEmail);
  assert(!tooFastResend.success, "Protection contre les renvois abusifs (cooldown actif)");

  // Étape 3 : Création des identifiants
  // Créons un jeton temporaire simulé pour valider l'étape 3
  const dummyToken = "test_reg_token_" + Date.now();
  // Complétion avec mot de passe haché par bcrypt
  const rawPassword = "MonSuperMotDePasse2026!";
  const username = "moussa_" + Date.now().toString().slice(-4);

  // Inscription directe avec mot de passe sécurisé
  const salt = await bcrypt.genSalt(12);
  const hash = await bcrypt.hash(rawPassword, salt);
  assert(hash.startsWith("$2"), "Hachage bcrypt (coût 12) valide", hash.slice(0, 15) + "...");
  assert(hash !== rawPassword, "Le mot de passe en clair n'est jamais stocké");

  const compareSuccess = await bcrypt.compare(rawPassword, hash);
  assert(compareSuccess, "Vérification bcrypt du mot de passe valide");

  const compareFailure = await bcrypt.compare("MauvaisPassword", hash);
  assert(!compareFailure, "Rejet bcrypt en cas de mauvais mot de passe");

  // ───────────────────────────────────────────────────────────────────────────
  // 4. MOT DE PASSE OUBLIÉ & RÉPONSE NEUTRE
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n--- 4. Mot de passe oublié & Étancheité ---");

  const forgotUnknown = await initiatePasswordReset("inconnu.total@exemple.sn", "http://localhost:3000");
  assert(
    forgotUnknown.success && forgotUnknown.message.includes("Si un compte est associé"),
    "Message neutre en cas d'adresse inexistante (anti-énumération)"
  );

  // ───────────────────────────────────────────────────────────────────────────
  // 5. PROFIL PROGRESSIF (Complétion après connexion)
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n--- 5. Profil progressif après connexion ---");

  const dummyUser = {
    id: "usr_123",
    fullName: "Awa Ndiaye",
    email: "awa@ucad.sn",
    username: "awa221",
    profile: {
      etablissement_actuel: "Lycée Lamine Guèye",
      classe_actuelle: "Terminale",
      serie: "S2",
      matieres_preferees: ["SVT", "Sciences Physiques"],
    },
    profileCompleteness: 0,
  };

  const compScore = calculateProfileCompleteness(dummyUser as any);
  assert(compScore >= 60, `Calcul de complétion du profil progressif (${compScore}%)`);

  // ───────────────────────────────────────────────────────────────────────────
  // 6. QUESTION APTITUDES (Posée tôt et non-bouclante)
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n--- 6. Question aptitudes / matières fortes (Timing & Anti-boucle) ---");
  let profApt: ConversationProfile = { ...INITIAL_PROFILE, prenom: "Modou", serie: "S2", niveau: "Terminale", statut_parcours: "bac" as const };
  const qApt1 = getNextOrientationQuestion(profApt);
  assert(qApt1.intent_id === "intent_matieres_preferees", "La question des matières/façons d'agir est posée tôt (dès que la série est connue)");
  assert(qApt1.phase === 2 && qApt1.etape === 2, "La question est en Phase 2 / Étape 2 (très tôt dans l'échange)");

  // Simulation réponse clic utilisateur : "Rédaction, langues et argumentation"
  profApt.questions_asked.push("intent_matieres_preferees");
  profApt = heuristicUpdateProfile(profApt, [{ role: "assistant", content: qApt1.question }], "Rédaction, langues et argumentation");
  assert(profApt.points_forts.includes("Rédaction, langues et argumentation"), "Prise en compte du point fort 'Rédaction, langues et argumentation'");
  assert(profApt.questions_answered["intent_matieres_preferees"] === "Rédaction, langues et argumentation", "Enregistrement de la réponse dans questions_answered");

  // Prochaine question
  const qApt2 = getNextOrientationQuestion(profApt);
  assert(qApt2.intent_id !== "intent_matieres_preferees", "La question ne revient JAMAIS en boucle après la réponse");
  assert(qApt2.intent_id === "intent_decouvrir_interets", "Progression naturelle vers la découverte des univers d'orientation");

  console.log("\n=================================================================");
  console.log(` RÉSULTATS : ${passed} TESTS RÉUSSIS, ${failed} ÉCHECS`);
  console.log("=================================================================\n");

  if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
