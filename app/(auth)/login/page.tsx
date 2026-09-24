// Page de connexion via Magic Link (sans mot de passe) — protégée pour les mineurs.
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

    // Validation Zod de l'email
    const validation = authEmailSchema.safeParse({ email });
    if (!validation.success) {
      setError(validation.error.issues[0]?.message || "Email invalide");
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();
      const redirectUrl = `${window.location.origin}/auth/callback`;

      const { error: authError } = await supabase.auth.signInWithOtp({
        email: validation.data.email,
        options: {
          emailRedirectTo: redirectUrl,
        },
      });

      if (authError) {
        // En mode démo local, si Supabase n'est pas encore démarré, on informe gentiment
        if (authError.message.includes("fetch failed") || authError.status === 500) {
          setError("Impossible de contacter le serveur d'authentification. Vérifiez votre configuration Supabase.");
        } else {
          setError(authError.message || "Une erreur est survenue lors de l'envoi du lien de connexion.");
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
    <main className="min-h-screen flex items-center justify-center p-4 bg-[#F5F7FA]">
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
        {/* Logo SenOrientation */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="mb-4 p-2 bg-white rounded-2xl shadow-xs border border-slate-100">
            <Image
              src="/logo.png"
              alt="Logo SenOrientation"
              width={76}
              height={76}
              priority
              className="object-contain drop-shadow-sm"
            />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0B3B82]">
            SenOrientation
          </h1>
          <p className="text-sm text-[#172033]/70 mt-1">
            Votre agent d&apos;orientation scolaire et universitaire au Sénégal
          </p>
        </div>

        {submitted ? (
          <div
            className="p-6 bg-[#18A999]/10 border border-[#18A999]/30 rounded-xl text-center space-y-3"
            role="status"
            aria-live="polite"
          >
            <CheckCircle2 className="w-9 h-9 text-[#18A999] mx-auto" />
            <h2 className="text-base font-semibold text-[#0B3B82]">Lien magique envoyé !</h2>
            <p className="text-sm text-[#172033]/80">
              Un lien de connexion sécurisé a été envoyé à{" "}
              <strong className="font-semibold text-[#0B3B82]">{email}</strong>. Cliquez dessus pour accéder directement à l&apos;application sans mot de passe.
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  setSubmitted(false);
                  setEmail("");
                }}
                className="text-xs text-[#1677E8] font-medium underline hover:text-[#0B3B82] transition-colors"
              >
                Utiliser une autre adresse email
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div>
              <label
                htmlFor="email-input"
                className="block text-sm font-medium text-[#172033] mb-1.5"
              >
                Votre adresse email
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
                className={`w-full px-4 py-2.5 rounded-lg border text-sm text-[#172033] bg-[#F5F7FA] placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 transition-all ${
                  error
                    ? "border-red-300 focus:border-red-500 focus:ring-red-200"
                    : "border-slate-200 focus:border-[#1677E8] focus:ring-[#1677E8]/20"
                }`}
                disabled={loading}
              />
              {error && (
                <div
                  id="email-error"
                  className="flex items-center gap-1.5 mt-2 text-xs text-red-600"
                  role="alert"
                >
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-[#1677E8] hover:bg-[#1263c7] text-white text-sm font-medium transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#1677E8] focus:ring-offset-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  <span>Envoi du lien sécurisé...</span>
                </>
              ) : (
                <>
                  <span>Recevoir mon lien de connexion</span>
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </>
              )}
            </button>

            <div className="pt-2 text-center">
              <Link
                href="/chat"
                className="text-xs text-[#1677E8] hover:text-[#0B3B82] underline transition-colors"
              >
                Continuer sans compte (Accès invité au chat)
              </Link>
            </div>
          </form>
        )}

        {/* Note de confidentialité / protection des mineurs */}
        <div className="mt-8 pt-6 border-t border-slate-100 text-center">
          <p className="text-xs text-[#172033]/60">
            🔒 Vos données sont protégées. Aucun mot de passe n&apos;est stocké. Seules les informations strictement nécessaires à votre orientation sont recueillies.
          </p>
        </div>
      </div>
    </main>
  );
}
