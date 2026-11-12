import { z } from "zod";

export const GITHUB_PROFILE_MESSAGES = {
	invalidUsername: "请输入有效的 GitHub 用户名",
} as const;

const GITHUB_USERNAME_MAX_LENGTH = 39;
const GITHUB_USERNAME_PATTERN = /^[a-z\d]+(?:-[a-z\d]+)*$/i;

export const githubUsernameSchema = z
	.string()
	.trim()
	.max(GITHUB_USERNAME_MAX_LENGTH, GITHUB_PROFILE_MESSAGES.invalidUsername)
	.regex(GITHUB_USERNAME_PATTERN, GITHUB_PROFILE_MESSAGES.invalidUsername);

export const GITHUB_PROFILE_LIMITS = {
	bio: 500,
	location: 255,
	name: 255,
} as const;

export const githubProfileFieldsSchema = z.object({
	bio: z.string().trim().max(GITHUB_PROFILE_LIMITS.bio),
	location: z.string().trim().max(GITHUB_PROFILE_LIMITS.location),
	name: z.string().trim().max(GITHUB_PROFILE_LIMITS.name),
});
