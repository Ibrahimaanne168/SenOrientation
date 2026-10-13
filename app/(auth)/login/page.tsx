// Page de connexion via Magic Link — Refonte Académique & Institutionnelle SenOrientation
"use client";

import { useState } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { authEmailSchema } from "@/lib/validation/schemas";
import { ArrowRight, CheckCircle2, AlertCircle, Loader2, ArrowLeft } from "lucide-react";
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
    <main className="min-h-screen flex items-center justify-center p-4 bg-white relative font-sans text-[#172B46]">
      {/* Filet institutionnel subtil en haut */}
      <div className="fixed top-0 left-0 right-0 flex h-[3px]" aria-hidden="true">
        <div className="flex-1 bg-[#0B2859]" />
        <div className="flex-1 bg-[#10469B]" />
        <div className="flex-1 bg-[#75421F]" />
      </div>

      {/* Motif décoratif boussole en arrière-plan */}
      <div
        className="pointer-events-none absolute bottom-10 right-10 w-96 h-96 opacity-[0.04] select-none"
        aria-hidden="true"
      >
        <svg viewBox="0 0 200 200" fill="none" className="w-full h-full">
          <circle cx="100" cy="100" r="95" stroke="#0B2859" strokeWidth="1.5" strokeDasharray="4 4" />
          <circle cx="100" cy="100" r="80" stroke="#75421F" strokeWidth="1.2" />
          <path d="M100 15 L108 85 L185 100 L108 115 L100 185 L92 115 L15 100 L92 85 Z" stroke="#0B2859" strokeWidth="1.5" fill="none" />
        </svg>
      </div>

      <div className="w-full max-w-md bg-white rounded-2xl border border-[#E0E7F0] shadow-[0_4px_24px_rgba(11,40,89,0.06)] overflow-hidden z-10 animate-fadeIn">
        {/* En-tête avec Logo SenOrientation officiel */}
        <div className="flex flex-col items-center text-center px-8 pt-9 pb-6">
          <div className="mb-4 relative w-16 h-16 rounded-2xl bg-[#EDF4FD] border border-[#D3E3F8] flex items-center justify-center p-2.5 shadow-2xs">
            <Image
              src="/SenOrientation.png"
              alt="Logo SenOrientation"
              width={52}
              height={52}
              priority
              className="object-contain"
            />
          </div>

          <h1 className="font-serif text-2xl font-bold tracking-tight">
            <span className="text-[#0B2859]">Sen</span>
            <span className="text-[#75421F]">Orientation</span>
          </h1>

          <p className="text-[12px] text-[#64748B] font-medium mt-1">
            Ton avenir, notre boussole • Accès Élève
          </p>

          <div className="flex mt-3.5 gap-1.5" aria-hidden="true">
            <div className="h-0.5 w-8 rounded-full bg-[#0B2859]" />
            <div className="h-0.5 w-5 rounded-full bg-[#10469B]" />
            <div className="h-0.5 w-3 rounded-full bg-[#75421F]" />
          </div>
        </div>

        <div className="px-8 pb-8">
          {submitted ? (
            <div
              className="p-6 bg-[#EDF4FD] border border-[#BFD7F8] rounded-xl text-center space-y-3.5"
              role="status"
              aria-live="polite"
            >
              <CheckCircle2 className="w-10 h-10 text-[#10469B] mx-auto" />
              <h2 className="font-serif text-lg font-bold text-[#0B2859]">
                Lien de connexion envoyé !
              </h2>
              <p className="text-[13px] text-[#64748B] leading-relaxed">
                Un lien d&apos;authentification sécurisé a été transmis à{" "}
                <strong className="text-[#0B2859]">{email}</strong>.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSubmitted(false);
                  setEmail("");
                }}
                className="text-xs text-[#10469B] hover:text-[#0B2859] underline font-medium transition-colors"
              >
                Utiliser une autre adresse
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div>
                <label
                  htmlFor="email-input"
                  className="block text-xs font-semibold uppercase tracking-wider text-[#0B2859] mb-2"
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
                  className={`w-full px-4 py-2.5 rounded-xl border text-[14px] bg-white text-[#172B46] placeholder:text-[#94A3B8] focus:outline-none transition-all ${
                    error
                      ? "border-red-400 focus:border-red-500 ring-2 ring-red-100"
                      : "border-[#E0E7F0] focus:border-[#10469B] focus:ring-2 focus:ring-[#10469B]/10"
                  }`}
                />
                {error && (
                  <div
                    id="email-error"
                    className="flex items-center gap-1.5 mt-2 text-xs text-red-600 font-medium"
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
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#10469B] hover:bg-[#0B2859] text-white text-[14px] font-medium transition-all shadow-[0_2px_8px_rgba(16,70,155,0.2)] hover:shadow-[0_4px_12px_rgba(16,70,155,0.3)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
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
                  className="inline-flex items-center gap-1.5 text-xs text-[#64748B] hover:text-[#10469B] underline underline-offset-2 transition-colors font-medium"
                >
                  <ArrowLeft className="w-3 h-3" />
                  <span>Continuer sans compte (accès invité)</span>
                </Link>
              </div>
            </form>
          )}
        </div>

        {/* Pied de carte institutionnel */}
        <div className="px-8 py-3.5 bg-[#EDF4FD]/50 border-t border-[#E0E7F0] text-center">
          <p className="text-[11px] text-[#64748B]">
            🔒 Authentification sans mot de passe. Données scolaires protégées.
          </p>
        </div>
      </div>
    </main>
  );
}
