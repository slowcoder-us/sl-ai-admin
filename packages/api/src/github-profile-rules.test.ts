import { describe, expect, it } from "vitest";

import {
	GITHUB_PROFILE_LIMITS,
	GITHUB_PROFILE_MESSAGES,
	githubProfileFieldsSchema,
	githubUsernameSchema,
} from "./github-profile-rules";

const validFields = { bio: "bio", location: "place", name: "name" };

describe("githubProfileFieldsSchema", () => {
	it.each(Object.entries(GITHUB_PROFILE_LIMITS))(
		"accepts %s at its limit of %i and rejects one more",
		(field, limit) => {
			const withLength = (length: number) => ({
				...validFields,
				[field]: "a".repeat(length),
			});

			expect(
				githubProfileFieldsSchema.safeParse(withLength(limit)).success
			).toBe(true);
			expect(
				githubProfileFieldsSchema.safeParse(withLength(limit + 1)).success
			).toBe(false);
		}
	);

	it("ignores surrounding spaces when measuring and returning a value", () => {
		const padded = ` ${"a".repeat(GITHUB_PROFILE_LIMITS.bio)} `;

		expect(
			githubProfileFieldsSchema.parse({ ...validFields, bio: padded }).bio
		).toBe("a".repeat(GITHUB_PROFILE_LIMITS.bio));
	});
});

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
