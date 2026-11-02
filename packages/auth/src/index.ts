import { expo } from "@better-auth/expo";
import type { Database } from "@sl-ai-admin/db";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { createAuthMiddleware } from "better-auth/api";
import { username } from "better-auth/plugins";

import {
	isValidUsername,
	toPlaceholderEmail,
	USERNAME_MAX_LENGTH,
	USERNAME_MIN_LENGTH,
} from "./credentials";

const SIGN_UP_PATH = "/sign-up/email";

/** Accounts are username-only: ignore any client-supplied email/name and derive them from the username. */
// biome-ignore lint/suspicious/useAwait: createAuthMiddleware needs an async handler to infer the optional context return
const fillUsernameIdentity = createAuthMiddleware(async (ctx) => {
	const requested = ctx.body?.username;
	if (ctx.path !== SIGN_UP_PATH || typeof requested !== "string") {
		return;
	}
	const name = requested.trim();
	return {
		context: {
			...ctx,
			body: { ...ctx.body, email: toPlaceholderEmail(name), name },
		},
	};
});

export interface AuthConfig {
	BETTER_AUTH_SECRET: string;
	BETTER_AUTH_URL: string;
	CORS_ORIGIN: string;
}

export function createAuth(
	env: AuthConfig,
	database: Database,
	desktopOrigins: readonly string[] = []
) {
	return betterAuth({
		advanced: {
			defaultCookieAttributes: {
				httpOnly: true,
				sameSite: "none",
				secure: true,
			},
		},
		baseURL: env.BETTER_AUTH_URL,
		database: prismaAdapter(database, {
			provider: "postgresql",
		}),
		disabledPaths: ["/sign-in/email"],
		emailAndPassword: { enabled: true },
		hooks: { before: fillUsernameIdentity },
		plugins: [
			expo(),
			username({
				maxUsernameLength: USERNAME_MAX_LENGTH,
				minUsernameLength: USERNAME_MIN_LENGTH,
				usernameValidator: isValidUsername,
			}),
		],
		secret: env.BETTER_AUTH_SECRET,
		trustedOrigins: [
			env.CORS_ORIGIN,
			...desktopOrigins,
			"sl-ai-admin://",
			"exp://",
			"http://localhost:8081",
		],
	});
}

export type Session = ReturnType<typeof createAuth>["$Infer"]["Session"];
