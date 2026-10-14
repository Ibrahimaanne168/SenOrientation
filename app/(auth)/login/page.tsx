"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Mail,
  Lock,
  User,
  ShieldCheck,
  RefreshCw,
  KeyRound,
  Eye,
  EyeOff,
} from "lucide-react";
import BrandLogo from "@/components/BrandLogo";

type AuthMode = "login" | "register" | "forgot_password";
type RegisterStep = 1 | 2 | 3;

export default function LoginPage() {
  const router = useRouter();

  const [mode, setMode] = useState<AuthMode>("login");
  const [registerStep, setRegisterStep] = useState<RegisterStep>(1);

  // Formulaire Connexion
  const [loginIdentifier, setLoginIdentifier] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginRememberMe, setLoginRememberMe] = useState(false);

  // Formulaire Inscription Étape 1
  const [fullName, setFullName] = useState("");
  const [regEmail, setRegEmail] = useState("");

  // Formulaire Inscription Étape 2 (OTP)
  const [otpCode, setOtpCode] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const [registrationToken, setRegistrationToken] = useState<string | null>(null);

  // Formulaire Inscription Étape 3 (Identifiants)
  const [regUsername, setRegUsername] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirmPassword, setRegConfirmPassword] = useState("");
  const [regRememberMe, setRegRememberMe] = useState(false);

  // Mot de passe oublié
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSubmitted, setForgotSubmitted] = useState(false);

  // États génériques
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Compte à rebours de renvoi du code OTP
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Réinitialiser les messages lors d'un changement d'onglet
  const switchMode = (newMode: AuthMode) => {
    setMode(newMode);
    setError(null);
    setSuccessMessage(null);
  };

  /* ──────────────────────────────────────────────────────────────────────────
     1. SOUMISSION : CONNEXION
  ────────────────────────────────────────────────────────────────────────── */
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginIdentifier.trim() || !loginPassword) {
      setError("Veuillez renseigner votre identifiant ou email et votre mot de passe.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: loginIdentifier.trim(),
          password: loginPassword,
          rememberMe: loginRememberMe,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Identifiant ou mot de passe incorrect.");
      } else {
        // Redirection vers le chat ou profil
        router.push("/chat");
      }
    } catch {
      setError("Erreur réseau. Veuillez vérifier votre connexion.");
    } finally {
      setLoading(false);
    }
  };

  /* ──────────────────────────────────────────────────────────────────────────
     2. SOUMISSION : INSCRIPTION ÉTAPE 1 (Identité)
  ────────────────────────────────────────────────────────────────────────── */
  const handleRegisterStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = fullName.trim();
    const cleanEmail = regEmail.trim().toLowerCase();

    if (!cleanName || cleanName.length < 2) {
      setError("Veuillez saisir votre nom complet.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      setError("Adresse e-mail invalide. Exemple : prenom.nom@ucad.edu.sn");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/register-step1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: cleanName, email: cleanEmail }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Impossible d'initier l'inscription.");
      } else {
        setRegisterStep(2);
        setResendCooldown(45);
        setSuccessMessage(data.message || `Code de vérification envoyé à ${cleanEmail}`);
      }
    } catch {
      setError("Erreur réseau. Veuillez vérifier votre connexion.");
    } finally {
      setLoading(false);
    }
  };

  /* ──────────────────────────────────────────────────────────────────────────
     3. SOUMISSION : INSCRIPTION ÉTAPE 2 (Code OTP)
  ────────────────────────────────────────────────────────────────────────── */
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = otpCode.trim();

    if (!cleanCode || cleanCode.length !== 6) {
      setError("Veuillez saisir le code à 6 chiffres reçu par email.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: regEmail.trim().toLowerCase(),
          code: cleanCode,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Code invalide ou expiré.");
      } else {
        setRegistrationToken(data.registrationToken);
        setRegisterStep(3);
        setSuccessMessage("Adresse email vérifiée avec succès ! Créez vos identifiants.");
      }
    } catch {
      setError("Erreur réseau. Veuillez vérifier votre connexion.");
    } finally {
      setLoading(false);
    }
  };

  /* ──────────────────────────────────────────────────────────────────────────
     3b. RENVOI DU CODE OTP
  ────────────────────────────────────────────────────────────────────────── */
  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/resend-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: regEmail.trim().toLowerCase() }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Impossible de renvoyer le code.");
      } else {
        setResendCooldown(45);
        setSuccessMessage("Un nouveau code a été envoyé à votre adresse.");
      }
    } catch {
      setError("Erreur réseau. Réessayez dans un instant.");
    } finally {
      setLoading(false);
    }
  };

  /* ──────────────────────────────────────────────────────────────────────────
     4. SOUMISSION : INSCRIPTION ÉTAPE 3 (Identifiants & mot de passe)
  ────────────────────────────────────────────────────────────────────────── */
  const handleCreateCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registrationToken) {
      setError("Session expirée. Veuillez recommencer l'inscription.");
      setRegisterStep(1);
      return;
    }

    const cleanUsername = regUsername.trim().toLowerCase();
    if (!cleanUsername || cleanUsername.length < 3) {
      setError("L'identifiant doit comporter au moins 3 caractères.");
      return;
    }

    if (regPassword.length < 8) {
      setError("Le mot de passe doit comporter au moins 8 caractères.");
      return;
    }

    if (regPassword !== regConfirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/create-credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registrationToken,
          username: cleanUsername,
          password: regPassword,
          confirmPassword: regConfirmPassword,
          rememberMe: regRememberMe,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Impossible de créer le compte.");
      } else {
        // Redirection vers profil pour proposition de complétion facultative
        router.push("/profile");
      }
    } catch {
      setError("Erreur réseau lors de la création du compte.");
    } finally {
      setLoading(false);
    }
  };

  /* ──────────────────────────────────────────────────────────────────────────
     5. SOUMISSION : MOT DE PASSE OUBLIÉ
  ────────────────────────────────────────────────────────────────────────── */
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = forgotEmail.trim().toLowerCase();

    if (!cleanEmail) {
      setError("Veuillez saisir votre adresse email.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanEmail }),
      });

      const data = await res.json();
      setForgotSubmitted(true);
      setSuccessMessage(data.message);
    } catch {
      setError("Erreur réseau lors de la demande.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-3 sm:p-6 bg-[var(--bg-app)] relative font-sans text-[var(--text-main)] transition-colors duration-200">
      {/* Filet décoratif Baobab en haut */}
      <div className="fixed top-0 left-0 right-0 flex h-[3px]" aria-hidden="true">
        <div className="flex-1 bg-[var(--brand-green)] dark:bg-[var(--brand-sand)]" />
      </div>

      {/* Motif décoratif en filigrane */}
      <div
        className="pointer-events-none absolute bottom-10 right-10 w-96 h-96 opacity-[0.035] select-none"
        aria-hidden="true"
      >
        <img src="/icon.png" alt="" className="w-full h-full object-contain" />
      </div>

      <div className="w-full max-w-md bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] shadow-[var(--bot-card-shadow)] overflow-hidden z-10 animate-fadeIn my-4">
        {/* En-tête officiel JANGORA */}
        <div className="flex flex-col items-center text-center px-6 pt-7 pb-4">
          <div className="mb-3">
            <BrandLogo size={52} />
          </div>

          <h1 className="font-serif text-2xl font-bold tracking-widest uppercase leading-tight">
            <span className="text-[var(--text-main)]">JAN</span>
            <span className="text-[var(--brand-green)] dark:text-[var(--brand-sand)]">GORA</span>
          </h1>

          <p className="text-[12px] text-[var(--text-muted)] font-medium mt-0.5">
            L&apos;orientation vers le savoir · Espace Étudiant
          </p>

          {/* Onglets Connexion / Inscription */}
          {mode !== "forgot_password" && (
            <div className="flex items-center w-full mt-5 p-1 bg-[var(--bg-hover)] rounded-xl border border-[var(--border-main)] text-[13px] font-bold">
              <button
                type="button"
                onClick={() => switchMode("login")}
                className={`flex-1 py-2 rounded-lg transition-all cursor-pointer ${
                  mode === "login"
                    ? "bg-[var(--bg-card)] text-[var(--brand-green)] dark:text-[var(--brand-sand)] shadow-xs"
                    : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
                }`}
              >
                Connexion
              </button>
              <button
                type="button"
                onClick={() => {
                  switchMode("register");
                  setRegisterStep(1);
                }}
                className={`flex-1 py-2 rounded-lg transition-all cursor-pointer ${
                  mode === "register"
                    ? "bg-[var(--bg-card)] text-[var(--brand-green)] dark:text-[var(--brand-sand)] shadow-xs"
                    : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
                }`}
              >
                Inscription (3 étapes)
              </button>
            </div>
          )}
        </div>

        <div className="px-6 pb-6">
          {/* Messages d'erreur */}
          {error && (
            <div
              className="mb-4 p-3.5 bg-red-500/10 border border-red-500/30 rounded-xl text-red-600 dark:text-red-400 text-[13px] flex items-start gap-2.5 animate-fadeIn"
              role="alert"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Messages de succès */}
          {successMessage && (
            <div
              className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-700 dark:text-emerald-300 text-[12.5px] flex items-start gap-2 animate-fadeIn"
              role="status"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              MODE 1 : FORMULAIRE DE CONNEXION
          ═══════════════════════════════════════════════════════════════ */}
          {mode === "login" && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-main)] mb-1.5">
                  Identifiant ou Email
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-[var(--text-dim)] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={loginIdentifier}
                    onChange={(e) => setLoginIdentifier(e.target.value)}
                    placeholder="prenom.nom ou email@ucad.sn"
                    required
                    disabled={loading}
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border text-[14px] bg-[var(--bg-input)] text-[var(--text-main)] border-[var(--border-main)] focus:outline-none focus:border-[var(--brand-green)] dark:focus:border-[var(--brand-sand)] transition-all"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-main)]">
                    Mot de passe
                  </label>
                  <button
                    type="button"
                    onClick={() => switchMode("forgot_password")}
                    className="text-xs text-[var(--brand-green)] dark:text-[var(--brand-sand)] hover:underline font-semibold"
                  >
                    Mot de passe oublié ?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[var(--text-dim)] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
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

              {/* Case Se souvenir de moi */}
              <label className="flex items-center gap-2 text-[13px] text-[var(--text-muted)] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={loginRememberMe}
                  onChange={(e) => setLoginRememberMe(e.target.checked)}
                  className="rounded border-[var(--border-main)] text-[var(--brand-green)] focus:ring-[var(--brand-green)]"
                />
                <span>Se souvenir de moi (session prolongée 30 jours)</span>
              </label>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 flex items-center justify-center gap-2 bg-[#155E59] hover:brightness-105 active:scale-[0.99] dark:bg-[#E9D5A1] dark:text-[#0D2928] text-white font-bold text-[14px] rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Se connecter"}
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    switchMode("register");
                    setRegisterStep(1);
                  }}
                  className="text-[13px] text-[var(--text-muted)] hover:text-[var(--brand-green)] dark:hover:text-[var(--brand-sand)] transition-colors"
                >
                  Pas encore de compte ?{" "}
                  <strong className="underline underline-offset-2">Créer un compte</strong>
                </button>
              </div>
            </form>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              MODE 2 : INSCRIPTION EN TROIS ÉTAPES
          ═══════════════════════════════════════════════════════════════ */}
          {mode === "register" && (
            <div>
              {/* Indicateur de progression des 3 étapes */}
              <div className="flex items-center justify-between mb-5 px-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
                      registerStep >= 1
                        ? "bg-[var(--brand-green)] text-white dark:bg-[var(--brand-sand)] dark:text-[#0D2928]"
                        : "bg-[var(--bg-hover)] text-[var(--text-muted)]"
                    }`}
                  >
                    1
                  </span>
                  <span className="text-[12px] font-bold text-[var(--text-main)]">Identité</span>
                </div>
                <div className="h-0.5 flex-1 mx-2 bg-[var(--border-main)]" />
                <div className="flex items-center gap-2">
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
                      registerStep >= 2
                        ? "bg-[var(--brand-green)] text-white dark:bg-[var(--brand-sand)] dark:text-[#0D2928]"
                        : "bg-[var(--bg-hover)] text-[var(--text-muted)]"
                    }`}
                  >
                    2
                  </span>
                  <span className="text-[12px] font-bold text-[var(--text-main)]">Vérification</span>
                </div>
                <div className="h-0.5 flex-1 mx-2 bg-[var(--border-main)]" />
                <div className="flex items-center gap-2">
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
                      registerStep === 3
                        ? "bg-[var(--brand-green)] text-white dark:bg-[var(--brand-sand)] dark:text-[#0D2928]"
                        : "bg-[var(--bg-hover)] text-[var(--text-muted)]"
                    }`}
                  >
                    3
                  </span>
                  <span className="text-[12px] font-bold text-[var(--text-main)]">Identifiants</span>
                </div>
              </div>

              {/* Étape 1 : Identité (Nom complet & Email) */}
              {registerStep === 1 && (
                <form onSubmit={handleRegisterStep1} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-main)] mb-1.5">
                      Nom complet
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-[var(--text-dim)] absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Ex : Moussa Diop"
                        required
                        disabled={loading}
                        className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border text-[14px] bg-[var(--bg-input)] text-[var(--text-main)] border-[var(--border-main)] focus:outline-none focus:border-[var(--brand-green)] dark:focus:border-[var(--brand-sand)] transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-main)] mb-1.5">
                      Adresse email
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-[var(--text-dim)] absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        placeholder="moussa.diop@exemple.sn"
                        required
                        disabled={loading}
                        className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border text-[14px] bg-[var(--bg-input)] text-[var(--text-main)] border-[var(--border-main)] focus:outline-none focus:border-[var(--brand-green)] dark:focus:border-[var(--brand-sand)] transition-all"
                      />
                    </div>
                    <p className="text-[11px] text-[var(--text-muted)] mt-1">
                      Un code temporaire à 6 chiffres vous sera envoyé via Resend.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full h-11 flex items-center justify-center gap-2 bg-[#155E59] hover:brightness-105 active:scale-[0.99] dark:bg-[#E9D5A1] dark:text-[#0D2928] text-white font-bold text-[14px] rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <span>Continuer vers la vérification</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* Étape 2 : Vérification par code e-mail */}
              {registerStep === 2 && (
                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  <div className="p-3 bg-[var(--gold-light)] border border-[var(--gold-border)] rounded-xl text-[12.5px] text-[var(--text-muted)] space-y-1">
                    <p>
                      Code envoyé à : <strong className="text-[var(--gold-primary)]">{regEmail}</strong>
                    </p>
                    <button
                      type="button"
                      onClick={() => setRegisterStep(1)}
                      className="text-[11.5px] text-[var(--gold-primary)] underline hover:opacity-80"
                    >
                      Corriger l&apos;adresse email
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-main)] mb-1.5">
                      Code de vérification (6 chiffres)
                    </label>
                    <div className="relative">
                      <ShieldCheck className="w-4 h-4 text-[var(--text-dim)] absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        maxLength={6}
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                        placeholder="123456"
                        required
                        disabled={loading}
                        autoFocus
                        className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border text-[18px] tracking-[6px] font-mono text-center bg-[var(--bg-input)] text-[var(--text-main)] border-[var(--border-main)] focus:outline-none focus:border-[var(--brand-green)] dark:focus:border-[var(--brand-sand)] transition-all"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[12px]">
                    <button
                      type="button"
                      onClick={handleResendOtp}
                      disabled={resendCooldown > 0 || loading}
                      className="text-[var(--brand-green)] dark:text-[var(--brand-sand)] hover:underline font-semibold disabled:opacity-50 disabled:no-underline flex items-center gap-1"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>
                        {resendCooldown > 0 ? `Renvoyer (${resendCooldown}s)` : "Renvoyer le code"}
                      </span>
                    </button>
                    <span className="text-[var(--text-muted)]">Validité : 10 minutes</span>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || otpCode.length !== 6}
                    className="w-full h-11 flex items-center justify-center gap-2 bg-[#155E59] hover:brightness-105 active:scale-[0.99] dark:bg-[#E9D5A1] dark:text-[#0D2928] text-white font-bold text-[14px] rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Vérifier le code"}
                  </button>
                </form>
              )}

              {/* Étape 3 : Création des identifiants */}
              {registerStep === 3 && (
                <form onSubmit={handleCreateCredentials} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-main)] mb-1.5">
                      Identifiant de connexion
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-[var(--text-dim)] absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={regUsername}
                        onChange={(e) => setRegUsername(e.target.value)}
                        placeholder="ex: moussa221"
                        required
                        disabled={loading}
                        className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border text-[14px] bg-[var(--bg-input)] text-[var(--text-main)] border-[var(--border-main)] focus:outline-none focus:border-[var(--brand-green)] dark:focus:border-[var(--brand-sand)] transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-main)] mb-1.5">
                      Mot de passe (8 caractères min)
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-[var(--text-dim)] absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type={showPassword ? "text" : "password"}
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
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
                      Confirmer le mot de passe
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-[var(--text-dim)] absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type={showPassword ? "text" : "password"}
                        value={regConfirmPassword}
                        onChange={(e) => setRegConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        disabled={loading}
                        className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border text-[14px] bg-[var(--bg-input)] text-[var(--text-main)] border-[var(--border-main)] focus:outline-none focus:border-[var(--brand-green)] dark:focus:border-[var(--brand-sand)] transition-all"
                      />
                    </div>
                  </div>

                  {/* Case Se souvenir de moi */}
                  <label className="flex items-center gap-2 text-[13px] text-[var(--text-muted)] cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={regRememberMe}
                      onChange={(e) => setRegRememberMe(e.target.checked)}
                      className="rounded border-[var(--border-main)] text-[var(--brand-green)] focus:ring-[var(--brand-green)]"
                    />
                    <span>Rester connecté sur cet appareil</span>
                  </label>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full h-11 flex items-center justify-center gap-2 bg-[#155E59] hover:brightness-105 active:scale-[0.99] dark:bg-[#E9D5A1] dark:text-[#0D2928] text-white font-bold text-[14px] rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Créer mon compte et démarrer"}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              MODE 3 : MOT DE PASSE OUBLIÉ
          ═══════════════════════════════════════════════════════════════ */}
          {mode === "forgot_password" && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <button
                  type="button"
                  onClick={() => switchMode("login")}
                  className="p-1 text-[var(--text-muted)] hover:text-[var(--text-main)] rounded-lg hover:bg-[var(--bg-hover)]"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <h2 className="font-bold text-[15px] text-[var(--text-main)]">
                  Récupération de mot de passe
                </h2>
              </div>

              {forgotSubmitted ? (
                <div className="p-5 bg-[var(--gold-light)] border border-[var(--gold-border)] rounded-xl text-center space-y-3 animate-fadeIn">
                  <CheckCircle2 className="w-8 h-8 text-[var(--gold-primary)] mx-auto" />
                  <p className="text-[13px] text-[var(--text-muted)] leading-relaxed">
                    Si un compte est associé à cette adresse, un lien à usage unique a été envoyé via Resend pour réinitialiser votre mot de passe en toute sécurité.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setForgotSubmitted(false);
                      switchMode("login");
                    }}
                    className="text-xs text-[var(--gold-primary)] underline font-bold"
                  >
                    Retour à la page de connexion
                  </button>
                </div>
              ) : (
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <p className="text-[13px] text-[var(--text-muted)] leading-relaxed">
                    Saisissez votre adresse e-mail. Nous vous enverrons un lien sécurisé valide pendant 30 minutes.
                  </p>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-main)] mb-1.5">
                      Adresse email
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-[var(--text-dim)] absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        placeholder="prenom.nom@exemple.sn"
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
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Envoyer le lien de réinitialisation"}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* Lien retour au chat */}
          <div className="mt-6 pt-4 border-t border-[var(--border-main)] flex items-center justify-between text-[12.5px] text-[var(--text-muted)]">
            <Link
              href="/chat"
              className="flex items-center gap-1.5 hover:text-[var(--brand-green)] dark:hover:text-[var(--brand-sand)] transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Accéder directement au chat</span>
            </Link>
            <span>v2.2 · Sécurisé</span>
          </div>
        </div>
      </div>
    </main>
  );
}
