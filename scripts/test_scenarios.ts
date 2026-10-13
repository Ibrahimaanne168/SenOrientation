import { INITIAL_PROFILE, heuristicUpdateProfile, getNextOrientationQuestion } from "../lib/profile";
import { searchKnowledge, findMatchingFormations } from "../lib/rag";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`✅ PASSED: ${message}`);
  }
}

async function runTests() {
  console.log("=================================================");
  console.log("TESTS FONCTIONNELS DE SENORIENTATION (10 SCÉNARIOS)");
  console.log("=================================================\n");

  // --- SCÉNARIO 1 : Terminale S2, maths & informatique ---
  console.log("--- Scénario 1 : Terminale S2, passionné de maths & informatique ---");
  const prof1 = heuristicUpdateProfile(
    "Bonjour, je m'appelle Moussa, je suis en Terminale S2 et j'adore les mathématiques et la programmation informatique",
    INITIAL_PROFILE
  );
  assert(prof1.prenom === "Moussa", "Prénom Moussa bien extrait");
  assert(prof1.serie === "S2", "Série S2 bien extraite");
  assert(prof1.niveau === "Terminale", "Niveau Terminale bien extrait");
  assert(prof1.interets_principaux.some((i) => i.toLowerCase().includes("informatique")), "Intérêt informatique détecté");
  assert(prof1.matieres_aimees.some((m) => m.toLowerCase().includes("math")), "Mathématiques détectées comme matière aimée");

  const matches1 = findMatchingFormations(prof1);
  assert(matches1.length > 0, "Formations trouvées pour Moussa en S2");
  assert(matches1.some((m) => m.nom.toLowerCase().includes("informatique")), "Formation informatique trouvée dans les résultats réels");
  console.log(`  Top formation: ${matches1[0]?.nom} (${matches1[0]?.etablissement}) [${matches1[0]?.score_correspondance}%]`);

  // --- SCÉNARIO 2 : Biologie et santé ---
  console.log("\n--- Scénario 2 : Biologie et santé ---");
  const prof2 = heuristicUpdateProfile(
    "Je m'appelle Fatou, je suis en Terminale S2, j'aime la biologie et les sciences médicales",
    INITIAL_PROFILE
  );
  assert(
    prof2.interets_principaux.some((i) => i.toLowerCase().includes("santé") || i.toLowerCase().includes("médecine")),
    "Intérêt santé/biologie détecté"
  );
  const matches2 = findMatchingFormations(prof2);
  assert(matches2.length > 0, "Formations santé trouvées");
  assert(
    matches2.some((m) => m.domaine.toLowerCase().includes("santé") || m.nom.toLowerCase().includes("méd") || m.nom.toLowerCase().includes("biolog")),
    "Formations de santé bien indexées"
  );
  console.log(`  Top formation santé: ${matches2[0]?.nom} (${matches2[0]?.etablissement})`);

  // --- SCÉNARIO 3 : Commerce, gestion, Terminale G ---
  console.log("\n--- Scénario 3 : Commerce & gestion, Bac G ---");
  const prof3 = heuristicUpdateProfile(
    "Je suis en Terminale G, je m'appelle Amadou et je veux faire du commerce, de la comptabilité et de la gestion",
    INITIAL_PROFILE
  );
  assert(prof3.serie === "G", "Série G bien extraite");
  assert(
    prof3.interets_principaux.some((i) => i.toLowerCase().includes("commerce") || i.toLowerCase().includes("gestion")),
    "Intérêt commerce/gestion détecté"
  );
  const matches3 = findMatchingFormations(prof3);
  assert(matches3.length > 0, "Formations gestion/commerce trouvées");
  console.log(`  Top formation commerce: ${matches3[0]?.nom} (${matches3[0]?.etablissement})`);

  // --- SCÉNARIO 4 : Élève indécis ("Je ne sais pas") ---
  console.log("\n--- Scénario 4 : Élève indécis ('Je ne sais pas') ---");
  const prof4 = heuristicUpdateProfile(
    "Je m'appelle Ibrahima, mais franchement je ne sais pas du tout ce que je veux faire, je suis perdu",
    INITIAL_PROFILE
  );
  const nextQ4 = getNextOrientationQuestion(prof4);
  assert(nextQ4.type === "question", "Pose une question adaptative au lieu de forcer une filière");
  assert(nextQ4.suggestions.length >= 2, "Propose des choix concrets pour aider l'élève indécis");
  assert(!nextQ4.question.includes("🎯") && !nextQ4.question.includes("✨"), "Aucun emoji dans la question adaptative");
  console.log(`  Question pour l'élève indécis: "${nextQ4.question}"`);

  // --- SCÉNARIO 5 : Nouveau bachelier cherchant une formation courte ---
  console.log("\n--- Scénario 5 : Nouveau bachelier cherchant une formation courte ---");
  const prof5 = heuristicUpdateProfile(
    "J'ai eu mon Bac S2 l'an dernier, je cherche une formation courte de 2 ans ou 3 ans type DUT, BTS ou Licence pour travailler vite",
    INITIAL_PROFILE
  );
  assert(prof5.preferences_etudes === "Courte (Bac+2 / Bac+3)", "Préférence formation courte détectée");
  const matches5 = findMatchingFormations(prof5);
  const hasShort = matches5.some(
    (m) =>
      m.diplome.toLowerCase().includes("licence") ||
      m.diplome.toLowerCase().includes("dut") ||
      m.diplome.toLowerCase().includes("bts") ||
      m.duree.includes("3") ||
      m.duree.includes("2")
  );
  assert(hasShort, "Formations courtes (premier cycle Bac+2/Bac+3) prioritaires et présentes");
  console.log(`  Exemple formation courte trouvée: ${matches5[0]?.nom} (${matches5[0]?.diplome})`);

  // --- SCÉNARIO 6 : Étudiant en réorientation ---
  console.log("\n--- Scénario 6 : Étudiant en réorientation ---");
  const prof6 = heuristicUpdateProfile(
    "Bonjour, je suis étudiant en première année de droit à l'UCAD mais je veux me réorienter vers l'informatique de gestion",
    INITIAL_PROFILE
  );
  assert(prof6.niveau === "Réorientation / Étudiant", "Niveau réorientation bien détecté");
  assert(prof6.interets_principaux.some((i) => i.toLowerCase().includes("informatique")), "Nouvel intérêt informatique détecté");

  // --- SCÉNARIO 7 : Résultats modestes / vérification des prérequis ---
  console.log("\n--- Scénario 7 : Notes modestes et alternatives ---");
  const prof7 = heuristicUpdateProfile(
    "Je suis en S2 avec 10 de moyenne, j'aime la santé mais je n'aurai pas la mention très bien pour la médecine",
    INITIAL_PROFILE
  );
  assert(prof7.moyenne === "10", "Moyenne 10 extraite");
  const matches7 = findMatchingFormations(prof7);
  assert(matches7.length > 0, "Propose des options alternatives adaptées sans exclure catégoriquement");

  // --- SCÉNARIO 8 : Contraintes de localisation et budget ---
  console.log("\n--- Scénario 8 : Contraintes localisation (Saint-Louis) et budget public ---");
  const prof8 = heuristicUpdateProfile(
    "Je veux rester à Saint-Louis et je ne peux payer que le tarif public Campusen de 25 000 FCFA",
    INITIAL_PROFILE
  );
  prof8.ville = "Saint-Louis";
  prof8.budget = "Public Campusen (25 000 FCFA/an)";
  prof8.serie = "S2";
  const matches8 = findMatchingFormations(prof8);
  const saintLouisMatches = matches8.filter(
    (m) =>
      m.localisation.toLowerCase().includes("saint-louis") ||
      m.localisation.toLowerCase().includes("ugb") ||
      m.etablissement.toLowerCase().includes("ugb")
  );
  assert(saintLouisMatches.length > 0, "Trouve des formations à Saint-Louis (UGB)");
  console.log(`  Formation UGB trouvée: ${saintLouisMatches[0]?.nom} (${saintLouisMatches[0]?.etablissement})`);

  // --- SCÉNARIO 9 : Question directe sur un concours (Concours EPT) ---
  console.log("\n--- Scénario 9 : Requête directe sur le Concours EPT ---");
  const ragResults = await searchKnowledge("quelles sont les conditions du concours EPT Thiès ?");
  assert(ragResults.length > 0, "RAG trouve des documents sur le concours EPT");
  const eptDoc = ragResults.find((r) => r.content.includes("École Polytechnique de Thiès") || r.content.includes("EPT"));
  assert(Boolean(eptDoc), "Document EPT extrait de la base officielle des concours");
  assert(eptDoc!.content.includes("7 000 FCFA"), "Frais officiels de 7 000 FCFA présents dans la base");
  console.log(`  Source RAG retenue: ${eptDoc?.source} (Similarité: ${(eptDoc!.similarity * 100).toFixed(1)}%)`);

  // --- SCÉNARIO 10 : Requête hors périmètre / information absente ---
  console.log("\n--- Scénario 10 : Recherche hors périmètre (diplôme fictif au Groenland) ---");
  const emptyRag = await searchKnowledge("comment devenir astronaute astrophysicien spécialiste des igloos au Groenland ?");
  assert(emptyRag.length === 0, "Aucun passage retenu par le RAG sous le seuil pour une requête hors sujet");
  console.log(`  Nombre de passages retenus: ${emptyRag.length} (aucun faux positif)`);

  // --- SCÉNARIO 11 : Avant-Bac - Collège / 3e (BFEM) vers lycée ---
  console.log("\n--- Scénario 11 : Avant-Bac - Élève en classe de 3e préparant le BFEM ---");
  const prof11 = heuristicUpdateProfile(
    "Bonjour, je m'appelle Awa, je suis en classe de 3e au collège, je prépare le BFEM et j'adore les SVT et soigner",
    INITIAL_PROFILE
  );
  assert(prof11.statut_parcours === "avant_bac", "Statut avant-bac détecté pour collégienne de 3e");
  assert(prof11.niveau === "Collège (3e / BFEM)", "Niveau Collège 3e bien identifié");
  const nextQ11 = getNextOrientationQuestion(prof11);
  assert(nextQ11.intent_id !== "intent_contraintes_duree_ville", "Ne force pas la question des études courtes post-bac (BTS/DUT) à un collégien");
  console.log(`  Prochaine intention pour l'élève de 3e: ${nextQ11.intent_id} ("${nextQ11.question}")`);

  // --- SCÉNARIO 12 : Avant-Bac - Lycéen en Seconde cherchant sa série de Bac ---
  console.log("\n--- Scénario 12 : Avant-Bac - Élève en Seconde au lycée ---");
  const prof12 = heuristicUpdateProfile(
    "Je m'appelle Cheikh, je suis en Seconde au lycée et j'hésite pour ma future série de Bac, j'aime les maths et la physique",
    INITIAL_PROFILE
  );
  assert(prof12.statut_parcours === "avant_bac", "Statut avant-bac détecté pour élève de Seconde");
  assert(prof12.niveau === "Lycée (Seconde / Première)", "Niveau Lycée Seconde bien identifié");
  assert(prof12.points_forts.some((p) => p.toLowerCase().includes("math")) || prof12.matieres_aimees.some((m) => m.toLowerCase().includes("math")), "Mathématiques détectées");

  // --- SCÉNARIO 13 : Post-Bac - Poursuite d'études / Passerelle après BTS/DUT ---
  console.log("\n--- Scénario 13 : Post-Bac - Passerelle de poursuite d'études après BTS/DUT ---");
  const prof13 = heuristicUpdateProfile(
    "Bonjour, je m'appelle Abdoulaye, j'ai terminé mon BTS en informatique et je cherche une passerelle pour poursuivre en Licence professionnelle ou Master",
    INITIAL_PROFILE
  );
  assert(prof13.statut_parcours === "post_bac", "Statut post-bac détecté pour titulaire de BTS");
  assert(prof13.type_post_bac === "passerelle_poursuite", "Type passerelle / poursuite d'études bien détecté");
  const nextQ13 = getNextOrientationQuestion(prof13);
  assert(
    nextQ13.intent_id === "intent_post_bac_objectifs" ||
      nextQ13.intent_id === "intent_approfondir_domaine" ||
      nextQ13.intent_id === "intent_decouvrir_interets",
    "Intention post-bac adaptée"
  );
  console.log(`  Question pour poursuite post-BTS: "${nextQ13.question}"`);

  // --- SCÉNARIO 14 : Nouveau bachelier (cas réel de l'utilisateur) ---
  console.log("\n--- Scénario 14 : Nouveau bachelier - enchaînement logique vers la série ---");
  const history14 = [
    { role: "user", content: "Ibrahima" },
    {
      role: "assistant",
      content:
        '{"reply":"Ravi de faire ta connaissance Ibrahima ! Où en es-tu actuellement dans tes études ?","suggestions":["Collège (3e / BFEM)","Lycée (Seconde ou 1ère)","Terminale ou Nouveau bachelier","Étudiant ou Réorientation"]}',
    },
  ];
  const prof14 = heuristicUpdateProfile(
    "Nouveau bachelier",
    history14,
    { ...INITIAL_PROFILE, prenom: "Ibrahima" }
  );

  assert(prof14.prenom === "Ibrahima", "Prénom Ibrahima conservé");
  assert(prof14.niveau === "Nouveau Bachelier", "Niveau Nouveau Bachelier reconnu");
  assert(prof14.serie === null, "Aucune série attribuée par défaut ou par erreur");
  assert(
    !prof14.interets_principaux.includes("Commerce & Gestion"),
    "La gestion n'est PAS attribuée par erreur à partir des suggestions de l'assistant"
  );
  assert(
    prof14.confirmed_interests.length === 0,
    "Aucun domaine prématurément confirmé"
  );

  const nextQ14 = getNextOrientationQuestion(prof14);
  assert(
    nextQ14.intent_id === "intent_demander_serie",
    "Demande logiquement la série du Bac après avoir su qu'il est nouveau bachelier"
  );
  assert(
    !nextQ14.question.toLowerCase().includes("gestion"),
    "La question ne parle PAS de gestion de manière prématurée"
  );
  console.log(`  Question logique pour Ibrahima: "${nextQ14.question}"`);

  // --- SCÉNARIO 15 : Bachelier Série L1 - Domaines prioritaires littéraires CNOSP ---
  console.log("\n--- Scénario 15 : Bachelier Série L1 - Domaines prioritaires littéraires CNOSP ---");
  const history15 = [
    ...history14,
    { role: "user", content: "Nouveau bachelier" },
    {
      role: "assistant",
      content: JSON.stringify({
        reply: nextQ14.question,
        suggestions: nextQ14.suggestions,
      }),
    },
  ];
  const prof15 = heuristicUpdateProfile("Je viens d'avoir mon Bac en série L1", history15, prof14);
  assert(prof15.serie === "L1", "Série L1 bien enregistrée");
  const nextQ15 = getNextOrientationQuestion(prof15);
  assert(nextQ15.intent_id === "intent_decouvrir_interets", "Prochaine intention: découvrir les univers d'intérêts");
  assert(
    nextQ15.suggestions.some((s) => s.includes("Langues") || s.includes("traduction")),
    "Propose les langues / traduction pour un élève de L1"
  );
  assert(
    nextQ15.suggestions.some((s) => s.includes("Journalisme") || s.includes("communication")),
    "Propose journalisme / communication pour un élève de L1"
  );
  assert(
    nextQ15.suggestions.some((s) => s.includes("Autre domaine") || s.includes("autre domaine")),
    "Propose l'option d'ouverture 'Un autre domaine m'intéresse' pour ne pas enfermer l'élève"
  );
  assert(
    !nextQ15.suggestions.includes("Sciences, maths & informatique"),
    "Ne propose PAS 'Sciences, maths & informatique' par défaut à un élève de série littéraire L1"
  );
  console.log(`  Suggestions L1 adaptées: ${JSON.stringify(nextQ15.suggestions)}`);

  // --- SCÉNARIO 16 : Élève de L1 choisissant 'Un autre domaine m'intéresse' ---
  console.log("\n--- Scénario 16 : Élève de L1 choisissant 'Un autre domaine m'intéresse' ---");
  const history16 = [
    ...history15,
    { role: "user", content: "Je viens d'avoir mon Bac en série L1" },
    {
      role: "assistant",
      content: JSON.stringify({
        reply: nextQ15.question,
        suggestions: nextQ15.suggestions,
      }),
    },
  ];
  const prof16 = heuristicUpdateProfile("Un autre domaine m'intéresse", history16, prof15);
  assert(prof16.recherche_autre_domaine === true, "Indicateur de recherche d'un autre domaine activé");
  const nextQ16 = getNextOrientationQuestion(prof16);
  assert(nextQ16.intent_id === "intent_autre_domaine", "Question adaptative sur l'autre univers souhaité");
  assert(
    nextQ16.suggestions.some((s) => s.includes("numérique") || s.includes("gestion")),
    "Propose des passerelles comme le numérique ou la gestion pour explorer un autre univers"
  );
  console.log(`  Question d'ouverture passerelle: "${nextQ16.question}"`);

  // --- SCÉNARIO 17 : Clic direct sur 'Bac S1 ou S2' sans prénom préalable ---
  console.log("\n--- Scénario 17 : Clic direct sur 'Bac S1 ou S2' sans prénom préalable ---");
  const prof17 = heuristicUpdateProfile("Bac S1 ou S2", INITIAL_PROFILE);
  assert(prof17.statut_parcours === "bac", "Statut parcours bien détecté comme Bac");
  assert(prof17.questions_answered["intent_demander_serie"] === "Bac S1 ou S2", "Réponse 'Bac S1 ou S2' bien enregistrée");
  assert(!prof17.prenom, "Aucun prénom fourni (utilisateur anonyme direct)");
  const nextQ17 = getNextOrientationQuestion(prof17);
  assert(
    nextQ17.intent_id === "intent_clarifier_s1_s2",
    "Ne demande PAS le prénom par erreur : clarifie immédiatement entre S1 et S2"
  );
  assert(
    !nextQ17.question.toLowerCase().includes("comment puis-je t'appeler"),
    "La question ne réclame pas le prénom"
  );
  assert(
    nextQ17.suggestions.some((s) => s.includes("S1")),
    "Propose le choix précis Série S1"
  );
  assert(
    nextQ17.suggestions.some((s) => s.includes("S2")),
    "Propose le choix précis Série S2"
  );
  console.log(`  Question de clarification scientifique: "${nextQ17.question}"`);

  // Suite Scénario 17 : Sélection de S1
  const history17 = [
    { role: "user", content: "Bac S1 ou S2" },
    { role: "assistant", content: JSON.stringify({ reply: nextQ17.question, suggestions: nextQ17.suggestions }) },
  ];
  const prof17_step2 = heuristicUpdateProfile("Série S1 (Sciences exactes & maths)", history17, prof17);
  assert(prof17_step2.serie === "S1", "Série S1 correctement assignée");
  const nextQ17_step2 = getNextOrientationQuestion(prof17_step2);
  assert(
    nextQ17_step2.intent_id === "intent_decouvrir_interets",
    "Passe directement aux domaines d'intérêt adaptés à la série S1"
  );
  assert(
    nextQ17_step2.suggestions.some((s) => s.includes("Informatique") || s.includes("Ingénieurs")),
    "Suggestions adaptées à la série S1"
  );

  console.log("\n=================================================");
  console.log("RÉSULTAT GLOBAL DES TESTS : LES 17 SCÉNARIOS SONT CONFORMES !");
  console.log("=================================================");
}

runTests().catch((err) => {
  console.error("Test runner error:", err);
  process.exit(1);
});
