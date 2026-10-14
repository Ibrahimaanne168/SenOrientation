"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, ArrowRight, CheckCircle2, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

import BrandLogo from "@/components/BrandLogo";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const cleanEmail = email.trim();

    if (!cleanEmail) {
      setError("Veuillez saisir votre adresse email.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      setError("Adresse email invalide. Exemple : prenom.nom@ucad.edu.sn");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const redirectUrl =
        typeof window !== "undefined"
          ? `${window.location.origin}/auth/callback`
          : undefined;

      const { error: signInError } = await supabase.auth.signInWithOtp({
        email: cleanEmail,
        options: {
          emailRedirectTo: redirectUrl,
        },
      });

      if (signInError) {
        setError("Impossible d'envoyer le lien de connexion. Réessayez dans un instant.");
      } else {
        setSubmitted(true);
      }
    } catch {
      setError("Une erreur réseau est survenue. Veuillez vérifier votre connexion.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-[var(--bg-app)] relative font-sans text-[var(--text-main)] transition-colors duration-200">
      {/* Filet décoratif Baobab en haut */}
      <div className="fixed top-0 left-0 right-0 flex h-[3px]" aria-hidden="true">
        <div className="flex-1 bg-[var(--brand-green)] dark:bg-[var(--brand-sand)]" />
      </div>

      {/* Motif décoratif boussole stellaire Baobab en arrière-plan */}
      <div
        className="pointer-events-none absolute bottom-10 right-10 w-96 h-96 opacity-[0.035] select-none"
        aria-hidden="true"
      >
        <svg viewBox="0 0 200 200" fill="none" className="w-full h-full">
          <circle cx="100" cy="100" r="60" stroke="currentColor" strokeWidth="3" strokeDasharray="16 10" className="text-[var(--brand-green)] dark:text-[var(--brand-sand)]" />
          <path d="M100 20 L112 88 L180 100 L112 112 L100 180 L88 112 L20 100 L88 88 Z" fill="currentColor" className="text-[var(--brand-green)] dark:text-[var(--brand-sand)]" />
        </svg>
      </div>

      <div className="w-full max-w-md bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] shadow-[var(--bot-card-shadow)] overflow-hidden z-10 animate-fadeIn">
        {/* En-tête avec Nouveau Logo Baobab */}
        <div className="flex flex-col items-center text-center px-8 pt-9 pb-6">
          <div className="mb-4">
            <BrandLogo size={60} />
          </div>

          <h1 className="font-serif text-2xl font-bold tracking-widest uppercase">
            <span className="text-[var(--text-main)]">JAN</span>
            <span className="text-[var(--brand-green)] dark:text-[var(--brand-sand)]">GORA</span>
          </h1>

          <p className="text-[12px] text-[var(--text-muted)] font-medium mt-1">
            L&apos;orientation vers le savoir • Accès Élève
          </p>

          <div className="flex mt-3.5 gap-1.5" aria-hidden="true">
            <div className="h-0.5 w-10 rounded-full bg-[var(--brand-green)] dark:bg-[var(--brand-sand)]" />
            <div className="h-0.5 w-4 rounded-full bg-[var(--border-main)]" />
          </div>
        </div>

        <div className="px-8 pb-8">
          {submitted ? (
            <div
              className="p-6 bg-[var(--gold-light)] border border-[var(--gold-border)] rounded-xl text-center space-y-3.5"
              role="status"
              aria-live="polite"
            >
              <CheckCircle2 className="w-10 h-10 text-[var(--gold-primary)] mx-auto" />
              <h2 className="font-serif text-lg font-bold text-[var(--text-main)]">
                Lien de connexion envoyé !
              </h2>
              <p className="text-[13px] text-[var(--text-muted)] leading-relaxed">
                Un lien d&apos;authentification sécurisé a été transmis à{" "}
                <strong className="text-[var(--gold-primary)]">{email}</strong>.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSubmitted(false);
                  setEmail("");
                }}
                className="text-xs text-[var(--gold-primary)] hover:underline font-semibold transition-colors"
              >
                Utiliser une autre adresse
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div>
                <label
                  htmlFor="email-input"
                  className="block text-xs font-bold uppercase tracking-wider text-[var(--text-main)] mb-2"
                >
                  Adresse email
                </label>
                <input
                  id="email-input"
                  name="email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="prenom.nom@exemple.sn"
                  required
                  aria-required="true"
                  aria-invalid={error ? "true" : "false"}
                  aria-describedby={error ? "email-error" : undefined}
                  disabled={loading}
                  className={`w-full px-4 py-2.5 rounded-xl border text-[14px] font-medium bg-[var(--bg-input)] text-[var(--text-main)] placeholder:text-[var(--text-dim)] focus:outline-none transition-all ${
                    error
                      ? "border-red-400 focus:border-red-500 ring-2 ring-red-400/20"
                      : "border-[var(--border-main)] focus:border-[var(--gold-primary)] focus:ring-2 focus:ring-[var(--gold-primary)]/20"
                  }`}
                />
                {error && (
                  <div
                    id="email-error"
                    className="flex items-center gap-1.5 mt-2 text-xs text-red-500 font-medium"
                    role="alert"
                  >
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={loading || !email.trim()}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[var(--btn-primary-bg)] hover:brightness-110 text-[var(--btn-primary-text)] text-[14px] font-bold transition-all shadow-md disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
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

              <div className="text-center pt-2">
                <Link
                  href="/chat"
                  className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--gold-primary)] underline underline-offset-2 transition-colors font-medium"
                >
                  <ArrowLeft className="w-3 h-3" />
                  <span>Continuer sans compte (accès invité)</span>
                </Link>
              </div>
            </form>
          )}
        </div>

        {/* Pied de carte institutionnel */}
        <div className="px-8 py-3.5 bg-[var(--bg-sidebar)] border-t border-[var(--border-main)] text-center">
          <p className="text-[11px] text-[var(--text-muted)] font-medium">
            🔒 Authentification sans mot de passe. Données scolaires protégées.
          </p>
        </div>
      </div>
    </main>
  );
}
