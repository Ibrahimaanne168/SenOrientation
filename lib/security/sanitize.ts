/**
 * Sanitisation et sécurisation des entrées textuelles contre les injections de prompt (Prompt Injection / Jailbreak)
 */

// Patterns suspects d'injection ou d'évasion d'instructions
const SUSPICIOUS_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior)\s+instructions/i,
  /oublie\s+(toutes\s+)?(les\s+)?instructions\s+précédentes/i,
  /system\s+prompt/i,
  /you\s+are\s+now\s+a/i,
  /mode\s+développeur/i,
  /dan\s+mode/i,
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /javascript:/i,
];

export interface SanitizeResult {
  cleanText: string;
  isSuspicious: boolean;
  warnings: string[];
}

/**
 * Nettoie le texte utilisateur et signale les tentatives suspectes
 */
export function sanitizeUserInput(input: string, maxLength = 2000): SanitizeResult {
  const warnings: string[] = [];
  let isSuspicious = false;

  if (typeof input !== "string") {
    return { cleanText: "", isSuspicious: true, warnings: ["Entrée invalide"] };
  }

  // 1. Tronquer si dépasse la longueur max
  let cleanText = input.slice(0, maxLength).trim();

  // 2. Normalisation Unicode
  cleanText = cleanText.normalize("NFC");

  // 3. Détection des motifs d'injection de prompt
  for (const pattern of SUSPICIOUS_PATTERNS) {
    if (pattern.test(cleanText)) {
      isSuspicious = true;
      warnings.push(`Motif suspect détecté : ${pattern.source}`);
      // Remplacer les directives malveillantes par un marqueur neutre
      cleanText = cleanText.replace(pattern, "[contenu filtré]");
    }
  }

  // 4. Suppression des caractères de contrôle ASCII invisibles non-standards (sauf \n, \r, \t)
  cleanText = cleanText.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

  return {
    cleanText,
    isSuspicious,
    warnings,
  };
}
