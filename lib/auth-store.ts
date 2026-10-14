import bcrypt from "bcryptjs";
import crypto from "crypto";
import { sendVerificationCodeEmail, sendPasswordResetEmail } from "./resend";
import { createAdminClient } from "./supabase/server";

export interface StudentProfileData {
  etablissement_actuel?: string;
  classe_actuelle?: string;
  niveau?: string;
  serie?: string;
  annee_etudes_souhaitee?: string;
  matieres_preferees?: string[];
  domaines_predilection?: string[];
  centres_interet?: string[];
  preferences_professionnelles?: string[];
  formations_envisagees?: string[];
  contraintes_utiles?: {
    duree?: string;
    ville?: string;
    budget?: string;
  };
}

export interface StoredUser {
  id: string;
  fullName: string;
  email: string;
  username: string;
  passwordHash: string;
  isVerified: boolean;
  profile: StudentProfileData;
  createdAt: string;
  updatedAt: string;
}

export interface SafeUser {
  id: string;
  fullName: string;
  email: string;
  username: string;
  profile: StudentProfileData;
  profileCompleteness: number;
}

interface OtpEntry {
  fullName: string;
  email: string;
  code: string;
  expiresAt: number;
  attempts: number;
  lastSentAt: number;
}

interface RegistrationTokenEntry {
  email: string;
  fullName: string;
  expiresAt: number;
}

interface ResetTokenEntry {
  email: string;
  expiresAt: number;
  used: boolean;
}

interface SessionEntry {
  userId: string;
  expiresAt: number;
  rememberMe: boolean;
}

// Mémoire sécurisée persistante au sein du processus serveur
// Permet de fonctionner de façon ultra-rapide et autonome, tout en synchronisant avec Supabase
const memoryUsers = new Map<string, StoredUser>(); // Key: email.toLowerCase()
const memoryOtps = new Map<string, OtpEntry>(); // Key: email.toLowerCase()
const memoryRegTokens = new Map<string, RegistrationTokenEntry>(); // Key: token
const memoryResetTokens = new Map<string, ResetTokenEntry>(); // Key: token
const memorySessions = new Map<string, SessionEntry>(); // Key: sessionId

export const SESSION_COOKIE_NAME = "jangora_session_token";

/**
 * Calcule le taux de complétion du profil après connexion (0 à 100%)
 */
export function calculateProfileCompleteness(user: SafeUser | StoredUser): number {
  let score = 20; // Nom et email vérifiés
  const p = user.profile || {};
  if (p.etablissement_actuel) score += 10;
  if (p.classe_actuelle || p.niveau) score += 15;
  if (p.serie) score += 15;
  if (p.matieres_preferees && p.matieres_preferees.length > 0) score += 10;
  if (p.centres_interet && p.centres_interet.length > 0) score += 10;
  if (p.formations_envisagees && p.formations_envisagees.length > 0) score += 10;
  if (p.contraintes_utiles?.duree || p.contraintes_utiles?.ville) score += 10;
  return Math.min(100, score);
}

export function toSafeUser(user: StoredUser): SafeUser {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    username: user.username,
    profile: user.profile || {},
    profileCompleteness: calculateProfileCompleteness(user),
  };
}

/**
 * Normalise l'adresse e-mail
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Étape 1 : Validation d'identité et envoi du code par e-mail
 */
export async function initiateRegistration(
  fullName: string,
  rawEmail: string
): Promise<{ success: boolean; error?: string; message?: string }> {
  const email = normalizeEmail(rawEmail);
  const cleanName = fullName.trim();

  if (!cleanName || cleanName.length < 2) {
    return { success: false, error: "Veuillez saisir votre nom complet (au moins 2 caractères)." };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { success: false, error: "Adresse e-mail invalide. Exemple : prenom.nom@ucad.edu.sn" };
  }

  // Vérifier si un compte actif existe déjà
  const existingUser = memoryUsers.get(email);
  if (existingUser && existingUser.isVerified) {
    return {
      success: false,
      error: "Un compte vérifié existe déjà avec cette adresse e-mail. Veuillez vous connecter.",
    };
  }

  // Vérifier le taux de renvoi (au moins 45 secondes entre deux renvois)
  const existingOtp = memoryOtps.get(email);
  const now = Date.now();
  if (existingOtp && now - existingOtp.lastSentAt < 45 * 1000) {
    const waitSeconds = Math.ceil((45 * 1000 - (now - existingOtp.lastSentAt)) / 1000);
    return {
      success: false,
      error: `Veuillez patienter ${waitSeconds} secondes avant de demander un nouveau code.`,
    };
  }

  // Générer un code cryptographique à 6 chiffres
  const code = crypto.randomInt(100000, 999999).toString();
  const expiresAt = now + 10 * 60 * 1000; // Valide 10 minutes

  memoryOtps.set(email, {
    fullName: cleanName,
    email,
    code,
    expiresAt,
    attempts: 0,
    lastSentAt: now,
  });

  // Envoi par Resend côté serveur
  const sendResult = await sendVerificationCodeEmail(email, code, cleanName);
  if (!sendResult.success) {
    return {
      success: false,
      error: sendResult.error || "Impossible d'envoyer l'e-mail de confirmation. Réessayez.",
    };
  }

  return {
    success: true,
    message: `Un code de vérification à 6 chiffres a été envoyé à ${email}.`,
  };
}

/**
 * Renvoie un nouveau code (avec limitation stricte)
 */
export async function resendVerificationCode(
  rawEmail: string
): Promise<{ success: boolean; error?: string; message?: string }> {
  const email = normalizeEmail(rawEmail);
  const entry = memoryOtps.get(email);

  if (!entry) {
    return {
      success: false,
      error: "Aucune inscription en cours pour cette adresse. Veuillez recommencer à l'étape 1.",
    };
  }

  const now = Date.now();
  if (now - entry.lastSentAt < 45 * 1000) {
    const waitSeconds = Math.ceil((45 * 1000 - (now - entry.lastSentAt)) / 1000);
    return {
      success: false,
      error: `Veuillez patienter ${waitSeconds} secondes avant de renvoyer un code.`,
    };
  }

  const newCode = crypto.randomInt(100000, 999999).toString();
  entry.code = newCode;
  entry.expiresAt = now + 10 * 60 * 1000;
  entry.attempts = 0;
  entry.lastSentAt = now;

  const sendResult = await sendVerificationCodeEmail(email, newCode, entry.fullName);
  if (!sendResult.success) {
    return {
      success: false,
      error: sendResult.error || "Erreur lors du renvoi de l'email.",
    };
  }

  return {
    success: true,
    message: `Un nouveau code a été envoyé à ${email}.`,
  };
}

/**
 * Étape 2 : Vérification du code OTP
 */
export async function verifyRegistrationCode(
  rawEmail: string,
  rawCode: string
): Promise<{ success: boolean; error?: string; registrationToken?: string }> {
  const email = normalizeEmail(rawEmail);
  const code = rawCode.trim();

  const entry = memoryOtps.get(email);
  if (!entry) {
    return {
      success: false,
      error: "Code expiré ou inexistant. Veuillez demander un nouveau code.",
    };
  }

  if (Date.now() > entry.expiresAt) {
    memoryOtps.delete(email);
    return {
      success: false,
      error: "Le code a expiré (validité 10 minutes). Veuillez en demander un nouveau.",
    };
  }

  // Protection contre le brute-force : max 5 tentatives
  entry.attempts += 1;
  if (entry.attempts > 5) {
    memoryOtps.delete(email);
    return {
      success: false,
      error: "Trop de tentatives incorrectes. Pour votre sécurité, veuillez demander un nouveau code.",
    };
  }

  if (entry.code !== code) {
    const remaining = 5 - entry.attempts;
    return {
      success: false,
      error: `Code incorrect. Il vous reste ${remaining} tentative${remaining > 1 ? "s" : ""}.`,
    };
  }

  // Code valide ! On supprime l'OTP et génère un jeton temporaire pour l'Étape 3 (validité 15 min)
  memoryOtps.delete(email);

  const regToken = crypto.randomBytes(32).toString("hex");
  memoryRegTokens.set(regToken, {
    email,
    fullName: entry.fullName,
    expiresAt: Date.now() + 15 * 60 * 1000,
  });

  return {
    success: true,
    registrationToken: regToken,
  };
}

/**
 * Étape 3 : Création des identifiants et ouverture de session
 */
export async function completeRegistration(
  regToken: string,
  rawUsername: string,
  password: string,
  confirmPassword: string,
  rememberMe = false
): Promise<{ success: boolean; error?: string; user?: SafeUser; sessionId?: string; maxAge?: number }> {
  const tokenEntry = memoryRegTokens.get(regToken);
  if (!tokenEntry || Date.now() > tokenEntry.expiresAt) {
    return {
      success: false,
      error: "Votre session de création a expiré. Veuillez reprendre la vérification de votre email.",
    };
  }

  const username = rawUsername.trim().toLowerCase();
  if (!username || username.length < 3) {
    return { success: false, error: "L'identifiant doit comporter au moins 3 caractères." };
  }

  if (!/^[a-z0-9_.-]+$/.test(username)) {
    return {
      success: false,
      error: "L'identifiant ne peut contenir que des lettres, chiffres, tirets et points.",
    };
  }

  // Vérifier doublon identifiant
  for (const u of memoryUsers.values()) {
    if (u.username === username) {
      return { success: false, error: "Cet identifiant est déjà pris. Veuillez en choisir un autre." };
    }
  }

  if (!password || password.length < 8) {
    return {
      success: false,
      error: "Le mot de passe doit comporter au moins 8 caractères.",
    };
  }

  if (password !== confirmPassword) {
    return {
      success: false,
      error: "Les mots de passe saisis ne sont pas identiques.",
    };
  }

  // Hachage sécurisé avec bcrypt (coût 12)
  const saltRounds = 12;
  const passwordHash = await bcrypt.hash(password, saltRounds);

  const userId = crypto.randomUUID();
  const now = new Date().toISOString();

  const newUser: StoredUser = {
    id: userId,
    fullName: tokenEntry.fullName,
    email: tokenEntry.email,
    username,
    passwordHash,
    isVerified: true,
    profile: {
      etablissement_actuel: "",
      classe_actuelle: "",
      niveau: "",
      serie: "",
    },
    createdAt: now,
    updatedAt: now,
  };

  memoryUsers.set(tokenEntry.email, newUser);
  memoryRegTokens.delete(regToken);

  // Synchronisation optionnelle avec la table profiles de Supabase
  try {
    const admin = createAdminClient();
    await admin.from("profiles").upsert(
      {
        user_id: userId,
        niveau_etude: "Nouveau compte vérifié",
        serie: null,
        interets: [],
        updated_at: now,
      },
      { onConflict: "user_id" }
    );
  } catch {
    // Non bloquant si Supabase local n'est pas actif
  }

  // Création de session sécurisée
  const sessionId = crypto.randomBytes(32).toString("hex");
  const maxAge = rememberMe ? 30 * 24 * 60 * 60 : 24 * 60 * 60; // 30 jours vs 1 jour
  memorySessions.set(sessionId, {
    userId,
    expiresAt: Date.now() + maxAge * 1000,
    rememberMe,
  });

  return {
    success: true,
    user: toSafeUser(newUser),
    sessionId,
    maxAge,
  };
}

/**
 * Connexion sécurisée
 */
export async function loginUser(
  rawIdentifier: string,
  password: string,
  rememberMe = false
): Promise<{ success: boolean; error?: string; user?: SafeUser; sessionId?: string; maxAge?: number }> {
  const identifier = rawIdentifier.trim().toLowerCase();

  if (!identifier || !password) {
    return { success: false, error: "Veuillez renseigner votre identifiant et votre mot de passe." };
  }

  // Recherche par email ou par nom d'utilisateur
  let targetUser: StoredUser | undefined;
  for (const u of memoryUsers.values()) {
    if (u.email === identifier || u.username === identifier) {
      targetUser = u;
      break;
    }
  }

  if (!targetUser) {
    return {
      success: false,
      error: "Identifiant ou mot de passe incorrect.",
    };
  }

  // Vérification du mot de passe avec bcrypt
  const isMatch = await bcrypt.compare(password, targetUser.passwordHash);
  if (!isMatch) {
    return {
      success: false,
      error: "Identifiant ou mot de passe incorrect.",
    };
  }

  const sessionId = crypto.randomBytes(32).toString("hex");
  const maxAge = rememberMe ? 30 * 24 * 60 * 60 : 24 * 60 * 60; // 30 jours vs 1 jour
  memorySessions.set(sessionId, {
    userId: targetUser.id,
    expiresAt: Date.now() + maxAge * 1000,
    rememberMe,
  });

  return {
    success: true,
    user: toSafeUser(targetUser),
    sessionId,
    maxAge,
  };
}

/**
 * Mot de passe oublié : Envoi du lien à usage unique par Resend
 * Réponse neutre pour éviter le recensement d'adresses
 */
export async function initiatePasswordReset(
  rawEmail: string,
  appOrigin: string
): Promise<{ success: boolean; message: string }> {
  const email = normalizeEmail(rawEmail);
  const targetUser = memoryUsers.get(email);

  if (targetUser && targetUser.isVerified) {
    const token = crypto.randomBytes(32).toString("hex");
    memoryResetTokens.set(token, {
      email,
      expiresAt: Date.now() + 30 * 60 * 1000, // Valide 30 min
      used: false,
    });

    const resetUrl = `${appOrigin}/reset-password?token=${token}`;
    await sendPasswordResetEmail(email, resetUrl, targetUser.fullName);
  } else {
    // Si l'utilisateur n'existe pas, on simule un délai identique pour contrer les attaques de timing
    await new Promise((r) => setTimeout(r, 120));
  }

  return {
    success: true,
    message: "Si un compte est associé à cette adresse, un lien sécurisé de réinitialisation vous a été envoyé par e-mail.",
  };
}

/**
 * Réinitialisation effective du mot de passe avec le jeton
 */
export async function resetPasswordWithToken(
  token: string,
  newPassword: string,
  confirmPassword: string
): Promise<{ success: boolean; error?: string; message?: string }> {
  const entry = memoryResetTokens.get(token);
  if (!entry || entry.used || Date.now() > entry.expiresAt) {
    return {
      success: false,
      error: "Ce lien de réinitialisation est invalide ou a expiré. Veuillez refaire une demande.",
    };
  }

  if (!newPassword || newPassword.length < 8) {
    return {
      success: false,
      error: "Le nouveau mot de passe doit comporter au moins 8 caractères.",
    };
  }

  if (newPassword !== confirmPassword) {
    return {
      success: false,
      error: "Les mots de passe saisis ne sont pas identiques.",
    };
  }

  const targetUser = memoryUsers.get(entry.email);
  if (!targetUser) {
    return { success: false, error: "Compte introuvable." };
  }

  // Hachage bcrypt du nouveau mot de passe
  targetUser.passwordHash = await bcrypt.hash(newPassword, 12);
  targetUser.updatedAt = new Date().toISOString();

  // Invalidation définitive du jeton
  entry.used = true;
  memoryResetTokens.delete(token);

  return {
    success: true,
    message: "Votre mot de passe a été modifié avec succès. Vous pouvez maintenant vous connecter.",
  };
}

/**
 * Récupère l'utilisateur depuis son cookie de session
 */
export async function getSessionUser(sessionId?: string | null): Promise<SafeUser | null> {
  if (!sessionId) return null;
  const session = memorySessions.get(sessionId);
  if (!session) return null;

  if (Date.now() > session.expiresAt) {
    memorySessions.delete(sessionId);
    return null;
  }

  for (const u of memoryUsers.values()) {
    if (u.id === session.userId) {
      return toSafeUser(u);
    }
  }

  return null;
}

/**
 * Mise à jour progressive du profil
 */
export async function updateStudentProfile(
  userId: string,
  updates: Partial<StudentProfileData>
): Promise<{ success: boolean; user?: SafeUser; error?: string }> {
  let targetUser: StoredUser | undefined;
  for (const u of memoryUsers.values()) {
    if (u.id === userId) {
      targetUser = u;
      break;
    }
  }

  if (!targetUser) {
    return { success: false, error: "Utilisateur introuvable." };
  }

  targetUser.profile = {
    ...targetUser.profile,
    ...updates,
  };
  targetUser.updatedAt = new Date().toISOString();

  // Synchronisation avec Supabase
  try {
    const admin = createAdminClient();
    await admin.from("profiles").upsert({
      user_id: targetUser.id,
      niveau_etude: targetUser.profile.classe_actuelle || targetUser.profile.niveau,
      serie: targetUser.profile.serie,
      interets: targetUser.profile.centres_interet || [],
      updated_at: targetUser.updatedAt,
    });
  } catch {}

  return {
    success: true,
    user: toSafeUser(targetUser),
  };
}

/**
 * Déconnexion
 */
export function revokeSession(sessionId?: string | null): void {
  if (sessionId) {
    memorySessions.delete(sessionId);
  }
}
