import { router } from "./procedures";
import { identityRouter } from "../modules/identity/identity.trpc";
import { teamRouter } from "../modules/club/team.trpc";

export const appRouter = router({
  identity: identityRouter,
  team: teamRouter,
});

export type AppRouter = typeof appRouter;
