import { expect, test } from "@playwright/test";

import {
	randomUsername,
	SERVER_URL,
	signInAsTestAccount,
	signUpViaApi,
	TEST_ACCOUNT,
} from "./helpers";

const DASHBOARD_URL = /\/dashboard$/;
const LOGIN_URL = /\/login$/;
const HTTP_UNAUTHORIZED = 401;
const HTTP_OK = 200;

test.describe("protected pages", () => {
	test("AC1: signed-out visitors are sent from /dashboard to /login", async ({
		page,
	}) => {
		await page.goto("/dashboard");
		await expect(page).toHaveURL(LOGIN_URL);
	});

	test("AC1: an invalid session cookie is still rejected by the page", async ({
		context,
		page,
	}) => {
		await context.addCookies([
			{
				name: "better-auth.session_token",
				url: SERVER_URL,
				value: "not-a-real-session",
			},
		]);
		await page.goto("/dashboard");
		await expect(page).toHaveURL(LOGIN_URL);
		await expect(page.getByRole("heading", { name: "登录" })).toBeVisible();
	});

	test("AC2: signed-in users are sent from /login to /dashboard", async ({
		page,
	}) => {
		expect((await signInAsTestAccount(page.request)).ok()).toBe(true);
		await page.goto("/login");
		await expect(page).toHaveURL(DASHBOARD_URL);
	});

	test("AC5: dashboard greets the user by their original username", async ({
		page,
	}) => {
		const username = randomUsername("Alice");
		expect((await signUpViaApi(page.request, username)).ok()).toBe(true);
		await page.goto("/dashboard");
		await expect(page.getByText(`欢迎，${username}`)).toBeVisible();
	});
});

test.describe("user menu", () => {
	test("AC3: shows the username and signs out back to /login", async ({
		page,
	}) => {
		expect((await signInAsTestAccount(page.request)).ok()).toBe(true);
		await page.goto("/dashboard");

		await page
			.getByRole("button", { exact: true, name: TEST_ACCOUNT.username })
			.click();
		await page.getByRole("menuitem", { name: "退出登录" }).click();
		await expect(page).toHaveURL(LOGIN_URL);

		await page.goto("/dashboard");
		await expect(page).toHaveURL(LOGIN_URL);
	});

	test("AC4: signed-out header shows a 登录 link to /login", async ({
		page,
	}) => {
		await page.goto("/");
		await page.getByRole("link", { name: "登录" }).click();
		await expect(page).toHaveURL(LOGIN_URL);
	});
});

test.describe("protected API", () => {
	test("AC6: privateData returns 401 without a session and 200 with one", async ({
		request,
	}) => {
		const anonymous = await request.get(`${SERVER_URL}/trpc/privateData`);
		expect(anonymous.status()).toBe(HTTP_UNAUTHORIZED);
		const body = await anonymous.json();
		expect(body.error.data.code).toBe("UNAUTHORIZED");

		expect((await signInAsTestAccount(request)).ok()).toBe(true);
		const signedIn = await request.get(`${SERVER_URL}/trpc/privateData`);
		expect(signedIn.status()).toBe(HTTP_OK);
	});
});
