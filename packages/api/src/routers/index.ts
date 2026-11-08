import { protectedProcedure, publicProcedure, router } from "../index";
import { githubProfilesRouter } from "./github-profiles";

export const appRouter = router({
	githubProfiles: githubProfilesRouter,
	healthCheck: publicProcedure.query(() => "OK"),
	privateData: protectedProcedure.query(({ ctx }) => ({
		message: "This is private",
		user: ctx.session.user,
	})),
});
export type AppRouter = typeof appRouter;
