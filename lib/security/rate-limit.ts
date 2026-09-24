/**
 * Rate Limiter in-memory avec algorithme de fenêtre glissante (Token Bucket / Sliding Window)
 * Conçu pour protéger les Route Handlers contre les attaques par déni de service et le spam.
 */

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const rateLimitMap = new Map<string, RateLimitRecord>();

// Nettoyage régulier des clés expirées pour éviter les fuites mémoire
const CLEANUP_INTERVAL = 60 * 1000; // 1 minute
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of rateLimitMap.entries()) {
      if (now > record.resetTime) {
        rateLimitMap.delete(key);
      }
    }
  }, CLEANUP_INTERVAL);
}

export interface RateLimitOptions {
  limit?: number; // Nombre max de requêtes autorisées
  windowMs?: number; // Durée de la fenêtre en millisecondes
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

/**
 * Vérifie si l'identifiant (IP ou userId) respecte la limite de taux
 */
export function checkRateLimit(
  identifier: string,
  options: RateLimitOptions = {}
): RateLimitResult {
  const limit = options.limit ?? 25; // 25 requêtes par défaut
  const windowMs = options.windowMs ?? 60 * 1000; // Fenêtre de 1 minute par défaut
  const now = Date.now();

  const record = rateLimitMap.get(identifier);

  if (!record || now > record.resetTime) {
    // Nouvelle fenêtre
    rateLimitMap.set(identifier, {
      count: 1,
      resetTime: now + windowMs,
    });
    return {
      success: true,
      limit,
      remaining: limit - 1,
      reset: Math.ceil((now + windowMs) / 1000),
    };
  }

  if (record.count >= limit) {
    return {
      success: false,
      limit,
      remaining: 0,
      reset: Math.ceil(record.resetTime / 1000),
    };
  }

  record.count += 1;
  return {
    success: true,
    limit,
    remaining: limit - record.count,
    reset: Math.ceil(record.resetTime / 1000),
  };
}
