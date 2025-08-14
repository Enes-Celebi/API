import { router, authedProcedure } from "../../trpc/procedures";

export const teamRouter = router({
  myTeam: authedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.team.findUnique({
      where: { userId: ctx.user!.id },
      include: { players: true }
    });
  }),
});
