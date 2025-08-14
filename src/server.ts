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
      transport: { target: "pino-pretty", options: { translateTime: "SYS:standard", ignore: "pid,hostname" } }
    }
  });

  const prisma = new PrismaClient();

  await app.register(cors, { origin: true, credentials: true });
  await app.register(cookie, { secret: env.SESSION_SECRET });

  app.get("/healthz", async () => ({ ok: true }));
  app.get("/db", async () => {
    const r = await prisma.$queryRawUnsafe<{ result: number }[]>("SELECT 1 as result");
    return { ok: true, db: r[0]?.result === 1 ? "up" : "unknown" };
  });

  // Google SSO HTTP routes
  const { identityHttpRoutes } = await import("./modules/identity/identity.http");
  await app.register(identityHttpRoutes);

  // tRPC plugin
  await app.register(fastifyTRPCPlugin, {
    prefix: "/trpc",
    trpcOptions: { router: appRouter, createContext }
  });

  // DEBUG: print routes to confirm /trpc is mounted
  await app.ready();
  app.log.info(app.printRoutes());

  const port = 4000;
  await app.listen({ host: "0.0.0.0", port });
  app.log.info(`API listening at ${env.BASE_URL}`);

  process.on("SIGINT", async () => { await prisma.$disconnect(); process.exit(0); });
  process.on("SIGTERM", async () => { await prisma.$disconnect(); process.exit(0); });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
