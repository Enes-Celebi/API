// server/modules/transfer/transfer.trpc.ts
import { router, authedProcedure, z } from "../../trpc/procedures";

export const transferRouter = router({
  // Paginated list of transfers for *my* team (as buyer or seller)
  page: authedProcedure
    .input(
      z.object({
        cursor: z.number().nullish(), // offset
        limit: z.number().int().min(1).max(100).default(25),
      })
    )
    .query(async ({ ctx, input }) => {
      const offset = input.cursor ?? 0;

      const meTeam = await ctx.prisma.team.findUnique({
        where: { userId: ctx.user!.id },
        select: { id: true },
      });
      if (!meTeam) return { items: [], nextCursor: null, total: 0 };

      const where = {
        OR: [{ buyerTeamId: meTeam.id }, { sellerTeamId: meTeam.id }],
      };

      const total = await ctx.prisma.transfer.count({ where });

      const rows = await ctx.prisma.transfer.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: offset,
        take: input.limit,
        select: {
          id: true,
          createdAt: true,
          playerId: true,
          sellerTeamId: true,
          buyerTeamId: true,
          askingPriceCents: true,
          soldPriceCents: true,
          snapshotPosition: true,
          snapshotSkill: true,
          snapshotTactic: true,
          snapshotPhysical: true,
        },
      });

      // load player names and team names in one go
      const playerIds = Array.from(new Set(rows.map(r => r.playerId)));
      const teamIds = Array.from(
        new Set(rows.flatMap(r => [r.sellerTeamId, r.buyerTeamId]))
      );

      const [players, teams] = await Promise.all([
        ctx.prisma.player.findMany({
          where: { id: { in: playerIds } },
          select: { id: true, name: true },
        }),
        ctx.prisma.team.findMany({
          where: { id: { in: teamIds } },
          select: { id: true, name: true },
        }),
      ]);

      const playerNameById = new Map(players.map(p => [p.id, p.name]));
      const teamNameById = new Map(teams.map(t => [t.id, t.name]));

      const items = rows.map((r) => {
        const perspective = r.buyerTeamId === meTeam.id ? "buy" : "sell";
        return {
          id: r.id,
          createdAt: r.createdAt,
          kind: perspective as "buy" | "sell",
          player: { id: r.playerId, name: playerNameById.get(r.playerId) ?? "Unknown" },
          position: r.snapshotPosition,
          skill: r.snapshotSkill,
          tactic: r.snapshotTactic,
          physical: r.snapshotPhysical,
          askingPriceCents: r.askingPriceCents,
          soldPriceCents: r.soldPriceCents,
          sellerTeamId: r.sellerTeamId,
          buyerTeamId: r.buyerTeamId,
          sellerTeamName: teamNameById.get(r.sellerTeamId) ?? "—",
          buyerTeamName: teamNameById.get(r.buyerTeamId) ?? "—",
        };
      });

      const nextCursor =
        offset + items.length < total ? offset + items.length : null;

      return { items, nextCursor, total };
    }),

  // Single transfer with enriched detail for my perspective
  byId: authedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const meTeam = await ctx.prisma.team.findUnique({
        where: { userId: ctx.user!.id },
        select: { id: true, name: true },
      });
      if (!meTeam) return null;

      const t = await ctx.prisma.transfer.findUnique({
        where: { id: input.id },
        select: {
          id: true,
          createdAt: true,
          playerId: true,
          sellerTeamId: true,
          buyerTeamId: true,
          askingPriceCents: true,
          soldPriceCents: true,
          snapshotPosition: true,
          snapshotSkill: true,
          snapshotTactic: true,
          snapshotPhysical: true,
          buyerBalanceBefore: true,
          buyerBalanceAfter: true,
          sellerBalanceBefore: true,
          sellerBalanceAfter: true,
        },
      });
      if (!t) return null;

      const [player, seller, buyer] = await Promise.all([
        ctx.prisma.player.findUnique({ where: { id: t.playerId }, select: { id: true, name: true } }),
        ctx.prisma.team.findUnique({ where: { id: t.sellerTeamId }, select: { id: true, name: true } }),
        ctx.prisma.team.findUnique({ where: { id: t.buyerTeamId }, select: { id: true, name: true } }),
      ]);

      const youAreBuyer = t.buyerTeamId === meTeam.id;
      const youAreSeller = t.sellerTeamId === meTeam.id;

      return {
        id: t.id,
        createdAt: t.createdAt,
        player: { id: player?.id ?? t.playerId, name: player?.name ?? "Unknown" },
        position: t.snapshotPosition,
        skill: t.snapshotSkill,
        tactic: t.snapshotTactic,
        physical: t.snapshotPhysical,
        askingPriceCents: t.askingPriceCents,
        soldPriceCents: t.soldPriceCents,
        sellerTeamId: t.sellerTeamId,
        sellerTeamName: seller?.name ?? "—",
        buyerTeamId: t.buyerTeamId,
        buyerTeamName: buyer?.name ?? "—",
        youAreBuyer,
        youAreSeller,
        buyerBalanceBefore: t.buyerBalanceBefore,
        buyerBalanceAfter: t.buyerBalanceAfter,
        sellerBalanceBefore: t.sellerBalanceBefore,
        sellerBalanceAfter: t.sellerBalanceAfter,
      };
    }),
});
