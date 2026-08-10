import "server-only";

import { db } from "./firebase";

// Login is unauthenticated by nature and guards a single shared password, so
// without a limiter an attacker can guess at network speed. State lives in
// Firestore rather than memory because Vercel runs many short-lived instances
// and an in-process counter would reset constantly.

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

export type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
};

// Firestore document ids cannot contain "/" and must not be "." or "..", and
// raw IPs are personal data, so key on a non-reversible digest instead.
async function toDocId(scope: string, identifier: string): Promise<string> {
  const data = new TextEncoder().encode(`${scope}:${identifier}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Counts one attempt against the caller's budget. Call before checking a
 * credential; call clearAttempts() once the credential turns out to be valid.
 */
export async function consumeAttempt(
  scope: string,
  identifier: string
): Promise<RateLimitResult> {
  const ref = db.collection("rateLimits").doc(await toDocId(scope, identifier));
  const now = Date.now();

  try {
    return await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const data = snap.data();
      const windowActive = data && now - data.windowStart < WINDOW_MS;

      if (windowActive && data.attempts >= MAX_ATTEMPTS) {
        return {
          allowed: false,
          retryAfterSeconds: Math.ceil((data.windowStart + WINDOW_MS - now) / 1000),
        };
      }

      tx.set(ref, {
        attempts: windowActive ? data.attempts + 1 : 1,
        windowStart: windowActive ? data.windowStart : now,
        updatedAt: new Date().toISOString(),
      });

      return { allowed: true, retryAfterSeconds: 0 };
    });
  } catch (error) {
    // Never let limiter trouble become a login outage; a failure here still
    // leaves the password check itself in place.
    console.error("Rate limit check failed:", error);
    return { allowed: true, retryAfterSeconds: 0 };
  }
}

export async function clearAttempts(scope: string, identifier: string): Promise<void> {
  try {
    await db.collection("rateLimits").doc(await toDocId(scope, identifier)).delete();
  } catch (error) {
    console.error("Failed to clear rate limit counter:", error);
  }
}
