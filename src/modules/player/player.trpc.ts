// server/routes/player.trpc.ts
import { router, authedProcedure, z } from "../../trpc/procedures";
import { TRPCError } from "@trpc/server";
import type { Prisma } from "@prisma/client";

export const playerRouter = router({
  // Full list (kept for any existing views)
  all: authedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.player.findMany({
      include: {
        team: { select: { id: true, name: true, budgetCents: true } },
        listing: true,
      },
      orderBy: { name: "asc" },
    });
  }),

  // Debug endpoint to check actual player count and IDs
  debug: authedProcedure.query(async ({ ctx }) => {
    const allPlayers = await ctx.prisma.player.findMany({
      select: { id: true, name: true },
      orderBy: { id: "asc" },
    });

    console.log("All players in database:", {
      count: allPlayers.length,
      ids: allPlayers.map((p) => p.id),
      names: allPlayers.map((p) => p.name),
    });

    return {
      totalCount: allPlayers.length,
      playerIds: allPlayers.map((p) => p.id),
      players: allPlayers,
    };
  }),

  // Simple offset-based pagination that actually works
  page: authedProcedure
    .input(
      z.object({
        cursor: z.number().nullish(), // offset
        limit: z.number().int().min(1).max(100).default(30),
        position: z.enum(["GK", "DF", "MD", "FW", "ALL"]).default("ALL"),
        forSale: z.boolean().optional(),
        teamScope: z.enum(["all", "mine"]).default("all"),
        teamId: z.string().optional(), // <-- NEW explicit team filter
      })
    )
    .query(async ({ ctx, input }) => {
      const offset = input.cursor ?? 0;

      console.log("Player pagination request:", {
        offset,
        limit: input.limit,
        position: input.position,
        forSale: input.forSale,
        teamScope: input.teamScope,
        teamId: input.teamId,
        userId: ctx.user?.id,
      });

      const whereBase: Prisma.PlayerWhereInput = {};
      if (input.position !== "ALL") whereBase.position = input.position;
      if (input.forSale === true) whereBase.listing = { isNot: null };

      if (input.teamId) {
        // explicit filter from Teams page
        whereBase.teamId = input.teamId;
      } else if (input.teamScope === "mine") {
        const meTeam = await ctx.prisma.team.findUnique({
          where: { userId: ctx.user!.id },
          select: { id: true },
        });
        if (!meTeam)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "No team for current user",
          });
        whereBase.teamId = meTeam.id;
      }

      console.log("Prisma whereBase clause:", whereBase);

      const total = await ctx.prisma.player.count({ where: whereBase });
      console.log("Total players matching filter:", total);

      const items = await ctx.prisma.player.findMany({
        where: whereBase,
        include: {
          team: { select: { id: true, name: true, budgetCents: true } },
          listing: true,
        },
        orderBy: { id: "asc" },
        skip: offset,
        take: input.limit,
      });

      const nextCursor = offset + items.length < total ? offset + items.length : null;

      const returnedIds = items.map((p) => p.id);
      console.log("Player pagination response:", {
        requestedLimit: input.limit,
        actualReturned: items.length,
        offset,
        total,
        nextCursor,
        hasMore: !!nextCursor,
        firstItemId: items[0]?.id,
        lastItemId: items[items.length - 1]?.id,
        returnedIds,
      });

      return { items, nextCursor, total };
    }),

  // List or edit price (owner only)
  listForSale: authedProcedure
    .input(z.object({ playerId: z.string(), priceCents: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const meTeam = await ctx.prisma.team.findUnique({
        where: { userId: ctx.user!.id },
        select: { id: true },
      });
      if (!meTeam)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No team for current user",
        });

      const player = await ctx.prisma.player.findUnique({
        where: { id: input.playerId },
        select: { id: true, teamId: true },
      });
      if (!player)
        throw new TRPCError({ code: "NOT_FOUND", message: "Player not found" });
      if (player.teamId !== meTeam.id)
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Not your player",
        });

      await ctx.prisma.transferListing.upsert({
        where: { playerId: input.playerId },
        create: {
          playerId: input.playerId,
          teamId: meTeam.id,
          askingPriceCents: input.priceCents,
        },
        update: { teamId: meTeam.id, askingPriceCents: input.priceCents },
      });
      return { ok: true };
    }),

  // Unlist (owner only)
  unlist: authedProcedure
    .input(z.object({ playerId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const meTeam = await ctx.prisma.team.findUnique({
        where: { userId: ctx.user!.id },
        select: { id: true },
      });
      if (!meTeam)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No team for current user",
        });

      const player = await ctx.prisma.player.findUnique({
        where: { id: input.playerId },
        select: { id: true, teamId: true },
      });
      if (!player)
        throw new TRPCError({ code: "NOT_FOUND", message: "Player not found" });
      if (player.teamId !== meTeam.id)
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Not your player",
        });

      await ctx.prisma.transferListing.deleteMany({
        where: { playerId: input.playerId },
      });
      return { ok: true };
    }),

  // Buy at 95% (checks: not yours, budget, roster < 25)
  buyAt95: authedProcedure
    .input(z.object({ playerId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.$transaction(async (tx) => {
        const buyerTeam = await tx.team.findUnique({
          where: { userId: ctx.user!.id },
        });
        if (!buyerTeam)
          throw new TRPCError({ code: "BAD_REQUEST", message: "No team found" });

        const player = await tx.player.findUnique({
          where: { id: input.playerId },
          include: { team: true, listing: true },
        });
        if (!player)
          throw new TRPCError({ code: "NOT_FOUND", message: "Player not found" });

        const listing = player.listing;
        if (!listing)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Player is not listed",
          });
        if (player.teamId === buyerTeam.id)
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You own this player",
          });

        const buyerCount = await tx.player.count({
          where: { teamId: buyerTeam.id },
        });
        if (buyerCount >= 25)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Roster full (25). Sell first.",
          });

        const payCents = Math.floor(listing.askingPriceCents * 0.95);
        if (buyerTeam.budgetCents < payCents) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Insufficient budget for 95% price",
          });
        }

        const sellerTeam = await tx.team.findUnique({
          where: { id: player.teamId },
        });
        if (!sellerTeam)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Seller team missing",
          });

        await tx.team.update({
          where: { id: sellerTeam.id },
          data: { budgetCents: { increment: payCents } },
        });
        await tx.team.update({
          where: { id: buyerTeam.id },
          data: { budgetCents: { decrement: payCents } },
        });
        await tx.player.update({
          where: { id: player.id },
          data: { teamId: buyerTeam.id },
        });
        await tx.transferListing.delete({ where: { playerId: player.id } });

        await tx.transfer.create({
          data: {
            playerId: player.id,
            sellerTeamId: sellerTeam.id,
            buyerTeamId: buyerTeam.id,
            askingPriceCents: listing.askingPriceCents,
            soldPriceCents: payCents,
            snapshotSkill: player.skill,
            snapshotTactic: player.tactic,
            snapshotPhysical: player.physical,
            snapshotPosition: player.position,
            buyerBalanceBefore: buyerTeam.budgetCents,
            buyerBalanceAfter: buyerTeam.budgetCents - payCents,
            sellerBalanceBefore: sellerTeam.budgetCents,
            sellerBalanceAfter: sellerTeam.budgetCents + payCents,
          },
        });

        return { ok: true, payCents };
      });
    }),
});
