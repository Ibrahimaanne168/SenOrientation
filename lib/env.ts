import { z } from "zod";

/**
 * Validation des variables d'environnement avec Zod
 * Empêche le démarrage si des variables critiques sont mal formées.
 */
const envSchema = z.object({
  // Variables publiques (Supabase client)
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .url("NEXT_PUBLIC_SUPABASE_URL doit être une URL valide")
    .default("http://127.0.0.1:54321"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY est requis")
    .default("dummy-anon-key-placeholder-for-dev"),

  // Variables strictement serveur
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .optional()
    .default(""),
  OPENAI_API_KEY: z
    .string()
    .optional()
    .default(""),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
});

// Parse en mode sécurisé
const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  // eslint-disable-next-line no-console
  console.error(
    "❌ Configuration d'environnement invalide :",
    JSON.stringify(_env.error.format(), null, 2)
  );
  throw new Error("Variables d'environnement manquantes ou invalides.");
}

export const env = _env.data;
