import { router, publicProcedure, authedProcedure, z } from "../../trpc/procedures";
import { TRPCError } from "@trpc/server";

export const teamRouter = router({
  list: publicProcedure
    .input(z.object({ q: z.string().trim().min(1).max(100).optional() }).optional())
    .query(async ({ ctx, input }) => {
      const teams = await ctx.prisma.team.findMany({
        where: input?.q ? { name: { contains: input.q, mode: "insensitive" } } : undefined,
        select: { id: true, name: true, budgetCents: true },
        orderBy: { name: "asc" },
      });

      const countsByTeam = new Map<string, { GK: number; DF: number; MD: number; FW: number }>();
      const avgByTeam = new Map<string, { skill: number; tactic: number; physical: number }>();
      for (const t of teams) {
        countsByTeam.set(t.id, { GK: 0, DF: 0, MD: 0, FW: 0 });
        avgByTeam.set(t.id, { skill: 0, tactic: 0, physical: 0 });
      }

      const countsRaw = await ctx.prisma.player.groupBy({
        by: ["teamId", "position"],
        _count: { _all: true },
      });
      for (const row of countsRaw) {
        const bucket = countsByTeam.get(row.teamId);
        if (!bucket) continue;
        (bucket as any)[row.position] = row._count._all;
      }

      const avgsRaw = await ctx.prisma.player.groupBy({
        by: ["teamId"],
        _avg: { skill: true, tactic: true, physical: true },
      });
      for (const row of avgsRaw) {
        avgByTeam.set(row.teamId, {
          skill: Math.round(row._avg.skill ?? 0),
          tactic: Math.round(row._avg.tactic ?? 0),
          physical: Math.round(row._avg.physical ?? 0),
        });
      }

      return teams.map((t) => ({
        id: t.id,
        name: t.name,
        budgetCents: t.budgetCents,
        counts: countsByTeam.get(t.id)!,
        avg: avgByTeam.get(t.id)!,
      }));
    }),

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
