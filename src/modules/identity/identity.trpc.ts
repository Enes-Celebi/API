import { router, authedProcedure, publicProcedure } from "../../trpc/procedures";

export const identityRouter = router({
  // quick public ping so you can test /trpc works without auth
  ping: publicProcedure.query(() => ({ pong: true })),

  me: authedProcedure.query(async ({ ctx }) => {
    const team = await ctx.prisma.team.findUnique({
      where: { userId: ctx.user!.id },
      include: { players: true }
    });
    return { user: ctx.user, team };
  }),
});
