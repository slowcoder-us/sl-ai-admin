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
