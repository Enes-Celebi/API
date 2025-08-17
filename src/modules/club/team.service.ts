import { PrismaClient } from "@prisma/client";
import crypto from "node:crypto";

type Position = "GK" | "DF" | "MD" | "FW";

const FIRST_NAMES = [
  "Liam","Noah","Oliver","Elijah","James","William","Benjamin","Lucas","Henry","Alexander",
  "Mason","Michael","Ethan","Daniel","Jacob","Logan","Jackson","Levi","Sebastian","Mateo",
  "Aiden","Theo","Leo","Arda","Emir","Kerem","Can","Ahmet","Omer","Yusuf"
];
const LAST_NAMES = [
  "Smith","Johnson","Williams","Brown","Jones","Garcia","Miller","Davis","Rodriguez","Martinez",
  "Hernandez","Lopez","Gonzalez","Wilson","Anderson","Thomas","Taylor","Moore","Jackson","Martin",
  "Thompson","White","Harris","Clark","Lewis","Walker","Young","King","Wright","Scott"
];

function rnd(min: number, max: number) {
  return crypto.randomInt(min, max + 1);
}
function pick<T>(arr: T[]): T {
  return arr[crypto.randomInt(0, arr.length)];
}
function uniqueName(used: Set<string>) {
  let name = "";
  do { name = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`; } while (used.has(name));
  used.add(name);
  return name;
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

    const usedNames = new Set<string>();
    const mk = (pos: Position, n: number) =>
      Array.from({ length: n }).map(() => ({
        name: uniqueName(usedNames),
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
        ...mk("MD", 6),
        ...mk("FW", 5),
      ],
    });

    return team;
  });
}
