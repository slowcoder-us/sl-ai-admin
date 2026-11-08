import { describe, expect, it } from "vitest";

import {
	GITHUB_PROFILE_MESSAGES,
	githubUsernameSchema,
} from "./github-profile-rules";

describe("githubUsernameSchema", () => {
	it.each(["octocat", "Octo-Cat", "a", "a1-b2-c3", "a".repeat(39)])(
		"accepts %s",
		(username) => {
			expect(githubUsernameSchema.safeParse(username).success).toBe(true);
		}
	);

	it("ignores surrounding spaces", () => {
		expect(githubUsernameSchema.parse("  octocat  ")).toBe("octocat");
	});

	it.each([
		["empty", ""],
		["only spaces", "   "],
		["leading hyphen", "-abc"],
		["trailing hyphen", "abc-"],
		["consecutive hyphens", "a--b"],
		["40 characters", "a".repeat(40)],
		["underscore", "a_b"],
		["inner space", "a b"],
		["non-ascii", "名字"],
	])("rejects %s with the Chinese message", (_label, username) => {
		const result = githubUsernameSchema.safeParse(username);
		expect(result.success).toBe(false);
		expect(result.error?.issues[0]?.message).toBe(
			GITHUB_PROFILE_MESSAGES.invalidUsername
		);
	});
});
