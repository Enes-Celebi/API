import { router, authedProcedure, publicProcedure, z } from "../../trpc/procedures";
import { TRPCError } from "@trpc/server";

type Step = "NEED_USERNAME" | "NEED_TEAM" | "CREATING_TEAM" | "READY";

export const identityRouter = router({
  ping: publicProcedure.query(() => ({ pong: true })),

  me: authedProcedure.query(async ({ ctx }) => {
    const [user, team, job] = await Promise.all([
      ctx.prisma.user.findUnique({ where: { id: ctx.user!.id } }),
      ctx.prisma.team.findUnique({ where: { userId: ctx.user!.id }, include: { players: true } }),
      ctx.prisma.teamCreationJob.findUnique({ where: { userId: ctx.user!.id } }),
    ]);
    if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });

    let status: Step = user.onboardingStep as Step;

    if (!user.username) {
      status = "NEED_USERNAME";
    } else if (!team) {
      if (job && job.status !== "done") status = "CREATING_TEAM";
      else status = "NEED_TEAM";
    } else {
      status = "READY";
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        onboardingStep: status,
      },
      team,
      job,
    };
  }),

  setUsername: authedProcedure
    .input(
      z.object({
        username: z
          .string()
          .min(3)
          .max(20)
          .regex(/^[a-zA-Z0-9_]+$/, "Use letters, numbers, and underscore only"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const current = await ctx.prisma.user.findUnique({
        where: { id: ctx.user!.id },
        select: { username: true },
      });
      if (current?.username) {
        throw new TRPCError({ code: "CONFLICT", message: "Username already set" });
      }
      try {
        const updated = await ctx.prisma.user.update({
          where: { id: ctx.user!.id },
          data: { username: input.username, onboardingStep: "NEED_TEAM" },
          select: { id: true, username: true, onboardingStep: true },
        });
        return { ok: true, user: updated };
      } catch (e: any) {
        if (String(e?.code) === "P2002") {
          throw new TRPCError({ code: "CONFLICT", message: "Username is taken" });
        }
        throw e;
      }
    }),

  logout: authedProcedure.mutation(async ({ ctx }) => {
    const sid = (ctx.req.cookies as any)?.sid;
    if (sid) {
      await ctx.prisma.session.deleteMany({ where: { id: sid } });
      ctx.reply.clearCookie("sid", { path: "/", httpOnly: true, sameSite: "lax" });
    }
    return { ok: true };
  }),
});
