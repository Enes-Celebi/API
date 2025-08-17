import { router, authedProcedure, z } from "../../trpc/procedures";
import { TRPCError } from "@trpc/server";

export const teamRouter = router({
  myTeam: authedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.team.findUnique({
      where: { userId: ctx.user!.id },
      include: { players: true },
    });
  }),

  requestCreate: authedProcedure
    .input(z.object({ teamName: z.string().trim().min(2).max(40) }))
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.findUnique({ where: { id: ctx.user!.id } });
      if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });

      if (!user.username) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Set username first" });
      }

      const hasTeam = await ctx.prisma.team.findUnique({ where: { userId: ctx.user!.id } });
      if (hasTeam) {
        return { ok: true, alreadyExists: true as const };
      }

      const job = await ctx.prisma.teamCreationJob.upsert({
        where: { userId: ctx.user!.id },
        update: { teamName: input.teamName, status: "queued", error: null },
        create: { userId: ctx.user!.id, teamName: input.teamName },
      });

      // Move user into "CREATING_TEAM" so UI shows progress
      if (user.onboardingStep !== "CREATING_TEAM") {
        await ctx.prisma.user.update({
          where: { id: ctx.user!.id },
          data: { onboardingStep: "CREATING_TEAM" },
        });
      }

      return { ok: true, jobId: job.id, status: job.status };
    }),

  jobStatus: authedProcedure.query(async ({ ctx }) => {
    const job = await ctx.prisma.teamCreationJob.findUnique({ where: { userId: ctx.user!.id } });
    return job ?? null;
  }),
});
