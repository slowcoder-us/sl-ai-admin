import { execFileSync } from "node:child_process";

import type { APIRequestContext, Page } from "@playwright/test";
import { toPlaceholderEmail } from "@sl-ai-admin/auth/credentials";

export const SERVER_URL = "http://localhost:3000";
export const WEB_ORIGIN = "http://localhost:3001";
export const TEST_PASSWORD = "password123";

/**
 * Shared long-lived account for tests that only need "an existing user".
 * Created by global-setup if missing and never deleted.
 */
export const TEST_ACCOUNT = { password: "test1234", username: "test" } as const;

/**
 * Every account a test registers must use this prefix: global-teardown deletes
 * all users whose email starts with it.
 */
export const TEMP_USER_PREFIX = "e2e_";

const RANDOM_SUFFIX_LENGTH = 8;

/** A throwaway username, removed by global-teardown after the run. */
export function randomUsername(label?: string): string {
	const suffix = crypto
		.randomUUID()
		.replaceAll("-", "")
		.slice(0, RANDOM_SUFFIX_LENGTH);
	return label
		? `${TEMP_USER_PREFIX}${label}_${suffix}`
		: `${TEMP_USER_PREFIX}${suffix}`;
}

export function signUpViaApi(
	request: APIRequestContext,
	username: string,
	password = TEST_PASSWORD
) {
	return request.post(`${SERVER_URL}/api/auth/sign-up/email`, {
		data: {
			email: toPlaceholderEmail(username),
			name: username,
			password,
			username,
		},
		headers: { Origin: WEB_ORIGIN },
	});
}

export interface SeedProfile {
	bio: string;
	location: string;
	name: string;
	username: string;
}

function sqlText(value: string): string {
	return `'${value.replaceAll("'", "''")}'`;
}

/**
 * Inserts saved GitHub profiles straight into the database, so a test spends
 * none of GitHub's anonymous quota. global-teardown removes them with the owner.
 */
export function insertGithubProfiles(
	ownerUsername: string,
	profiles: SeedProfile[]
) {
	const sql = profiles
		.map(
			({ bio, location, name, username }, index) => `
INSERT INTO "github_profile" ("id", "ownerId", "githubId", "username", "name", "bio", "location")
SELECT ${sqlText(crypto.randomUUID())}, id, ${sqlText(String(index + 1))}, ${sqlText(username)}, ${sqlText(name)}, ${sqlText(bio)}, ${sqlText(location)}
FROM "user" WHERE username = ${sqlText(ownerUsername)};`
		)
		.join("\n");
	execFileSync(
		"pnpm",
		["-F", "@sl-ai-admin/db", "exec", "prisma", "db", "execute", "--stdin"],
		{ input: sql, stdio: ["pipe", "ignore", "inherit"] }
	);
}

/** Signs `request` (or a page's `page.request`) in as the shared test account. */
export function signInAsTestAccount(request: APIRequestContext) {
	return request.post(`${SERVER_URL}/api/auth/sign-in/username`, {
		data: TEST_ACCOUNT,
		headers: { Origin: WEB_ORIGIN },
	});
}

export async function openSignUpForm(page: Page) {
	await page.goto("/login");
	await page.getByRole("button", { name: "还没有账号？去注册" }).click();
	await page.getByRole("heading", { name: "注册" }).waitFor();
}

export async function fillSignUpForm(
	page: Page,
	values: { username: string; password: string; confirmPassword: string }
) {
	const form = page.locator("form");
	await form.getByLabel("用户名").fill(values.username);
	await form.getByLabel("密码", { exact: true }).fill(values.password);
	await form.getByLabel("确认密码").fill(values.confirmPassword);
}

export async function fillSignInForm(
	page: Page,
	username: string,
	password: string
) {
	const form = page.locator("form");
	await form.getByLabel("用户名").fill(username);
	await form.getByLabel("密码", { exact: true }).fill(password);
}

export function submitButton(page: Page) {
	return page.locator("form").getByRole("button", { exact: false });
}
