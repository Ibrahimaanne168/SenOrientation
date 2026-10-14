import fs from "fs";

const files = [
  "formations.json",
  "etablissements.json",
  "composantes.json",
  "concours.json",
  "filieres.json",
  "metiers.json",
  "domaines_interet.json"
];

for (const file of files) {
  try {
    const raw = fs.readFileSync(`./data/${file}`, "utf-8");
    const parsed = JSON.parse(raw);
    console.log(`${file}: ${Array.isArray(parsed) ? parsed.length + " éléments" : "Objet JSON"}`);
    if (Array.isArray(parsed) && parsed.length > 0) {
      console.log(`  Exemple de clés: ${Object.keys(parsed[0]).join(", ")}`);
    }
  } catch (e) {
    console.error(`Erreur pour ${file}:`, e.message);
  }
}
