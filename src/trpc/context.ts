import type { FastifyRequest, FastifyReply } from "fastify";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export type SessionUser = { id: string; email: string | null };

async function getUserFromCookie(req: FastifyRequest): Promise<SessionUser | null> {
  const sid = (req.cookies as any)?.sid;
  if (!sid) return null;
  const session = await prisma.session.findUnique({
    where: { id: sid },
    include: { user: true }
  });
  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now()) return null;
  return { id: session.user.id, email: session.user.email };
}

export async function createContext({ req, reply }: { req: FastifyRequest; reply: FastifyReply }) {
  const user = await getUserFromCookie(req);
  return { req, reply, prisma, user };
}
export type Context = Awaited<ReturnType<typeof createContext>>;
