import { expo } from "@better-auth/expo";
import type { Database } from "@sl-ai-admin/db";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { username } from "better-auth/plugins";

import {
	isValidUsername,
	toPlaceholderEmail,
	USERNAME_MAX_LENGTH,
	USERNAME_MIN_LENGTH,
} from "./credentials";

const SIGN_UP_PATH = "/sign-up/email";
const UPDATE_USER_PATH = "/update-user";
/** Every identity field is derived from the username at sign-up, so none may be edited afterwards. */
const IDENTITY_FIELDS = [
	"username",
	"displayUsername",
	"name",
	"email",
] as const;

/**
 * Accounts are username-only: the username is required at sign-up and every
 * other identity field (email, name, displayUsername) is derived from it.
 */
// biome-ignore lint/suspicious/useAwait: createAuthMiddleware needs an async handler to infer the optional context return
const enforceUsernameIdentity = createAuthMiddleware(async (ctx) => {
	if (ctx.path === UPDATE_USER_PATH) {
		const body: Record<string, unknown> = ctx.body ?? {};
		if (IDENTITY_FIELDS.some((field) => field in body)) {
			throw new APIError("BAD_REQUEST", {
				code: "IDENTITY_IS_IMMUTABLE",
				message: "Username-derived identity fields cannot be updated",
			});
		}
		return;
	}
	if (ctx.path !== SIGN_UP_PATH) {
		return;
	}
	const requested = ctx.body?.username;
	if (typeof requested !== "string") {
		throw new APIError("BAD_REQUEST", {
			code: "INVALID_USERNAME",
			message: "Username is required",
		});
	}
	const name = requested.trim();
	return {
		context: {
			...ctx,
			body: {
				...ctx.body,
				displayUsername: name,
				email: toPlaceholderEmail(name),
				name,
			},
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
		hooks: { before: enforceUsernameIdentity },
		plugins: [
			expo(),
			username({
				immutableUsername: true,
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
