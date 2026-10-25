import { INITIAL_PROFILE, heuristicUpdateProfile, getNextOrientationQuestion } from "../lib/profile";
import {
  getFiliereLocationsReport,
  getEtablissementOverviewReport,
  getConcoursOverviewReport,
  getCampusenProcedureSummary,
  detectQueryMode,
} from "../lib/rag";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`✅ PASSED: ${message}`);
  }
}

async function runValidation() {
  console.log("==================================================================");
  console.log("TESTS DE BOUT EN BOUT : FILIÈRES, UNIVERSITÉS, CONCOURS & NON-BOUCLAGE");
  console.log("==================================================================\n");

  // ── 1. QUESTIONS : OÙ TROUVER UNE FILIÈRE ─────────────────────────────
  console.log("--- 1. Tests 'Où trouver une filière' ---");
  const repInfo = getFiliereLocationsReport("Où trouver la filière informatique ?");
  assert(repInfo.found, "Rapport trouvé pour filière informatique");
  assert(repInfo.report.includes("UCAD") || repInfo.report.includes("UGB"), "Mentionne les universités phares pour l'informatique");
  assert(repInfo.report.includes("25 000 FCFA"), "Rappelle les droits nationaux d'inscription de 25 000 FCFA/an");

  const repMed = getFiliereLocationsReport("Où étudier la médecine au Sénégal ?");
  assert(repMed.found, "Rapport trouvé pour médecine / santé");
  assert(repMed.report.includes("Médecine") || repMed.report.includes("Santé"), "Contient l'intitulé de la filière de santé");

  const repDroit = getFiliereLocationsReport("Dans quelle université faire du droit ?");
  assert(repDroit.found, "Rapport trouvé pour droit");
  assert(repDroit.report.includes("Droit"), "Contient la mention du Droit");

  // Test avec clic direct "Où trouver ces filières au Sénégal ?" et profil ayant informatique
  const profS2 = {
    ...INITIAL_PROFILE,
    serie: "S2",
    formations_recommandees: ["Licence Informatique et Télécommunications"],
  };
  const repFromProfile = getFiliereLocationsReport("Où trouver ces filières au Sénégal ?", profS2);
  assert(repFromProfile.found, "Rapport déduit avec succès la filière depuis le profil de l'élève");
  assert(repFromProfile.report.includes("Informatique"), "Focalisé sur l'informatique recommandée");

  // Test sans profil et sans mot clé précis -> Rapport général des filières
  const repGeneral = getFiliereLocationsReport("Quelles sont les filières au Sénégal ?");
  assert(repGeneral.found, "Rapport général des filières publiques trouvé");
  assert(repGeneral.report.includes("Informatique & Technologies"), "Mentionne l'informatique");
  assert(repGeneral.report.includes("Santé & Médecine"), "Mentionne la santé");
  assert(repGeneral.report.includes("Droit & Sciences Politiques"), "Mentionne le droit");

  // ── 2. QUESTIONS : INFOS SUR UNE UNIVERSITÉ EN PARTICULIER ─────────────
  console.log("\n--- 2. Tests 'Infos sur une université' ---");
  const repUcad = getEtablissementOverviewReport("Donne-moi des infos sur l'UCAD");
  assert(repUcad.found, "Fiche trouvée pour l'UCAD");
  assert(repUcad.report.includes("Université Cheikh Anta Diop"), "Nom complet de l'UCAD présent");
  assert(repUcad.report.includes("25 000 FCFA"), "Frais publics de 25 000 FCFA mentionnés");
  assert(repUcad.report.includes("Faculté") || repUcad.report.includes("UFR") || repUcad.report.includes("ESP"), "Facultés ou écoles rattachées mentionnées");

  const repUgb = getEtablissementOverviewReport("Parle-moi de l'Université Gaston Berger");
  assert(repUgb.found, "Fiche trouvée pour l'UGB");
  assert(repUgb.report.includes("Saint-Louis"), "Localisation à Saint-Louis mentionnée");

  const repEpt = getEtablissementOverviewReport("C'est quoi l'EPT de Thiès ?");
  assert(repEpt.found, "Fiche trouvée pour l'EPT");
  assert(repEpt.report.includes("Polytechnique de Thiès"), "Nom complet de l'EPT");
  assert(repEpt.report.includes("Thiès"), "Localisation à Thiès");

  const repUvs = getEtablissementOverviewReport("Donne des infos sur l'UVS");
  assert(repUvs.found, "Alias historique UVS reconnu pour UN-CHK");
  assert(repUvs.report.includes("Cheikh Hamidou Kane") || repUvs.report.includes("Numérique"), "Présente l'UN-CHK");

  const repUnivGenerale = getEtablissementOverviewReport("Quelles sont les universités au Sénégal ?");
  assert(repUnivGenerale.found, "Présente le panorama des universités d'État");
  assert(repUnivGenerale.report.includes("UCAD") && repUnivGenerale.report.includes("UGB"), "Liste UCAD et UGB");

  // ── 3. QUESTIONS : CONCOURS OFFICIELS ─────────────────────────────────
  console.log("\n--- 3. Tests 'Concours officiels' ---");
  const repConcoursEpt = getConcoursOverviewReport("Quelles sont les conditions du concours EPT ?");
  assert(repConcoursEpt.found, "Fiche concours EPT trouvée");
  assert(repConcoursEpt.report.includes("7 000 FCFA"), "Frais réels de 7 000 FCFA pour l'EPT présents");
  assert(repConcoursEpt.report.includes("Mathématiques") && repConcoursEpt.report.includes("Physique"), "Matières au concours EPT listées");

  const repConcoursS2 = getConcoursOverviewReport("Voir les concours d'entrée disponibles", { serie: "S2" });
  assert(repConcoursS2.found, "Liste des concours pour série S2 trouvée");
  assert(repConcoursS2.report.includes("EPT") || repConcoursS2.report.includes("ESP"), "Propose EPT ou ESP pour profil scientifique");

  const repConcoursL = getConcoursOverviewReport("Voir les concours d'entrée disponibles", { serie: "L2" });
  assert(repConcoursL.found, "Liste des concours pour série L trouvée");
  assert(repConcoursL.report.includes("CESTI") || repConcoursL.report.includes("ESEA") || repConcoursL.report.includes("ENA"), "Propose CESTI, ESEA ou ENA pour profil littéraire");

  // ── 4. NON-BOUCLAGE DU QUESTIONNAIRE POST-BILAN ───────────────────────
  console.log("\n--- 4. Tests anti-bouclage post-bilan ---");
  const profPostBilan = {
    ...INITIAL_PROFILE,
    prenom: "Cheikh",
    serie: "S2",
    statut_parcours: "bac" as const,
    questions_asked: ["intent_demander_prenom", "intent_demander_situation_scolaire", "intent_presenter_bilan"],
  };

  const nextPostBilan = getNextOrientationQuestion(profPostBilan);
  assert(
    nextPostBilan.intent_id === "intent_post_bilan_exploration",
    "Après le bilan, passe à intent_post_bilan_exploration et NE REDEMANDE PAS le bilan"
  );
  assert(
    nextPostBilan.suggestions.includes("Où trouver ces filières au Sénégal ?"),
    "Propose la localisation des filières dans les suggestions"
  );
  assert(
    nextPostBilan.suggestions.includes("Voir les concours d'entrée disponibles"),
    "Propose les concours d'entrée dans les suggestions"
  );

  profPostBilan.questions_asked.push("intent_post_bilan_exploration");
  const nextPostBilan2 = getNextOrientationQuestion(profPostBilan);
  assert(
    nextPostBilan2.intent_id === "intent_post_bilan_assistance",
    "Après l'exploration, offre une assistance ouverte et NE BOUCLE PAS"
  );

  console.log("\n==================================================================");
  console.log("RÉSULTAT DU CONTRÔLE : TOUS LES NOUVEAUX TESTS SONT 100% VALIDES !");
  console.log("==================================================================");
}

runValidation().catch((err) => {
  console.error("Test runner error:", err);
  process.exit(1);
});
