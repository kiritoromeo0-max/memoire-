import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const ANONYMOUS_COOKIE_NAME = "oriensci_anonymous_token";
export const ANONYMOUS_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;
const RENEW_BEFORE_SECONDS = 60 * 60 * 24 * 7;
const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();
let lastRateLimitSweep = 0;
const REDIS_RATE_LIMIT_SCRIPT = [
  "local count = redis.call('INCR', KEYS[1])",
  "if count == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end",
  "return count",
].join("\n");

export type RateLimitResult = { allowed: boolean; status?: 429 | 503 };
type AuthenticationError = { ok: false; status: number; error: string; code: string };

export function generateAnonymousToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function hashAnonymousToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function createAnonymousCredential() {
  const token = generateAnonymousToken();
  const expiresAt = new Date(Date.now() + ANONYMOUS_TOKEN_TTL_SECONDS * 1000);
  return { token, tokenHash: hashAnonymousToken(token), expiresAt };
}

export function setAnonymousCookie(response: NextResponse, token: string, expiresAt?: Date) {
  response.cookies.set(ANONYMOUS_COOKIE_NAME, token, {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: expiresAt
      ? Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000))
      : ANONYMOUS_TOKEN_TTL_SECONDS,
  });
  return response;
}

export function clearAnonymousCookie(response: NextResponse) {
  response.cookies.set(ANONYMOUS_COOKIE_NAME, "", {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
  });
  return response;
}

export function getClientAddress(req: NextRequest): string {
  return req.headers.get("x-real-ip")
    ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? "unknown";
}

export async function consumeRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const redisUrl = process.env.REDIS_REST_URL;
  const redisToken = process.env.REDIS_REST_TOKEN;

  if (redisUrl || redisToken) {
    if (!redisUrl || !redisToken) {
      console.error("[rate-limit] Redis REST configuration is incomplete");
      return { allowed: false, status: 503 };
    }

    try {
      const storageKey = `memoire:rate:${crypto.createHash("sha256").update(key).digest("hex")}`;
      const response = await fetch(redisUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${redisToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(["EVAL", REDIS_RATE_LIMIT_SCRIPT, "1", storageKey, String(windowMs)]),
        cache: "no-store",
        signal: AbortSignal.timeout(1_500),
      });
      if (!response.ok) {
        console.error(`[rate-limit] Redis REST returned HTTP ${response.status}`);
        return { allowed: false, status: 503 };
      }

      const payload = await response.json() as { result?: unknown; error?: unknown };
      const count = Number(payload.result);
      if (!Number.isSafeInteger(count) || count < 1 || payload.error) {
        console.error("[rate-limit] Redis EVAL returned an invalid response");
        return { allowed: false, status: 503 };
      }
      return count <= limit ? { allowed: true } : { allowed: false, status: 429 };
    } catch (error) {
      console.error(
        "[rate-limit] Redis request failed",
        error instanceof Error ? error.message : "Unknown error",
      );
      return { allowed: false, status: 503 };
    }
  }

  if (process.env.NODE_ENV === "production") return { allowed: false, status: 503 };

  const now = Date.now();
  const bucket = rateLimitBuckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    rateLimitBuckets.set(key, { count: 1, resetAt: now + windowMs });
    if (rateLimitBuckets.size > 10_000 && now - lastRateLimitSweep > 60_000) {
      lastRateLimitSweep = now;
      for (const [bucketKey, value] of rateLimitBuckets) {
        if (value.resetAt <= now) rateLimitBuckets.delete(bucketKey);
      }
    }
    return { allowed: true };
  }

  if (bucket.count >= limit) return { allowed: false, status: 429 };
  bucket.count++;
  return { allowed: true };
}

export function rateLimitResponse(result: RateLimitResult, message: string) {
  const unavailable = result.status === 503;
  return NextResponse.json(
    {
      error: unavailable ? "Protection temporairement indisponible" : message,
      code: unavailable ? "RATE_LIMIT_UNAVAILABLE" : "RATE_LIMITED",
    },
    { status: result.status ?? 429 },
  );
}

export async function getAuthenticatedUserId(req: NextRequest): Promise<{
  userId: string;
  tokenHash: string;
  expiresAt: Date;
} | null> {
  const token = req.cookies.get(ANONYMOUS_COOKIE_NAME)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;

  const tokenHash = hashAnonymousToken(token);

  const utilisateur = await db.utilisateur.findUnique({
    where: { anonymousTokenHash: tokenHash },
    select: { id: true, anonymousTokenExpiresAt: true },
  });

  if (!utilisateur?.anonymousTokenExpiresAt || utilisateur.anonymousTokenExpiresAt <= new Date()) {
    return null;
  }

  return {
    userId: utilisateur.id,
    tokenHash,
    expiresAt: utilisateur.anonymousTokenExpiresAt,
  };
}

export async function requireAuthenticatedUser(
  req: NextRequest,
  suppliedUserId?: string | null,
): Promise<
  | { ok: true; userId: string; tokenHash: string; expiresAt: Date }
  | AuthenticationError
> {
  const authenticatedUser = await getAuthenticatedUserId(req);

  if (!authenticatedUser) {
    return { ok: false, status: 401, error: "Authentification requise", code: "AUTH_REQUIRED" };
  }

  if (suppliedUserId && suppliedUserId !== authenticatedUser.userId) {
    return { ok: false, status: 403, error: "Accès interdit", code: "USER_NOT_AUTHORIZED" };
  }

  const limit = await consumeRateLimit(`user:${authenticatedUser.userId}`, 120, 60_000);
  if (!limit.allowed) {
    return {
      ok: false,
      status: limit.status ?? 429,
      error: limit.status === 503
        ? "Protection temporairement indisponible"
        : "Trop de requêtes. Réessayez plus tard.",
      code: limit.status === 503 ? "RATE_LIMIT_UNAVAILABLE" : "RATE_LIMITED",
    };
  }

  return { ok: true, ...authenticatedUser };
}

export async function renewAnonymousCredential(
  auth: { userId: string; tokenHash: string; expiresAt: Date },
): Promise<{ token: string; expiresAt: Date } | null> {
  const secondsLeft = Math.floor((auth.expiresAt.getTime() - Date.now()) / 1000);
  if (secondsLeft > RENEW_BEFORE_SECONDS) return null;

  const credential = createAnonymousCredential();
  const update = await db.utilisateur.updateMany({
    where: { id: auth.userId, anonymousTokenHash: auth.tokenHash },
    data: {
      anonymousTokenHash: credential.tokenHash,
      anonymousTokenExpiresAt: credential.expiresAt,
    },
  });

  return update.count === 1
    ? { token: credential.token, expiresAt: credential.expiresAt }
    : null;
}

export async function revokeAnonymousCredential(
  auth: { userId: string; tokenHash: string },
): Promise<void> {
  await db.utilisateur.updateMany({
    where: { id: auth.userId, anonymousTokenHash: auth.tokenHash },
    data: { anonymousTokenHash: null, anonymousTokenExpiresAt: null },
  });
}

export function toPublicUser<T extends { anonymousTokenHash?: unknown; anonymousTokenExpiresAt?: unknown }>(
  user: T,
) {
  const { anonymousTokenHash: _tokenHash, anonymousTokenExpiresAt: _expiresAt, ...publicUser } = user;
  return publicUser;
}

export async function requireOwnedSession(
  req: NextRequest,
  sessionId: string | null,
  suppliedUserId?: string | null,
): Promise<{ ok: true; userId: string; session: { utilisateurId: string } } | AuthenticationError> {
  const auth = await requireAuthenticatedUser(req, suppliedUserId);
  if (!auth.ok) return auth;

  if (!sessionId) {
    return { ok: false, status: 400, error: "sessionId requis", code: "INVALID_SESSION" };
  }

  const session = await db.session.findUnique({
    where: { id: sessionId },
    select: { utilisateurId: true },
  });

  if (!session || session.utilisateurId !== auth.userId) {
    return { ok: false, status: 403, error: "Session non autorisée", code: "SESSION_NOT_OWNED" };
  }

  return { ok: true, userId: auth.userId, session };
}
