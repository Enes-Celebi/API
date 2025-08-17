import { env } from "../../shared/env";
import crypto from "node:crypto";

/** Base64URL helper for PKCE */
function b64url(buf: Buffer) {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function makePkce() {
  const code_verifier = b64url(crypto.randomBytes(32));
  const code_challenge = b64url(crypto.createHash("sha256").update(code_verifier).digest());
  const state = b64url(crypto.randomBytes(16));
  return { code_verifier, code_challenge, state };
}

export function buildAuthUrl(opts: { state: string; code_challenge: string }) {
  const p = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: env.GOOGLE_REDIRECT_URI,
    response_type: "code",
    scope: "openid email profile",
    code_challenge: opts.code_challenge,
    code_challenge_method: "S256",
    state: opts.state,
    access_type: "online",
    prompt: "consent",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p.toString()}`;
}

export async function exchangeCodeForTokens(code: string, code_verifier: string) {
  const body = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    client_secret: env.GOOGLE_CLIENT_SECRET,
    redirect_uri: env.GOOGLE_REDIRECT_URI,
    grant_type: "authorization_code",
    code,
    code_verifier,
  });

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`token exchange failed (${res.status}): ${text}`);
  }

  return res.json() as Promise<{
    access_token: string;
    id_token?: string;
    expires_in: number;
    token_type: "Bearer";
    scope?: string;
    refresh_token?: string;
  }>;
}

/**
 * Verify the ID token WITHOUT extra dependencies.
 * Uses Google's hosted tokeninfo endpoint:
 * https://oauth2.googleapis.com/tokeninfo?id_token=...
 * Good enough for dev/demo; in prod you’d typically verify locally
 * against Google JWKS (e.g. with `jose` or `google-auth-library`).
 */
export async function verifyIdToken(idToken: string) {
  const url = "https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(idToken);
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`tokeninfo failed (${res.status}): ${text}`);
  }
  const payload = (await res.json()) as any;

  // Basic checks
  if (!payload || !payload.aud || payload.aud !== env.GOOGLE_CLIENT_ID) {
    throw new Error("audience mismatch in id_token");
  }
  // payload.sub, payload.email, payload.email_verified, name, picture, ...
  return payload as {
    aud: string;
    sub: string;
    email?: string;
    email_verified?: string | boolean;
    name?: string;
    picture?: string;
  };
}
