import { createBrowserClient } from "@supabase/ssr";

/**
 * Client Supabase côté navigateur (CSR)
 * Utilise la clé anonyme publique (NEXT_PUBLIC_SUPABASE_ANON_KEY)
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key"
  );
}
