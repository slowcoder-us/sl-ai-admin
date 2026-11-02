import type { APIRequestContext, Page } from "@playwright/test";
import { toPlaceholderEmail } from "@sl-ai-admin/auth/credentials";

export const SERVER_URL = "http://localhost:3000";
export const WEB_ORIGIN = "http://localhost:3001";
export const TEST_PASSWORD = "password123";

const RANDOM_SUFFIX_LENGTH = 8;

/** Unique per test so specs never depend on database cleanup. */
export function randomUsername(prefix = "e2e"): string {
	const suffix = crypto
		.randomUUID()
		.replaceAll("-", "")
		.slice(0, RANDOM_SUFFIX_LENGTH);
	return `${prefix}_${suffix}`;
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
