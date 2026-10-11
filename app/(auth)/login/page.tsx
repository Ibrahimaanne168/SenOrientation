// Page de connexion via Magic Link — palette SenOrientation chic
"use client";

import { useState } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { authEmailSchema } from "@/lib/validation/schemas";
import { ArrowRight, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const validation = authEmailSchema.safeParse({ email });
    if (!validation.success) {
      setError(validation.error.issues[0]?.message || "Email invalide");
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithOtp({
        email: validation.data.email,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });

      if (authError) {
        if (authError.message.includes("fetch failed") || authError.status === 500) {
          setError("Impossible de contacter le serveur d'authentification.");
        } else {
          setError(authError.message || "Erreur lors de l'envoi du lien.");
        }
        return;
      }
      setSubmitted(true);
    } catch {
      setError("Une erreur inattendue est survenue. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-[#FBF8F2]">
      {/* Bandeau tricolore en haut de la page */}
      <div className="fixed top-0 left-0 right-0 flex h-[3px]" aria-hidden="true">
        <div className="flex-1 bg-[#0B2545]" />
        <div className="flex-1 bg-[#C1592A]" />
        <div className="flex-1 bg-[#14532D]" />
      </div>

      <div className="w-full max-w-sm bg-white rounded-2xl border border-[#E5DFD4] shadow-sm overflow-hidden">
        {/* Logo + titre */}
        <div className="flex flex-col items-center text-center px-8 pt-8 pb-6">
          <div className="mb-4 w-16 h-16 rounded-2xl bg-[#FBF8F2] border border-[#E5DFD4] flex items-center justify-center p-2">
            <Image
              src="/logo.png"
              alt="Logo SenOrientation"
              width={48}
              height={48}
              priority
              className="object-contain"
            />
          </div>
          <h1
            className="text-2xl font-bold text-[#0B2545] leading-tight"
            style={{ fontFamily: "var(--font-fraunces), Georgia, serif" }}
          >
            SenOrientation
          </h1>
          <p
            className="text-[10px] uppercase tracking-widest text-[#7A7068] mt-1"
            style={{ fontFamily: "var(--font-inter), sans-serif" }}
          >
            Agent IA d&apos;Orientation
          </p>
          {/* Filet tricolore sous le titre */}
          <div className="flex mt-3 gap-1" aria-hidden="true">
            <div className="h-0.5 w-8 rounded-full bg-[#0B2545]" />
            <div className="h-0.5 w-5 rounded-full bg-[#C1592A]" />
            <div className="h-0.5 w-3 rounded-full bg-[#14532D]" />
          </div>
        </div>

        <div className="px-8 pb-8">
          {submitted ? (
            <div
              className="p-5 bg-[#14532D]/8 border border-[#14532D]/20 rounded-xl text-center space-y-3"
              role="status"
              aria-live="polite"
            >
              <CheckCircle2 className="w-9 h-9 text-[#14532D] mx-auto" />
              <h2
                className="text-base font-bold text-[#0B2545]"
                style={{ fontFamily: "var(--font-fraunces), Georgia, serif" }}
              >
                Lien envoyé !
              </h2>
              <p
                className="text-xs text-[#7A7068]"
                style={{ fontFamily: "var(--font-inter), sans-serif" }}
              >
                Un lien de connexion a été envoyé à{" "}
                <strong className="text-[#0B2545]">{email}</strong>.
              </p>
              <button
                type="button"
                onClick={() => { setSubmitted(false); setEmail(""); }}
                className="text-xs text-[#C1592A] underline hover:text-[#0B2545] transition-colors"
                style={{ fontFamily: "var(--font-inter), sans-serif" }}
              >
                Utiliser une autre adresse
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div>
                <label
                  htmlFor="email-input"
                  className="block text-xs font-bold uppercase tracking-widest text-[#0B2545] mb-2"
                  style={{ fontFamily: "var(--font-inter), sans-serif" }}
                >
                  Adresse email
                </label>
                <input
                  id="email-input"
                  name="email"
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); if (error) setError(null); }}
                  placeholder="prenom.nom@exemple.sn"
                  required
                  aria-required="true"
                  aria-invalid={error ? "true" : "false"}
                  aria-describedby={error ? "email-error" : undefined}
                  disabled={loading}
                  className={`w-full px-4 py-2.5 rounded-xl border-[1.5px] text-sm bg-[#FBF8F2] text-[#1A1A1A] placeholder:text-[#B0A99C] focus:outline-none focus:bg-white transition-all ${
                    error
                      ? "border-red-400 focus:border-red-500"
                      : "border-[#D6CEBE] focus:border-[#0B2545]"
                  }`}
                  style={{ fontFamily: "var(--font-inter), sans-serif" }}
                />
                {error && (
                  <div
                    id="email-error"
                    className="flex items-center gap-1.5 mt-2 text-xs text-red-600"
                    role="alert"
                    style={{ fontFamily: "var(--font-inter), sans-serif" }}
                  >
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={loading || !email.trim()}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#C1592A] hover:bg-[#a84924] text-white text-sm font-semibold transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ fontFamily: "var(--font-inter), sans-serif" }}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Envoi en cours…</span>
                  </>
                ) : (
                  <>
                    <span>Recevoir mon lien de connexion</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="text-center">
                <Link
                  href="/chat"
                  className="text-xs text-[#7A7068] hover:text-[#C1592A] underline underline-offset-2 transition-colors"
                  style={{ fontFamily: "var(--font-inter), sans-serif" }}
                >
                  Continuer sans compte (accès invité)
                </Link>
              </div>
            </form>
          )}
        </div>

        {/* Pied de carte */}
        <div className="px-8 py-4 bg-[#FBF8F2] border-t border-[#E5DFD4] text-center">
          <p
            className="text-[10px] text-[#7A7068]"
            style={{ fontFamily: "var(--font-inter), sans-serif" }}
          >
            🔒 Aucun mot de passe stocké. Données protégées.
          </p>
        </div>
      </div>
    </main>
  );
}
