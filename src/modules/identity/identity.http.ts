import type { FastifyInstance } from "fastify";
import { PrismaClient } from "@prisma/client";
import { env } from "../../shared/env";
import { getGoogleClient, makePkce } from "./google";

const prisma = new PrismaClient();
const COOKIE = { path: "/", httpOnly: true, sameSite: "lax" as const };

export async function identityHttpRoutes(app: FastifyInstance) {
  // Start OAuth
  app.get("/auth/google", async (_req, reply) => {
    const client = await getGoogleClient();
    const { code_verifier, code_challenge, state } = makePkce();

    reply.setCookie("g_state", state, COOKIE);
    reply.setCookie("g_cv", code_verifier, COOKIE);

    const url = client.authorizationUrl({
      scope: "openid email profile",
      code_challenge,
      code_challenge_method: "S256",
      state,
    });
    return reply.redirect(url);
  });

  // Callback
  app.get("/auth/google/callback", async (req, reply) => {
    const client = await getGoogleClient();

    const url = new URL(req.protocol + "://" + req.headers.host + (req.raw.url ?? ""));
    const state = url.searchParams.get("state");
    const code  = url.searchParams.get("code");
    const storedState = (req.cookies as any)?.g_state;
    const code_verifier = (req.cookies as any)?.g_cv;

    if (!state || !code || !storedState || state !== storedState || !code_verifier) {
      return reply.code(400).send("Invalid OAuth state");
    }

    const tokenSet = await client.callback(
      env.GOOGLE_REDIRECT_URI,
      { code, code_verifier, state },
      { state }
    );
    const userinfo: any = await client.userinfo(tokenSet.access_token!);

    const email: string | null = userinfo.email ?? null;
    const sub: string = userinfo.sub;

    // find by provider/sub
    let user = await prisma.user.findFirst({
      where: { accounts: { some: { provider: "google", providerUserId: sub } } }
    });

    // first login → create user + oauth account
    if (!user) {
      user = await prisma.user.create({ data: { email } });
      await prisma.oAuthAccount.create({
        data: { provider: "google", providerUserId: sub, userId: user.id }
      });

      // Background team creation — no Redis, inline
      const { createTeamAndPlayers } = await import("../club/team.service");
      const defaultName = email ? email.split("@")[0] : `team-${user.id.slice(0, 6)}`;
      setImmediate(() => {
        createTeamAndPlayers(prisma, user!.id, defaultName).catch((e) => app.log.error(e, "team create failed"));
      });
    }

    // create session cookie
    const sid = crypto.randomUUID();
    const ttlDays = Number(process.env.SESSION_TTL_DAYS ?? "30");
    const expiresAt = new Date(Date.now() + ttlDays * 24 * 3600 * 1000);
    await prisma.session.create({ data: { id: sid, userId: user!.id, expiresAt } });

    reply
      .setCookie("sid", sid, { ...COOKIE, maxAge: ttlDays * 24 * 3600 })
      .clearCookie("g_state", COOKIE)
      .clearCookie("g_cv", COOKIE)
      .redirect("/");
  });

  // Logout
  app.post("/auth/logout", async (req, reply) => {
    const sid = (req.cookies as any)?.sid;
    if (sid) {
      await prisma.session.deleteMany({ where: { id: sid } });
      reply.clearCookie("sid", COOKIE);
    }
    reply.code(204).send();
  });
}
