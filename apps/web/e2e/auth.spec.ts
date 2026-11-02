import { expect, test } from "@playwright/test";
import { AUTH_MESSAGES } from "@sl-ai-admin/auth/credentials";

import {
	fillSignInForm,
	fillSignUpForm,
	openSignUpForm,
	randomUsername,
	SERVER_URL,
	signUpViaApi,
	submitButton,
	TEST_PASSWORD,
	WEB_ORIGIN,
} from "./helpers";

const DASHBOARD_URL = /\/dashboard$/;
const LOGIN_URL = /\/login$/;

test.describe("sign up", () => {
	test("AC1 AC5: registers with a username, signs in and lands on /dashboard", async ({
		page,
	}) => {
		const username = randomUsername("New");
		await openSignUpForm(page);
		await fillSignUpForm(page, {
			confirmPassword: TEST_PASSWORD,
			password: TEST_PASSWORD,
			username,
		});
		await submitButton(page).click();

		await expect(page).toHaveURL(DASHBOARD_URL);

		const response = await page.request.get(
			`${SERVER_URL}/api/auth/get-session`
		);
		const session = await response.json();
		expect(session.user.username).toBe(username.toLowerCase());
		expect(session.user.displayUsername).toBe(username);
		expect(session.user.email).toBe(
			`${username.toLowerCase()}@users.sl-ai-admin.local`
		);
	});

	test("AC2: the server rejects invalid usernames", async ({ request }) => {
		const invalid = ["ab", "a-b-c", "a".repeat(21)];
		const responses = await Promise.all(
			invalid.map((username) => signUpViaApi(request, username))
		);
		for (const [index, response] of responses.entries()) {
			expect(response.ok(), invalid[index]).toBe(false);
		}
	});

	test("AC2: the server ignores a client-supplied email", async ({
		request,
	}) => {
		const username = randomUsername();
		const response = await request.post(
			`${SERVER_URL}/api/auth/sign-up/email`,
			{
				data: {
					email: "victim@example.com",
					name: "x",
					password: TEST_PASSWORD,
					username,
				},
				headers: { Origin: WEB_ORIGIN },
			}
		);
		expect(response.ok()).toBe(true);
		const { user } = await response.json();
		expect(user.email).toBe(`${username}@users.sl-ai-admin.local`);
		expect(user.name).toBe(username);
	});

	test("AC1: the server rejects sign-up without a username", async ({
		request,
	}) => {
		const response = await request.post(
			`${SERVER_URL}/api/auth/sign-up/email`,
			{
				data: {
					email: `${randomUsername()}@example.com`,
					name: "x",
					password: TEST_PASSWORD,
				},
				headers: { Origin: WEB_ORIGIN },
			}
		);
		expect(response.status()).toBe(400);
	});

	test("AC1: displayUsername always comes from the username", async ({
		request,
	}) => {
		const username = randomUsername("Disp");
		const response = await request.post(
			`${SERVER_URL}/api/auth/sign-up/email`,
			{
				data: {
					displayUsername: "SomeoneElse",
					email: "x@example.com",
					name: "x",
					password: TEST_PASSWORD,
					username,
				},
				headers: { Origin: WEB_ORIGIN },
			}
		);
		expect(response.ok()).toBe(true);
		const { user } = await response.json();
		expect(user.displayUsername).toBe(username);
	});

	test("AC1: identity fields cannot be changed after sign-up", async ({
		request,
	}) => {
		const username = randomUsername();
		expect((await signUpViaApi(request, username)).ok()).toBe(true);

		const attempts = [
			{ username: randomUsername() },
			{ displayUsername: "Admin" },
			{ name: "Admin" },
		];
		const responses = await Promise.all(
			attempts.map((data) =>
				request.post(`${SERVER_URL}/api/auth/update-user`, {
					data,
					headers: { Origin: WEB_ORIGIN },
				})
			)
		);
		for (const response of responses) {
			expect(response.status()).toBe(400);
		}

		const session = await (
			await request.get(`${SERVER_URL}/api/auth/get-session`)
		).json();
		expect(session.user.username).toBe(username);
		expect(session.user.displayUsername).toBe(username);
		expect(session.user.name).toBe(username);
	});

	test("AC4: shows field errors under each input without calling the API", async ({
		page,
	}) => {
		let signUpCalled = false;
		await page.route("**/api/auth/sign-up/email", (route) => {
			signUpCalled = true;
			return route.continue();
		});
		await openSignUpForm(page);
		await fillSignUpForm(page, {
			confirmPassword: "x",
			password: "1234567",
			username: "ab",
		});
		await submitButton(page).click();

		await expect(page.getByText(AUTH_MESSAGES.usernameInvalid)).toBeVisible();
		await expect(page.getByText(AUTH_MESSAGES.passwordTooShort)).toBeVisible();
		await expect(page.getByText(AUTH_MESSAGES.passwordMismatch)).toBeVisible();
		expect(signUpCalled).toBe(false);
	});

	test("AC6: duplicate username (any case) shows 用户名已被注册", async ({
		page,
		request,
	}) => {
		const username = randomUsername("dup");
		expect((await signUpViaApi(request, username)).ok()).toBe(true);

		await openSignUpForm(page);
		await fillSignUpForm(page, {
			confirmPassword: TEST_PASSWORD,
			password: TEST_PASSWORD,
			username: username.toUpperCase(),
		});
		await submitButton(page).click();

		await expect(page.getByText(AUTH_MESSAGES.usernameTaken)).toBeVisible();
		await expect(page).toHaveURL(LOGIN_URL);
	});
});

test.describe("sign in", () => {
	test("AC3: email sign-in endpoint is disabled", async ({ request }) => {
		const response = await request.post(
			`${SERVER_URL}/api/auth/sign-in/email`,
			{
				data: { email: "x@users.sl-ai-admin.local", password: TEST_PASSWORD },
				headers: { Origin: WEB_ORIGIN },
			}
		);
		expect(response.status()).toBe(404);
	});

	test("AC7: signs in with username and password", async ({
		page,
		request,
	}) => {
		const username = randomUsername();
		expect((await signUpViaApi(request, username)).ok()).toBe(true);

		await page.goto("/login");
		await fillSignInForm(page, username, TEST_PASSWORD);
		await submitButton(page).click();

		await expect(page).toHaveURL(DASHBOARD_URL);
	});

	test("AC8: wrong password and unknown user show the same error", async ({
		page,
		request,
	}) => {
		const username = randomUsername();
		expect((await signUpViaApi(request, username)).ok()).toBe(true);

		await page.goto("/login");
		await fillSignInForm(page, username, "wrong-password");
		await submitButton(page).click();
		await expect(
			page.getByText(AUTH_MESSAGES.invalidCredentials)
		).toBeVisible();

		await page.reload();
		await fillSignInForm(page, randomUsername("ghost"), TEST_PASSWORD);
		await submitButton(page).click();
		await expect(
			page.getByText(AUTH_MESSAGES.invalidCredentials)
		).toBeVisible();
		await expect(page).toHaveURL(LOGIN_URL);
	});

	test("AC9: submit button is disabled with a loading label while pending", async ({
		page,
		request,
	}) => {
		const username = randomUsername();
		expect((await signUpViaApi(request, username)).ok()).toBe(true);

		let release: () => void = () => undefined;
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		await page.route("**/api/auth/sign-in/username", async (route) => {
			await gate;
			await route.continue();
		});

		await page.goto("/login");
		await fillSignInForm(page, username, TEST_PASSWORD);
		await submitButton(page).click();

		const pending = page
			.locator("form")
			.getByRole("button", { name: "登录中…" });
		await expect(pending).toBeDisabled();
		release();
		await expect(page).toHaveURL(DASHBOARD_URL);
	});
});

test("AC10: /login shows the sign-in form by default and toggles to sign-up", async ({
	page,
}) => {
	await page.goto("/login");
	await expect(page.getByRole("heading", { name: "登录" })).toBeVisible();

	await page.getByRole("button", { name: "还没有账号？去注册" }).click();
	await expect(page.getByRole("heading", { name: "注册" })).toBeVisible();
	await expect(page.locator("form").getByLabel("确认密码")).toBeVisible();

	await page.getByRole("button", { name: "已有账号？去登录" }).click();
	await expect(page.getByRole("heading", { name: "登录" })).toBeVisible();
});
