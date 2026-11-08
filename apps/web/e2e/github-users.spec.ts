import { expect, type Page, type Route, test } from "@playwright/test";
import { GITHUB_PROFILE_MESSAGES } from "@sl-ai-admin/api/github-profile-rules";

import {
	randomUsername,
	SERVER_URL,
	signUpViaApi,
	WEB_ORIGIN,
} from "./helpers";

const GITHUB_USERS_URL = /\/dashboard\/github-users$/;
const LOGIN_URL = /\/login$/;
const HTTP_NOT_FOUND = 404;
const HTTP_OK = 200;
const HTTP_UNAUTHORIZED = 401;
const LOOKUP_ROUTE = "**/trpc/githubProfiles.lookup*";
const NOT_FOUND_MESSAGE = "找不到该 GitHub 用户";
const SEARCHING = "正在搜索…";
const TOAST_SETTLE_MS = 1000;

const CORS_HEADERS = {
	"Access-Control-Allow-Credentials": "true",
	"Access-Control-Allow-Origin": WEB_ORIGIN,
};

const emptyProfile = {
	avatarUrl: null,
	bio: null,
	githubId: "1",
	location: null,
	name: null,
	username: "ghost-user",
};

function fulfillProfile(route: Route) {
	return route.fulfill({
		headers: CORS_HEADERS,
		json: [{ result: { data: emptyProfile } }],
		status: HTTP_OK,
	});
}

async function openSignedIn(page: Page) {
	expect((await signUpViaApi(page.request, randomUsername())).ok()).toBe(true);
	await page.goto("/dashboard/github-users");
}

async function search(page: Page, username: string) {
	await page.getByLabel("GitHub 用户名").fill(username);
	await page.getByRole("button", { exact: true, name: "搜索" }).click();
}

test.describe("access", () => {
	test("AC1: the dashboard links to GitHub user management", async ({
		page,
	}) => {
		expect((await signUpViaApi(page.request, randomUsername())).ok()).toBe(
			true
		);
		await page.goto("/dashboard");
		await page.getByRole("link", { name: "GitHub 用户管理" }).click();
		await expect(page).toHaveURL(GITHUB_USERS_URL);
	});

	test("AC2: signed-out visitors are sent to /login", async ({ page }) => {
		await page.goto("/dashboard/github-users");
		await expect(page).toHaveURL(LOGIN_URL);
	});

	test("AC3: lookup returns 401 without a session", async ({ request }) => {
		const response = await request.get(
			`${SERVER_URL}/trpc/githubProfiles.lookup?input=${encodeURIComponent('"octocat"')}`
		);
		expect(response.status()).toBe(HTTP_UNAUTHORIZED);
	});
});

test.describe("search", () => {
	for (const invalid of ["-abc", "a--b", "a".repeat(40)]) {
		test(`AC4: ${invalid} shows one Chinese hint and sends no request`, async ({
			page,
		}) => {
			let lookups = 0;
			await page.route(LOOKUP_ROUTE, (route) => {
				lookups += 1;
				return fulfillProfile(route);
			});
			await openSignedIn(page);

			await search(page, invalid);

			const alert = page.getByRole("alert").filter({
				hasText: GITHUB_PROFILE_MESSAGES.invalidUsername,
			});
			await expect(alert).toHaveCount(1);
			await expect(page.getByText('"code"')).toHaveCount(0);
			expect(lookups).toBe(0);
		});
	}

	test("AC5: octocat shows the public profile and a new-tab link", async ({
		page,
	}) => {
		await openSignedIn(page);

		await search(page, "octocat");

		const link = page.getByRole("link", { name: "@octocat" });
		await expect(link).toHaveAttribute("href", "https://github.com/octocat");
		await expect(link).toHaveAttribute("target", "_blank");
		await expect(page.getByText("The Octocat")).toBeVisible();
		await expect(
			page.locator('img[src*="avatars.githubusercontent.com"]')
		).toBeVisible();
	});

	test("AC6: empty profile fields are not shown", async ({ page }) => {
		await page.route(LOOKUP_ROUTE, fulfillProfile);
		await openSignedIn(page);

		await search(page, "ghost-user");

		const link = page.getByRole("link", { name: "@ghost-user" });
		await expect(link).toBeVisible();
		await expect(link.locator("..").locator("p")).toHaveCount(0);
	});

	test("AC8: a lookup error appears once, with no toast", async ({ page }) => {
		await page.route(LOOKUP_ROUTE, (route) =>
			route.fulfill({
				headers: CORS_HEADERS,
				json: [
					{
						error: {
							code: -32_004,
							data: { code: "NOT_FOUND", httpStatus: HTTP_NOT_FOUND },
							message: NOT_FOUND_MESSAGE,
						},
					},
				],
				status: HTTP_NOT_FOUND,
			})
		);
		await openSignedIn(page);

		await search(page, "missing-user");

		await expect(
			page.getByRole("alert").filter({ hasText: NOT_FOUND_MESSAGE })
		).toHaveCount(1);
		// Count once, without retrying: a retrying assertion would wait out the
		// toast's 4s lifetime and pass even when a duplicate toast was shown.
		await page.waitForTimeout(TOAST_SETTLE_MS);
		expect(await page.locator("[data-sonner-toast]").count()).toBe(0);
		expect(await page.getByText(NOT_FOUND_MESSAGE).count()).toBe(1);
	});

	test("AC9: searching shows progress and disables the button", async ({
		page,
	}) => {
		const { promise: released, resolve: release } =
			Promise.withResolvers<void>();
		await page.route(LOOKUP_ROUTE, async (route) => {
			await released;
			await fulfillProfile(route);
		});
		await openSignedIn(page);

		await search(page, "ghost-user");

		await expect(
			page.getByRole("status").filter({ hasText: SEARCHING })
		).toBeVisible();
		await expect(
			page.getByRole("button", { exact: true, name: "搜索" })
		).toBeDisabled();

		release();
		await expect(
			page.getByRole("status").filter({ hasText: SEARCHING })
		).toHaveCount(0);
		await expect(
			page.getByRole("button", { exact: true, name: "搜索" })
		).toBeEnabled();
	});
});
