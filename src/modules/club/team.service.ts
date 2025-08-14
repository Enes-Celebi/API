import { PrismaClient } from "@prisma/client";

// Use a local union instead of importing enum from Prisma
type Position = "GK" | "DF" | "MD" | "FW";

function rnd(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export async function createTeamAndPlayers(
  prisma: PrismaClient,
  userId: string,
  teamName: string
) {
  const exists = await prisma.team.findUnique({ where: { userId } });
  if (exists) return exists;

  return prisma.$transaction(async (tx) => {
    const team = await tx.team.create({ data: { userId, name: teamName } });

    const mk = (pos: Position, n: number) =>
      Array.from({ length: n }).map(() => ({
        name: `${pos}-${rnd(1000, 9999)}`,
        position: pos,
        skill: rnd(50, 99),
        tactic: rnd(50, 99),
        physical: rnd(50, 99),
        teamId: team.id,
      }));

    await tx.player.createMany({
      data: [
        ...mk("GK", 3),
        ...mk("DF", 6),
        ...mk("MD", 6), // uses MD (matches your schema)
        ...mk("FW", 5),
      ],
    });

    return team;
  });
}
