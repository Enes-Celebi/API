import { env } from "../../shared/env";
import crypto from "node:crypto";

/**
 * ESM-only 'openid-client' + CommonJS TS:
 * Use dynamic import so we don't need NodeNext module settings.
 */
export async function getGoogleClient() {
  const openid: any = await import("openid-client");
  const { Issuer } = openid;
  const google = await Issuer.discover("https://accounts.google.com");
  // Issuer instance exposes .Client ctor
  return new google.Client({
    client_id: env.GOOGLE_CLIENT_ID,
    client_secret: env.GOOGLE_CLIENT_SECRET,
    redirect_uris: [env.GOOGLE_REDIRECT_URI],
    response_types: ["code"],
  });
}

/** Small PKCE/state helper (no dependency on openid-client.generators) */
function b64url(buf: Buffer) {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function makePkce() {
  const code_verifier = b64url(crypto.randomBytes(32));
  const code_challenge = b64url(crypto.createHash("sha256").update(code_verifier).digest());
  const state = b64url(crypto.randomBytes(16));
  return { code_verifier, code_challenge, state };
}
