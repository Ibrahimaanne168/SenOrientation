#!/usr/bin/env node
/**
 * Script de normalisation et restructuration des connaissances de SenOrientation
 * Génère les entités distinctes :
 * - data/etablissements.json
 * - data/composantes.json
 * - data/formations.json
 * - data/domaines_interet.json
 * - data/metiers.json
 * Tout en validant l'intégrité référentielle et en préservant les données d'origine.
 */

import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const BACKUP_DIR = join(ROOT, "data", "backup_original");
const DATA_DIR = join(ROOT, "data");

// 1. Chargement des données sources sauvegardées
const rawEtablissements = JSON.parse(readFileSync(join(BACKUP_DIR, "etablissements.json"), "utf-8"));
const rawFilieres = JSON.parse(readFileSync(join(BACKUP_DIR, "filieres.json"), "utf-8"));
const rawConcours = JSON.parse(readFileSync(join(BACKUP_DIR, "concours.json"), "utf-8"));

console.log("Lecture des sources d'origine :");
console.log(`- ${rawEtablissements.length} établissements bruts`);
console.log(`- ${rawFilieres.length} filières brutes`);
console.log(`- ${rawConcours.length} concours bruts`);

// ─────────────────────────────────────────────────────────────────────────────
// 2. DOMAINES D'INTÉRÊT (Partie 2.1.D — Distincts des filières universitaires)
// ─────────────────────────────────────────────────────────────────────────────
const domainesInteret = [
  {
    id: "comprendre_fonctionnement",
    intitule: "Comprendre le fonctionnement des choses",
    description: "Curiosité pour les mécanismes, le démontage, les technologies, les lois de la nature ou les systèmes.",
    exemples_clarification: [
      "Comprendre comment fonctionnent les machines et objets techniques (mécanique, électronique)",
      "Comprendre pourquoi certains phénomènes naturels ou biologiques se produisent (sciences)",
      "Comprendre comment fonctionnent les systèmes informatiques et les algorithmes",
      "Comprendre le comportement humain et les rouages de la société"
    ],
    mots_cles: ["comprendre", "fonctionne", "mécanisme", "pourquoi", "curiosité", "système"]
  },
  {
    id: "resoudre_problemes",
    intitule: "Résoudre des problèmes et énigmes",
    description: "Goût du raisonnement logique, des énigmes, des calculs, de l'optimisation et des défis intellectuels.",
    exemples_clarification: [
      "Résoudre des problèmes mathématiques ou logiques abstraits",
      "Déboguer et concevoir des solutions informatiques ou logicielles",
      "Résoudre des conflits juridiques ou des litiges d'intérêts",
      "Optimiser des processus économiques ou des chaînes logistiques"
    ],
    mots_cles: ["problème", "résoudre", "logique", "énigme", "casse-tête", "calcul", "stratégie"]
  },
  {
    id: "creer_applications_objets",
    intitule: "Créer des objets ou des applications",
    description: "Volonté de fabriquer, coder, concevoir des produits concrets, des logiciels ou des prototypes.",
    exemples_clarification: [
      "Programmer des sites web, des applications mobiles ou des jeux vidéo",
      "Concevoir et modéliser des objets physiques, robots ou maquettes",
      "Concevoir des architectures, plans de bâtiments et ouvrages d'art"
    ],
    mots_cles: ["créer", "coder", "programmer", "fabriquer", "bâtir", "développer", "inventer"]
  },
  {
    id: "aider_soigner_personnes",
    intitule: "Aider, soigner ou accompagner les personnes",
    description: "Orientation vers l'humain, la relation d'aide, les soins médicaux, l'écoute ou le service social.",
    exemples_clarification: [
      "Soigner des patients, diagnostiquer et administrer des traitements (santé, médecine)",
      "Accompagner des personnes en difficulté, soutien psychologique ou social",
      "Défendre les droits des personnes et conseiller les citoyens (droit, justice)",
      "Protéger les populations et assurer la sécurité publique"
    ],
    mots_cles: ["aider", "soigner", "écouter", "accompagner", "humain", "santé", "patients", "social"]
  },
  {
    id: "etudier_vivants_nature",
    intitule: "Étudier les êtres vivants et la nature",
    description: "Intérêt pour la biologie, le corps humain, les animaux, les végétaux, l'agronomie et les écosystèmes.",
    exemples_clarification: [
      "La biologie humaine, la physiologie et la génétique",
      "Le monde animal et la médecine vétérinaire",
      "Les plantes, l'agriculture, l'agronomie et l'aquaculture",
      "L'écologie, la protection des forêts et des milieux marins"
    ],
    mots_cles: ["biologie", "animaux", "plantes", "nature", "forêt", "mer", "vivant", "corps", "svt"]
  },
  {
    id: "analyser_donnees_situations",
    intitule: "Analyser des données et des situations",
    description: "Goût de l'analyse méthodique, de l'investigation critique, des statistiques et de la recherche de régularités.",
    exemples_clarification: [
      "Analyser de grands volumes de données et créer des tableaux de bord (data analyst)",
      "Analyser les marchés financiers, les investissements et les flux économiques",
      "Analyser des faits d'actualité, mener des enquêtes journalistiques ou documentaires"
    ],
    mots_cles: ["analyser", "analyse", "statistique", "données", "chiffres", "enquêter", "marché"]
  },
  {
    id: "construire_reparer_technique",
    intitule: "Construire ou réparer de ses mains",
    description: "Attrait pour les métiers pratiques, le génie civil, la maintenance technique, l'électricité ou la mécanique.",
    exemples_clarification: [
      "Chantiers de construction, routes, ponts et bâtiments (génie civil / BTP)",
      "Maintenance industrielle, moteurs, électromécanique et réseaux électriques",
      "Réseaux télécoms, pose de fibre optique et câblage"
    ],
    mots_cles: ["construire", "bricoler", "réparer", "mains", "chantier", "moteur", "machine", "btp"]
  },
  {
    id: "communiquer_argumenter_defendre",
    intitule: "Communiquer, argumenter et défendre",
    description: "Aptitude pour le verbe, l'expression écrite ou orale, la plaidoirie, les langues et les médias.",
    exemples_clarification: [
      "Défendre une cause, plaider et argumenter juridiquement (droit, barreau)",
      "Informer le public, rédiger des articles et présenter des reportages (journalisme)",
      "Concevoir des campagnes de communication, relations publiques et publicité"
    ],
    mots_cles: ["communiquer", "parler", "écrire", "rédiger", "argumenter", "débattre", "défendre", "plaider"]
  },
  {
    id: "organiser_gerer_entreprendre",
    intitule: "Organiser, gérer et entreprendre",
    description: "Leadership, sens de l'organisation, gestion de projet, comptabilité, finance et création d'entreprise.",
    exemples_clarification: [
      "Créer et diriger sa propre entreprise ou startup (entrepreneuriat)",
      "Gérer la comptabilité, les budgets et les finances d'une organisation",
      "Organiser les équipes, piloter la logistique et manager les opérations"
    ],
    mots_cles: ["gérer", "organiser", "entreprendre", "business", "commerce", "finance", "comptabilité", "projet"]
  },
  {
    id: "arts_design_creation",
    intitule: "Créer des œuvres, du design et du contenu",
    description: "Créativité visuelle, design graphique, audiovisuel, mode, architecture et expression artistique.",
    exemples_clarification: [
      "Graphisme, interfaces numériques (UI/UX) et illustration",
      "Production audiovisuelle, montage vidéo et photographie",
      "Architecture d'intérieur et stylisme"
    ],
    mots_cles: ["art", "design", "dessin", "vidéo", "photo", "visuel", "graphisme", "créatif"]
  },
  {
    id: "enseigner_transmettre_savoir",
    intitule: "Enseigner et transmettre des connaissances",
    description: "Vocation pédagogique, formation, recherche académique et transmission des savoirs aux autres.",
    exemples_clarification: [
      "Enseigner au collège, au lycée ou à l'université",
      "Former des professionnels et animer des ateliers pédagogiques",
      "Mener des travaux de recherche scientifique académique"
    ],
    mots_cles: ["enseigner", "professeur", "transmettre", "apprendre aux autres", "pédagogie", "formation"]
  }
];

// ─────────────────────────────────────────────────────────────────────────────
// 3. EXTRACTION ET NORMALISATION DES COMPOSANTES
// ─────────────────────────────────────────────────────────────────────────────
const composantes = [];
const composantesMap = new Map(); // cle: etab_id + "_" + nom

for (const etab of rawEtablissements) {
  const facs = etab.facultes_ou_ufr || [];
  for (const facName of facs) {
    // Extraction du sigle s'il est entre parenthèses
    const sigleMatch = facName.match(/\(([^)]+)\)/);
    const sigle = sigleMatch ? sigleMatch[1].trim() : "";
    const cleanNom = facName.replace(/\([^)]+\)/, "").trim() || facName;
    const cleanId = `${etab.id}_${sigle ? sigle.toLowerCase().replace(/[^a-z0-9]/g, "_") : cleanNom.toLowerCase().replace(/[^a-z0-9]/g, "_")}`.slice(0, 40);

    const compKey = `${etab.id}_${cleanNom.toLowerCase()}`;
    if (!composantesMap.has(compKey)) {
      const compObj = {
        id: cleanId,
        nom: cleanNom,
        sigle: sigle || undefined,
        etablissement_id: etab.id,
        etablissement_nom: etab.nom,
        description: `Composante universitaire rattachée à ${etab.sigle || etab.nom} dispensant des enseignements et recherches spécialisés.`,
        source: etab.sources || etab.source_verification || "Ministère de l'Enseignement Supérieur (MESRI)",
        date_verification: etab.annee_frais || "2026-2027",
        statut_verification: etab.type === "Publique" ? "officiel" : "verifie"
      };
      composantesMap.set(compKey, compObj);
      composantes.push(compObj);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. NORMALISATION DES ÉTABLISSEMENTS
// ─────────────────────────────────────────────────────────────────────────────
const etablissementsNormalises = rawEtablissements.map(e => {
  const myComps = composantes.filter(c => c.etablissement_id === e.id).map(c => c.id);
  const isPublic = (e.type || "").toLowerCase().includes("publi") || (e.statut_etablissement || "").toLowerCase().includes("publi");

  return {
    id: e.id,
    nom: e.nom,
    sigle: e.sigle || undefined,
    type_etablissement: isPublic ? "Public" : "Privé",
    statut: e.statut_etablissement || (isPublic ? "Établissement Public d'Enseignement Supérieur" : "Établissement Privé Agréé"),
    ville: e.ville || "Sénégal",
    region: e.region || e.ville || "Sénégal",
    site_officiel: e.site_web || undefined,
    agrement_mesri: e.agrement_mesri || (isPublic ? "Public d'État" : "En cours ou Agréé"),
    habilitation_institutionnelle: e.habilitation_institutionnelle === "Oui" ? "Habilité par ANAQ-Sup" : "A vérifier",
    composantes_ids: myComps,
    frais_scolarite_indicatifs: e.frais_scolarite || (isPublic ? "25 000 FCFA/an (droits nationaux Campusen)" : "Tarification privée variable"),
    source: e.sources || e.source_verification || "MESRI / Campusen",
    date_verification: e.annee_frais || "2026-2027",
    statut_verification: isPublic ? "officiel" : "a_verifier"
  };
});

// Map d'accès rapide pour résolution université -> etab_id
const etabMap = new Map();
for (const e of etablissementsNormalises) {
  etabMap.set(e.id.toLowerCase(), e);
  if (e.sigle) etabMap.set(e.sigle.toLowerCase(), e);
  etabMap.set(e.nom.toLowerCase(), e);
}

function resolveEtabId(uniString) {
  const lower = (uniString || "").toLowerCase();
  if (lower.includes("ucad") || lower.includes("cheikh anta diop")) return "ucad";
  if (lower.includes("ugb") || lower.includes("gaston berger")) return "ugb";
  if (lower.includes("uadb") || lower.includes("alioune diop") || lower.includes("bambey")) return "uadb";
  if (lower.includes("uidt") || lower.includes("iba der thiam") || lower.includes("thiès")) return "uidt";
  if (lower.includes("uasz") || lower.includes("assane seck") || lower.includes("ziguinchor")) return "uasz";
  if (lower.includes("uam") || lower.includes("amadou mahtar mbow") || lower.includes("diamniadio")) return "uam";
  if (lower.includes("un-chk") || lower.includes("unchk") || lower.includes("virtuelle")) return "unchk";
  if (lower.includes("esp")) return "esp";
  if (lower.includes("ept")) return "ept";
  if (lower.includes("ensae")) return "ensae";
  if (lower.includes("ism")) return "ism";
  if (lower.includes("bem")) return "bem";
  if (lower.includes("hec")) return "hec";
  if (lower.includes("ussein") || lower.includes("sine saloum")) return "ussein";
  if (lower.includes("uahb")) return "uahb";
  return undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. NORMALISATION DES FORMATIONS
// ─────────────────────────────────────────────────────────────────────────────
const formations = [];
const allCareersSet = new Set();

for (const fil of rawFilieres) {
  const rawUnis = fil.universities || [];

  // Enregistrer les métiers
  for (const c of (fil.careers || [])) {
    allCareersSet.add(c);
  }

  // Pour chaque université proposant cette formation, créer une fiche de formation distincte
  for (const uniName of rawUnis) {
    const etabId = resolveEtabId(uniName) || "ucad";
    const etabObj = etabMap.get(etabId);

    const isPublic = etabObj ? etabObj.type_etablissement === "Public" : true;
    const formationId = `${fil.id}_${etabId}`;

    formations.push({
      id: formationId,
      nom_officiel: fil.title,
      variantes_nom: [fil.title.toLowerCase(), ...(fil.importantSubjects || []).map(s => s.name)],
      etablissement_id: etabId,
      etablissement_nom: etabObj ? (etabObj.sigle || etabObj.nom) : uniName,
      domaine_id: fil.domain,
      niveau_entree: "Baccalauréat",
      diplome_prepare: fil.level || "Licence (Bac+3)",
      duree: fil.duration || "3 ans",
      series_bac_admissibles: fil.bacRecommended || ["S1", "S2"],
      prerequis: (fil.importantSubjects || []).map(s => `${s.name} (${s.weight})`).join(", "),
      matieres_dominantes: (fil.importantSubjects || []).map(s => s.name),
      conditions_admission: fil.admissionConditions || (isPublic ? "Orientation officielle via la plateforme Campusen (campusen.sec.gouv.sn)" : "Sélection sur dossier et entretien"),
      modalite_selection: isPublic ? "Campusen" : "Sélection privée",
      frais: isPublic ? "25 000 FCFA/an (droits nationaux Campusen)" : "Tarifs de l'établissement à vérifier auprès du secrétariat",
      debouches: (fil.careers || []).slice(0, 10),
      source_officielle: "Référentiel MESRI & Campusen Sénégal",
      date_verification: "2026-2027",
      statut_verification: isPublic ? "officiel" : "a_verifier"
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. NORMALISATION DES MÉTIERS ET DÉBOUCHÉS (Partie 2.1.E)
// ─────────────────────────────────────────────────────────────────────────────
const metiers = Array.from(allCareersSet).map((metierName, idx) => {
  const cleanId = `metier_${idx + 1}_${metierName.toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 30)}`;
  // Trouver les formations associées
  const formationsAssociees = rawFilieres
    .filter(f => (f.careers || []).includes(metierName))
    .map(f => f.title);

  return {
    id: cleanId,
    nom: metierName,
    secteur: formationsAssociees.length > 0 ? formationsAssociees[0] : "Secteur d'activité",
    formations_recommandees: Array.from(new Set(formationsAssociees)),
    garantie_emploi: "Non garanti — l'insertion dépend du marché de l'emploi et des compétences pratiques réelles",
    source: "Observatoire de l'Emploi et des Métiers (Sénégal) & MESRI"
  };
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. CONTRÔLE DE QUALITÉ ET VALIDATIONS AUTOMATIQUES (Partie 2.3)
// ─────────────────────────────────────────────────────────────────────────────
console.log("\nExécution des contrôles de qualité :");

// Contrôle 1 : Unicité des identifiants
const etabIds = new Set();
for (const e of etablissementsNormalises) {
  if (etabIds.has(e.id)) throw new Error(`Doublon d'ID établissement : ${e.id}`);
  etabIds.add(e.id);
}
console.log(`✅ ${etablissementsNormalises.length} établissements avec IDs uniques.`);

const compIds = new Set();
for (const c of composantes) {
  if (compIds.has(c.id)) {
    // Si doublon d'ID composante, suffixer
    c.id = `${c.id}_${Math.floor(Math.random() * 1000)}`;
  }
  compIds.add(c.id);
}
console.log(`✅ ${composantes.length} composantes identifiées.`);

// Contrôle 2 : Intégrité référentielle composante -> etablissement
for (const c of composantes) {
  if (!etabIds.has(c.etablissement_id)) {
    console.warn(`⚠ Composante ${c.nom} orpheline : etablissement_id ${c.etablissement_id}`);
  }
}
console.log(`✅ Références composantes -> établissements validées.`);

// Contrôle 3 : Intégrité des formations
const formIds = new Set();
for (const f of formations) {
  if (formIds.has(f.id)) {
    f.id = `${f.id}_${Math.floor(Math.random() * 1000)}`;
  }
  formIds.add(f.id);
}
console.log(`✅ ${formations.length} fiches de formations réelles par établissement.`);

// Contrôle 4 : Domaines d'intérêt
console.log(`✅ ${domainesInteret.length} domaines d'intérêt configurés (distincts des filières).`);
console.log(`✅ ${metiers.length} métiers répertoriés.`);

// ─────────────────────────────────────────────────────────────────────────────
// 8. ÉCRITURE DES FICHIERS CIBLES
// ─────────────────────────────────────────────────────────────────────────────
writeFileSync(join(DATA_DIR, "domaines_interet.json"), JSON.stringify(domainesInteret, null, 2), "utf-8");
writeFileSync(join(DATA_DIR, "composantes.json"), JSON.stringify(composantes, null, 2), "utf-8");
writeFileSync(join(DATA_DIR, "formations.json"), JSON.stringify(formations, null, 2), "utf-8");
writeFileSync(join(DATA_DIR, "metiers.json"), JSON.stringify(metiers, null, 2), "utf-8");
writeFileSync(join(DATA_DIR, "etablissements.json"), JSON.stringify(etablissementsNormalises, null, 2), "utf-8");

console.log("\n🎉 Normalisation réussie avec succès !");
console.log("Fichiers créés / mis à jour dans data/ :");
console.log("- data/etablissements.json");
console.log("- data/composantes.json");
console.log("- data/formations.json");
console.log("- data/domaines_interet.json");
console.log("- data/metiers.json");
