import type { FastifyInstance } from "fastify";
import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { env } from "../../shared/env";
import { makePkce, buildAuthUrl, exchangeCodeForTokens, verifyIdToken } from "./google";

const prisma = new PrismaClient();
const COOKIE = { path: "/", httpOnly: true, sameSite: "lax" as const };

export async function identityHttpRoutes(app: FastifyInstance) {
  // Step 1: redirect to Google with PKCE
  app.get("/auth/google", async (_req, reply) => {
    const { code_verifier, code_challenge, state } = makePkce();
    reply.setCookie("g_state", state, COOKIE);
    reply.setCookie("g_cv", code_verifier, COOKIE);

    const url = buildAuthUrl({ state, code_challenge });
    return reply.redirect(url);
  });

  // Step 2: callback → exchange → verify → create/find user → session cookie
  app.get("/auth/google/callback", async (req, reply) => {
    const url = new URL(req.protocol + "://" + req.headers.host + (req.raw.url ?? ""));
    const state = url.searchParams.get("state") ?? "";
    const code  = url.searchParams.get("code") ?? "";

    const storedState   = (req.cookies as any)?.g_state ?? "";
    const code_verifier = (req.cookies as any)?.g_cv ?? "";

    if (!state || !code || state !== storedState || !code_verifier) {
      return reply.code(400).send("Invalid OAuth state");
    }

    const tokens = await exchangeCodeForTokens(code, code_verifier);
    if (!tokens.id_token) return reply.code(400).send("No id_token from Google");

    const payload = await verifyIdToken(tokens.id_token);
    const sub   = String(payload?.sub ?? "");
    const email = (payload as any)?.email ?? null;
    if (!sub) return reply.code(400).send("No sub in id_token");

    // find or create user (no team creation here)
    let user = await prisma.user.findFirst({
      where: { accounts: { some: { provider: "google", providerUserId: sub } } },
    });
    if (!user) {
      user = await prisma.user.create({ data: { email } });
      await prisma.oAuthAccount.create({
        data: { provider: "google", providerUserId: sub, userId: user.id },
      });
    }

    // session cookie
    const sid = crypto.randomUUID();
    const ttlDays = Number(process.env.SESSION_TTL_DAYS ?? "30");
    const expiresAt = new Date(Date.now() + ttlDays * 24 * 3600 * 1000);
    await prisma.session.create({ data: { id: sid, userId: user!.id, expiresAt } });

    reply
      .setCookie("sid", sid, { ...COOKIE, maxAge: ttlDays * 24 * 3600 })
      .clearCookie("g_state", COOKIE)
      .clearCookie("g_cv", COOKIE)
      .redirect(env.FRONTEND_URL);
  });

  // Logout (POST JSON)
  app.post("/auth/logout", async (req, reply) => {
    const sid = (req.cookies as any)?.sid;
    if (sid) {
      await prisma.session.deleteMany({ where: { id: sid } });
      reply.clearCookie("sid", COOKIE);
    }
    reply.code(204).send();
  });

  // Logout (GET link-friendly)
  app.get("/auth/logout", async (req, reply) => {
    const sid = (req.cookies as any)?.sid;
    if (sid) {
      await prisma.session.deleteMany({ where: { id: sid } });
    }
    reply.clearCookie("sid", COOKIE).redirect(env.FRONTEND_URL);
  });
}
