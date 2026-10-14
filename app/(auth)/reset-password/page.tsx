"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Lock, Loader2, CheckCircle2, AlertCircle, ArrowLeft, Eye, EyeOff } from "lucide-react";
import BrandLogo from "@/components/BrandLogo";

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!token) {
      setError("Jeton de réinitialisation manquant. Veuillez cliquer sur le lien reçu par e-mail.");
      return;
    }

    if (password.length < 8) {
      setError("Le nouveau mot de passe doit comporter au moins 8 caractères.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: password, confirmPassword }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Impossible de réinitialiser le mot de passe.");
      } else {
        setSuccess(true);
        setTimeout(() => {
          router.push("/login");
        }, 2500);
      }
    } catch {
      setError("Erreur réseau. Veuillez vérifier votre connexion.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] shadow-[var(--bot-card-shadow)] overflow-hidden z-10 animate-fadeIn my-4">
      <div className="flex flex-col items-center text-center px-6 pt-7 pb-4">
        <div className="mb-3">
          <BrandLogo size={52} />
        </div>

        <h1 className="font-serif text-2xl font-bold tracking-widest uppercase leading-tight">
          <span className="text-[var(--text-main)]">JAN</span>
          <span className="text-[var(--brand-green)] dark:text-[var(--brand-sand)]">GORA</span>
        </h1>

        <p className="text-[12px] text-[var(--text-muted)] font-medium mt-0.5">
          Nouveau mot de passe sécurisé
        </p>
      </div>

      <div className="px-6 pb-6">
        {error && (
          <div
            className="mb-4 p-3.5 bg-red-500/10 border border-red-500/30 rounded-xl text-red-600 dark:text-red-400 text-[13px] flex items-start gap-2.5 animate-fadeIn"
            role="alert"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {success ? (
          <div className="p-5 bg-[var(--gold-light)] border border-[var(--gold-border)] rounded-xl text-center space-y-3 animate-fadeIn">
            <CheckCircle2 className="w-10 h-10 text-[var(--gold-primary)] mx-auto" />
            <h2 className="font-serif text-lg font-bold text-[var(--text-main)]">
              Mot de passe mis à jour !
            </h2>
            <p className="text-[13px] text-[var(--text-muted)] leading-relaxed">
              Votre mot de passe a été modifié avec succès. Vous allez être redirigé vers la page de connexion.
            </p>
            <Link
              href="/login"
              className="inline-block text-xs text-[var(--gold-primary)] font-bold underline"
            >
              Se connecter maintenant
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-main)] mb-1.5">
                Nouveau mot de passe (8 caractères min)
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[var(--text-dim)] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  disabled={loading}
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl border text-[14px] bg-[var(--bg-input)] text-[var(--text-main)] border-[var(--border-main)] focus:outline-none focus:border-[var(--brand-green)] dark:focus:border-[var(--brand-sand)] transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)] hover:text-[var(--text-main)]"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-main)] mb-1.5">
                Confirmer le nouveau mot de passe
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[var(--text-dim)] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  disabled={loading}
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border text-[14px] bg-[var(--bg-input)] text-[var(--text-main)] border-[var(--border-main)] focus:outline-none focus:border-[var(--brand-green)] dark:focus:border-[var(--brand-sand)] transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 flex items-center justify-center gap-2 bg-[#155E59] hover:brightness-105 active:scale-[0.99] dark:bg-[#E9D5A1] dark:text-[#0D2928] text-white font-bold text-[14px] rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Enregistrer le mot de passe"}
            </button>
          </form>
        )}

        <div className="mt-5 pt-3 border-t border-[var(--border-main)] text-center">
          <Link
            href="/login"
            className="inline-flex items-center gap-1 text-[12.5px] text-[var(--text-muted)] hover:text-[var(--brand-green)] dark:hover:text-[var(--brand-sand)]"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Retour à la connexion</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-3 sm:p-6 bg-[var(--bg-app)] relative font-sans text-[var(--text-main)]">
      <Suspense fallback={<div className="text-center p-8">Chargement...</div>}>
        <ResetPasswordContent />
      </Suspense>
    </main>
  );
}
