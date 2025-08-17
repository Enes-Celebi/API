import { PrismaClient } from "@prisma/client";
import pino from "pino";
import { createTeamAndPlayers } from "../modules/club/team.service";

const prisma = new PrismaClient();
const log = pino({ transport: { target: "pino-pretty" } });

async function processOne() {
  const job = await prisma.teamCreationJob.findFirst({
    where: { status: "queued" },
    orderBy: { createdAt: "asc" },
  });
  if (!job) return false;

  await prisma.teamCreationJob.update({
    where: { id: job.id },
    data: { status: "running", error: null },
  });

  try {
    await createTeamAndPlayers(prisma, job.userId, job.teamName);

    await prisma.$transaction([
      prisma.teamCreationJob.update({
        where: { id: job.id },
        data: { status: "done" },
      }),
      prisma.user.update({
        where: { id: job.userId },
        data: { onboardingStep: "READY" },
      }),
    ]);

    log.info({ jobId: job.id, userId: job.userId }, "team created");
  } catch (err: any) {
    await prisma.teamCreationJob.update({
      where: { id: job.id },
      data: { status: "failed", error: String(err?.message ?? err) },
    });
    log.error({ jobId: job.id, err }, "team creation failed");
  }
  return true;
}

async function main() {
  log.info("Team worker started");
  setInterval(async () => {
    try {
      await processOne();
    } catch (e) {
      log.error(e, "processOne error");
    }
  }, 1500);
}

main().catch((e) => {
  log.error(e, "worker crashed");
  process.exit(1);
});
