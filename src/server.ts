import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import { PrismaClient } from "@prisma/client";
import { env } from "./shared/env";

import { fastifyTRPCPlugin } from "@trpc/server/adapters/fastify";
import { appRouter } from "./trpc/appRouter";
import { createContext } from "./trpc/context";

async function main() {
  const app = Fastify({
    logger: {
      level: "info",
      transport: {
        target: "pino-pretty",
        options: { translateTime: "SYS:standard", ignore: "pid,hostname" },
      },
    },
  });

  const prisma = new PrismaClient();

  // CORS + cookies so the SPA on FRONTEND_URL can send/receive the sid cookie
  await app.register(cors, {
    origin: env.FRONTEND_URL,
    credentials: true,
  });
  await app.register(cookie, { secret: env.SESSION_SECRET });

  // Health checks
  app.get("/healthz", async () => ({ ok: true }));
  app.get("/db", async () => {
    const r = await prisma.$queryRawUnsafe<{ result: number }[]>("SELECT 1 as result");
    return { ok: true, db: r[0]?.result === 1 ? "up" : "unknown" };
  });

  // Google SSO routes
  const { identityHttpRoutes } = await import("./modules/identity/identity.http");
  await app.register(identityHttpRoutes);

  // tRPC adapter (Fastify v5 → cast to any for adapter types)
  await app.register(fastifyTRPCPlugin as any, {
    prefix: "/trpc",
    trpcOptions: { router: appRouter, createContext },
  });

  // Ready & route tree
  await app.ready();

  // --- Helpful startup debug: verify mounted tRPC routers and important procedures
  try {
    const record = (appRouter as any)?._def?.record ?? {};
    const routerKeys = Object.keys(record);
    app.log.info({ routers: routerKeys }, "tRPC routers mounted");
    if (record.player?._def?.record) {
      const playerKeys = Object.keys(record.player._def.record);
      app.log.info({ playerProcedures: playerKeys }, "tRPC player procedures");
    }
  } catch (e) {
    app.log.warn({ err: e }, "Could not introspect tRPC router");
  }

  app.log.info(app.printRoutes());

  // Listen
  const port = 4000;
  await app.listen({ host: "0.0.0.0", port });
  app.log.info(`API listening at ${env.BASE_URL}`);

  // Graceful shutdown
  const shutdown = async () => {
    try {
      await prisma.$disconnect();
    } finally {
      process.exit(0);
    }
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
