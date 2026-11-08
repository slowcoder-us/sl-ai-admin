import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { protectedProcedure, router } from "../index";

const username = z
	.string()
	.trim()
	.max(39)
	.regex(/^[a-z\d]+(?:-[a-z\d]+)*$/i, "请输入有效的 GitHub 用户名");

const githubUser = z.object({
	avatar_url: z.url().nullable(),
	bio: z.string().nullable(),
	id: z.int().positive(),
	location: z.string().nullable(),
	login: username,
	name: z.string().nullable(),
});

const profileFields = z.object({
	bio: z.string().trim().max(500),
	location: z.string().trim().max(255),
	name: z.string().trim().max(255),
});

async function getGithubProfile(login: string) {
	const response = await fetch(`https://api.github.com/users/${login}`, {
		headers: {
			Accept: "application/vnd.github+json",
			"User-Agent": "sl-ai-admin",
			"X-GitHub-Api-Version": "2022-11-28",
		},
		signal: AbortSignal.timeout(5000),
	}).catch(() => null);

	if (response?.status === 404) {
		throw new TRPCError({ code: "NOT_FOUND", message: "找不到该 GitHub 用户" });
	}
	if (response?.status === 403 || response?.status === 429) {
		throw new TRPCError({
			code: "TOO_MANY_REQUESTS",
			message: "GitHub 查询暂时受限，请稍后重试",
		});
	}
	const profile = githubUser.safeParse(
		response?.ok ? await response.json().catch(() => null) : null
	);
	if (!profile.success) {
		throw new TRPCError({
			code: "BAD_GATEWAY",
			message: "暂时无法读取 GitHub 资料，请稍后重试",
		});
	}

	const {
		avatar_url,
		bio,
		id,
		location,
		login: canonicalLogin,
		name,
	} = profile.data;
	const avatar = avatar_url ? new URL(avatar_url) : null;
	return {
		avatarUrl:
			avatar?.origin === "https://avatars.githubusercontent.com"
				? avatar.href
				: null,
		bio,
		githubId: String(id),
		location,
		name,
		username: canonicalLogin,
	};
}

export const githubProfilesRouter = router({
	add: protectedProcedure.input(username).mutation(async ({ ctx, input }) => {
		const profile = await getGithubProfile(input);
		const result = await ctx.db.githubProfile.createMany({
			data: { ...profile, ownerId: ctx.session.user.id },
			skipDuplicates: true,
		});
		if (result.count === 0) {
			throw new TRPCError({ code: "CONFLICT", message: "该用户已保存" });
		}
	}),
	list: protectedProcedure.query(({ ctx }) =>
		ctx.db.githubProfile.findMany({
			orderBy: [{ createdAt: "desc" }, { id: "desc" }],
			where: { ownerId: ctx.session.user.id },
		})
	),
	lookup: protectedProcedure
		.input(username)
		.query(({ input }) => getGithubProfile(input)),
	remove: protectedProcedure
		.input(z.string().min(1))
		.mutation(async ({ ctx, input }) => {
			const result = await ctx.db.githubProfile.deleteMany({
				where: { id: input, ownerId: ctx.session.user.id },
			});
			if (result.count === 0) {
				throw new TRPCError({ code: "NOT_FOUND", message: "找不到该记录" });
			}
		}),
	update: protectedProcedure
		.input(profileFields.extend({ id: z.string().min(1) }))
		.mutation(async ({ ctx, input }) => {
			const { bio, id, location, name } = input;
			const result = await ctx.db.githubProfile.updateMany({
				data: {
					bio: bio || null,
					location: location || null,
					name: name || null,
				},
				where: { id, ownerId: ctx.session.user.id },
			});
			if (result.count === 0) {
				throw new TRPCError({ code: "NOT_FOUND", message: "找不到该记录" });
			}
		}),
});
