#!/usr/bin/env node
// Ingestion des données sénégalaises dans Supabase. Usage : npm run seed (ou npm run db:seed)

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

// ─── Chargement des variables d'environnement depuis .env.local ────────────
function loadEnv() {
  try {
    const envPath = join(ROOT, ".env.local");
    const content = readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx === -1) continue;
      const key = trimmed.slice(0, idx).trim();
      const value = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    console.error("❌ Impossible de lire .env.local. Vérifiez que le fichier existe.");
    process.exit(1);
  }
}

loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || SERVICE_ROLE_KEY === "" || SERVICE_ROLE_KEY === "placeholder") {
  console.error("❌ SUPABASE_SERVICE_ROLE_KEY manquante dans .env.local.");
  console.error("   Renseignez la clé service_role depuis le dashboard Supabase → Settings → API.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ─── Chargement des fichiers JSON ──────────────────────────────────────────
function loadJSON(filename) {
  const path = join(ROOT, "data", filename);
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch (e) {
    console.warn(`⚠️  Impossible de lire ${filename} :`, e.message);
    return [];
  }
}

// ─── Ingestion des établissements ──────────────────────────────────────────
async function seedEtablissements() {
  console.log("\n📚 Ingestion des établissements...");
  const data = loadJSON("etablissements.json");
  if (!data.length) return;

  let inserted = 0;
  let skipped = 0;

  for (const etab of data) {
    // Construire les champs correspondant à la table universites
    const filieres = [
      ...(etab.filieres_proposees ?? []),
      ...(etab.formations_accreditees ?? []),
      ...(etab.facultes_ou_ufr ?? []),
    ]
      .filter(Boolean)
      .filter((v, i, arr) => arr.indexOf(v) === i) // dédoublonnage
      .slice(0, 50); // limite raisonnable

    const debouches = etab.debouches_metiers ?? etab.debouches ?? [];

    const record = {
      nom: etab.nom ?? etab.sigle,
      ville: etab.ville ?? etab.region ?? "Sénégal",
      filieres: filieres.length ? filieres : ["Non spécifié"],
      admission:
        etab.procedure_admission ??
        etab.processus_admission ??
        "Voir Campusen (campusen.sec.gouv.sn)",
      debouches: Array.isArray(debouches) ? debouches.slice(0, 30) : [],
    };

    const { error } = await supabase
      .from("universites")
      .upsert(record, { onConflict: "nom" })
      .select();

    if (error) {
      console.warn(`  ⚠ ${record.nom} :`, error.message);
      skipped++;
    } else {
      inserted++;
    }
  }

  console.log(`  ✅ ${inserted} établissement(s) insérés, ${skipped} erreur(s).`);
}

// ─── Ingestion des filières comme knowledge_embeddings ─────────────────────
async function seedFilieres() {
  console.log("\n🎓 Ingestion des filières comme base RAG...");
  const data = loadJSON("filieres.json");
  if (!data.length) return;

  const records = [];

  for (const filiere of data) {
    const content = [
      `FILIÈRE : ${filiere.nom ?? filiere.intitule ?? ""}`,
      filiere.domaine ? `Domaine : ${filiere.domaine}` : "",
      filiere.description ? `Description : ${filiere.description}` : "",
      filiere.series_bac_requises?.length
        ? `Séries Bac recommandées : ${filiere.series_bac_requises.join(", ")}`
        : "",
      filiere.duree ? `Durée : ${filiere.duree}` : "",
      filiere.debouches?.length
        ? `Débouchés : ${filiere.debouches.slice(0, 10).join(", ")}`
        : "",
      filiere.etablissements?.length
        ? `Établissements proposant cette filière : ${filiere.etablissements.slice(0, 5).join(", ")}`
        : "",
      filiere.conditions_admission
        ? `Admission : ${filiere.conditions_admission}`
        : "",
    ]
      .filter(Boolean)
      .join("\n");

    if (content.length < 20) continue; // ignorer les entrées trop courtes

    records.push({
      content: content.slice(0, 4000), // limite Postgres TEXT sécurisée
      source: `filiere_${(filiere.id ?? filiere.nom ?? "").toLowerCase().replace(/\s+/g, "_").slice(0, 50)}`,
    });
  }

  // Insertion par lots de 50
  let inserted = 0;
  for (let i = 0; i < records.length; i += 50) {
    const batch = records.slice(i, i + 50);
    const { error } = await supabase.from("knowledge_embeddings").insert(batch);
    if (error) {
      console.warn(`  ⚠ Erreur lot ${i / 50 + 1} :`, error.message);
    } else {
      inserted += batch.length;
    }
  }

  console.log(`  ✅ ${inserted}/${records.length} filière(s) insérées en base RAG.`);
}


// ─── Ingestion des concours ────────────────────────────────────────────────
async function seedConcours() {
  console.log("\n🏆 Ingestion des concours comme base RAG...");
  const data = loadJSON("concours.json");
  if (!data.length) return;

  const records = [];

  for (const concours of data) {
    const content = [
      `CONCOURS : ${concours.nom ?? ""}`,
      concours.etablissement ? `Établissement : ${concours.etablissement}` : "",
      concours.description ? `Description : ${concours.description}` : "",
      concours.conditions_admission
        ? `Conditions d'admission : ${concours.conditions_admission}`
        : "",
      concours.series_bac_requises?.length
        ? `Séries : ${concours.series_bac_requises.join(", ")}`
        : "",
      concours.date_concours
        ? `Date / Période : ${concours.date_concours}`
        : "",
      concours.debouches?.length
        ? `Débouchés : ${concours.debouches.slice(0, 8).join(", ")}`
        : "",
      concours.frais_inscription
        ? `Frais d'inscription : ${concours.frais_inscription}`
        : "",
      concours.contact_ou_lien
        ? `Contact / Lien officiel : ${concours.contact_ou_lien}`
        : "",
    ]
      .filter(Boolean)
      .join("\n");

    if (content.length < 20) continue;

    records.push({
      content: content.slice(0, 4000),
      source: `concours_${(concours.id ?? concours.nom ?? "").toLowerCase().replace(/\s+/g, "_").slice(0, 50)}`,
    });
  }

  let inserted = 0;
  for (let i = 0; i < records.length; i += 50) {
    const batch = records.slice(i, i + 50);
    const { error } = await supabase.from("knowledge_embeddings").insert(batch);
    if (error) {
      console.warn(`  ⚠ Erreur lot ${i / 50 + 1} :`, error.message);
    } else {
      inserted += batch.length;
    }
  }

  console.log(`  ✅ ${inserted}/${records.length} concours insérés en base RAG.`);
}

// ─── Programme principal ────────────────────────────────────────────────────
async function main() {
  console.log("🇸🇳 Agent IA d'Orientation — Script de seed des données");
  console.log(`🔗 Supabase URL : ${SUPABASE_URL}`);
  console.log("─".repeat(60));

  // Test de connexion
  const { error: pingError } = await supabase.from("universites").select("id").limit(1);
  if (pingError) {
    console.error("❌ Impossible de se connecter à Supabase :", pingError.message);
    console.error("   Vérifiez que la migration SQL a bien été appliquée sur votre projet Supabase.");
    process.exit(1);
  }

  console.log("✅ Connexion Supabase OK");

  await seedEtablissements();
  await seedFilieres();
  await seedConcours();

  console.log("\n" + "─".repeat(60));
  console.log("🎉 Seed terminé ! L'agent IA dispose maintenant des données sénégalaises.");
  console.log("   Prochaine étape : générer les embeddings via /api/admin/generate-embeddings");
}

main().catch((e) => {
  console.error("Erreur fatale :", e);
  process.exit(1);
});
