import { router } from "./procedures";
import { identityRouter } from "../modules/identity/identity.trpc";
import { teamRouter } from "../modules/club/team.trpc";
import { playerRouter } from "../modules/player/player.trpc"; 
import { transferRouter } from "../modules/transfer/transfer.trpc";

export const appRouter = router({
  identity: identityRouter,
  team: teamRouter,
  player: playerRouter,
  transfer: transferRouter
});

export type AppRouter = typeof appRouter;
