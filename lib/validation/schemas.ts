// Schémas de validation Zod pour les messages, profils, requêtes API et authentification.
import { z } from "zod";

export const profileSchema = z.object({
  id: z.string().uuid().optional(),
  user_id: z.string().uuid(),
  niveau_etude: z
    .string()
    .min(1, "Le niveau d'étude est requis")
    .max(50, "Le niveau d'étude est trop long")
    .regex(/^[a-zA-Z0-9\s\-_éèêëàâîïôùûçÉÈÊËÀÂÎÏÔÙÛÇ]+$/, "Format non valide")
    .optional()
    .nullable(),
  serie: z
    .string()
    .max(20, "La série est trop longue")
    .regex(/^[a-zA-Z0-9\s\-']+$/, "Format de série non valide")
    .optional()
    .nullable(),
  interets: z
    .array(
      z
        .string()
        .min(1)
        .max(60)
        .regex(/^[a-zA-Z0-9\s\-_éèêëàâîïôùûçÉÈÊËÀÂÎÏÔÙÛÇ]+$/)
    )
    .max(15, "15 intérêts maximum")
    .optional()
    .default([]),
});

export type Profile = z.infer<typeof profileSchema>;

/**
 * Schéma pour un message individuel
 */
export const messageSchema = z.object({
  id: z.string().uuid().optional(),
  conversation_id: z.string().uuid().optional(),
  role: z.enum(["user", "assistant", "system"]),
  content: z
    .string()
    .min(1, "Le message ne peut pas être vide")
    .max(2000, "Le message ne peut pas dépasser 2000 caractères"),
  created_at: z.string().datetime().optional(),
});

export type Message = z.infer<typeof messageSchema>;

/**
 * Schéma de requête pour l'API /api/chat
 */
export const chatRequestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant", "system"]),
        content: z
          .string()
          .min(1, "Le contenu ne peut être vide")
          .max(3000, "Le message dépasse la limite autorisée"),
      })
    )
    .min(1, "Au moins un message est requis")
    .max(50, "Historique trop volumineux"),
  conversationId: z.string().uuid().optional(),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;

/**
 * Schéma pour l'authentification par email (Magic Link ou OTP)
 */
export const authEmailSchema = z.object({
  email: z
    .string()
    .email("Adresse email invalide")
    .min(5, "Email trop court")
    .max(254, "Email trop long")
    .toLowerCase()
    .trim(),
});

export type AuthEmail = z.infer<typeof authEmailSchema>;
