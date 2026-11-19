import { AuthUser } from "@/types";

export const AUTH_COOKIE_NAME = "analytics_team_auth";

let ephemeralDevSecret: string | null = null;

/**
 * Returns a high-entropy secret used for HMAC-SHA256 signature verification.
 * Enforces strict private secret configuration in production and prevents static forgery.
 */
export function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (secret && secret.trim().length >= 16) {
    return secret.trim();
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "CRITICAL SECURITY CONFIGURATION ERROR: SESSION_SECRET must be configured with at least 16 characters in production."
    );
  }
  // Safe ephemeral runtime secret for development/testing
  if (!ephemeralDevSecret) {
    ephemeralDevSecret = "dev-session-key-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
  return ephemeralDevSecret;
}

function base64UrlEncode(str: string): string {
  return Buffer.from(str, "utf8").toString("base64url");
}

function base64UrlDecode(str: string): string {
  return Buffer.from(str, "base64url").toString("utf8");
}

/**
 * Cryptographically signs an authentication token using Web Crypto HMAC-SHA256
 * (compatible with both Node.js server runtime and Next.js Edge middleware without Node crypto dependency).
 */
export async function createSignedSessionToken(user: AuthUser): Promise<string> {
  const enc = new TextEncoder();
  const secret = getSessionSecret();

  const header = { alg: "HS256", typ: "JWT" };
  const payload = {
    sub: user.username,
    name: user.name,
    role: user.role,
    developerId: user.developerId,
    jti: Math.random().toString(36).slice(2) + Date.now().toString(36),
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60, // 30 days
  };

  const b64Header = base64UrlEncode(JSON.stringify(header));
  const b64Payload = base64UrlEncode(JSON.stringify(payload));
  const dataToSign = `${b64Header}.${b64Payload}`;

  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await globalThis.crypto.subtle.sign("HMAC", key, enc.encode(dataToSign));
  const b64Signature = Buffer.from(signature).toString("base64url");

  return `${dataToSign}.${b64Signature}`;
}

/**
 * Asynchronously verifies the HMAC signature of a session token.
 * Uses Web Crypto API exclusively so it runs seamlessly in Next.js Edge middleware.
 */
export async function verifySignedSessionTokenAsync(token: string): Promise<AuthUser | null> {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  try {
    const enc = new TextEncoder();
    const secret = getSessionSecret();
    const [b64Header, b64Payload, b64Signature] = parts;

    const key = await globalThis.crypto.subtle.importKey(
      "raw",
      enc.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const sigBuffer = Buffer.from(b64Signature, "base64url");
    const dataToSign = `${b64Header}.${b64Payload}`;

    const valid = await globalThis.crypto.subtle.verify("HMAC", key, sigBuffer, enc.encode(dataToSign));
    if (!valid) return null;

    const rawPayload = base64UrlDecode(b64Payload);
    const payload = JSON.parse(rawPayload);

    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null; // Expired
    }

    if (!payload.sub || !payload.role) {
      return null;
    }

    return {
      username: payload.sub,
      name: payload.name || payload.sub,
      role: payload.role,
      developerId: payload.developerId,
    };
  } catch {
    return null;
  }
}
