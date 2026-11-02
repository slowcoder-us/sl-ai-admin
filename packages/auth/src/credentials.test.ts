import { describe, expect, it } from "vitest";

import {
	AUTH_MESSAGES,
	getSignInErrorMessage,
	getSignUpErrorMessage,
	isValidUsername,
	signInSchema,
	signUpSchema,
	toPlaceholderEmail,
} from "./credentials";

const VALID_PASSWORD = "12345678";

function signUpIssues(input: {
	username: string;
	password: string;
	confirmPassword: string;
}) {
	const result = signUpSchema.safeParse(input);
	if (result.success) {
		return {};
	}
	return Object.fromEntries(
		result.error.issues.map((issue) => [issue.path.join("."), issue.message])
	);
}

describe("isValidUsername", () => {
	it.each([
		["abc", true],
		["a".repeat(20), true],
		["Alice_01", true],
		["___", true],
		["ab", false],
		["a".repeat(21), false],
		["a-b-c", false],
		["a.b.c", false],
		["名字abc", false],
		["abc def", false],
	])("%s → %s", (username, expected) => {
		expect(isValidUsername(username)).toBe(expected);
	});
});

describe("signUpSchema", () => {
	it("accepts valid input", () => {
		expect(
			signUpIssues({
				confirmPassword: VALID_PASSWORD,
				password: VALID_PASSWORD,
				username: "Alice_01",
			})
		).toEqual({});
	});

	it("reports each field error on its own path", () => {
		expect(
			signUpIssues({
				confirmPassword: "x",
				password: "1234567",
				username: "ab",
			})
		).toEqual({
			confirmPassword: AUTH_MESSAGES.passwordMismatch,
			password: AUTH_MESSAGES.passwordTooShort,
			username: AUTH_MESSAGES.usernameInvalid,
		});
	});

	it("accepts an 8-character password", () => {
		expect(
			signUpIssues({
				confirmPassword: VALID_PASSWORD,
				password: VALID_PASSWORD,
				username: "alice",
			})
		).toEqual({});
	});
});

describe("signInSchema", () => {
	it("only requires non-empty fields", () => {
		expect(
			signInSchema.safeParse({ password: "y", username: "x" }).success
		).toBe(true);
		expect(
			signInSchema.safeParse({ password: "", username: " " }).success
		).toBe(false);
	});
});

describe("toPlaceholderEmail", () => {
	it("lowercases the username so case variants collide", () => {
		expect(toPlaceholderEmail("Alice_01")).toBe(
			"alice_01@users.sl-ai-admin.local"
		);
		expect(toPlaceholderEmail("ALICE_01")).toBe(toPlaceholderEmail("alice_01"));
	});
});

describe("getSignUpErrorMessage", () => {
	it.each([
		["USERNAME_IS_ALREADY_TAKEN", AUTH_MESSAGES.usernameTaken],
		["USER_ALREADY_EXISTS", AUTH_MESSAGES.usernameTaken],
		["USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL", AUTH_MESSAGES.usernameTaken],
		["INVALID_USERNAME", AUTH_MESSAGES.usernameInvalid],
		["USERNAME_TOO_SHORT", AUTH_MESSAGES.usernameInvalid],
		["PASSWORD_TOO_SHORT", AUTH_MESSAGES.passwordTooShort],
		["SOMETHING_ELSE", AUTH_MESSAGES.signUpFailed],
		[undefined, AUTH_MESSAGES.signUpFailed],
	])("%s", (code, expected) => {
		expect(getSignUpErrorMessage(code)).toBe(expected);
	});
});

describe("getSignInErrorMessage", () => {
	it.each([
		[401, AUTH_MESSAGES.invalidCredentials],
		[400, AUTH_MESSAGES.invalidCredentials],
		[422, AUTH_MESSAGES.invalidCredentials],
		[429, AUTH_MESSAGES.signInFailed],
		[500, AUTH_MESSAGES.signInFailed],
		[0, AUTH_MESSAGES.signInFailed],
		[undefined, AUTH_MESSAGES.signInFailed],
	])("%s", (status, expected) => {
		expect(getSignInErrorMessage(status)).toBe(expected);
	});
});
