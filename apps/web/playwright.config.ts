import { defineConfig, devices } from "@playwright/test";

const WEB_URL = "http://localhost:3001";
const SERVER_URL = "http://localhost:3000";
const SERVER_START_TIMEOUT_MS = 120_000;
// next dev compiles each route on first visit, which can exceed the 5s default
const ASSERTION_TIMEOUT_MS = 15_000;

export default defineConfig({
	expect: { timeout: ASSERTION_TIMEOUT_MS },
	forbidOnly: Boolean(process.env.CI),
	fullyParallel: true,
	projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
	reporter: "list",
	retries: 0,
	testDir: "./e2e",
	use: {
		baseURL: WEB_URL,
		trace: "retain-on-failure",
	},
	webServer: [
		{
			command: "pnpm -F server dev",
			reuseExistingServer: true,
			timeout: SERVER_START_TIMEOUT_MS,
			url: SERVER_URL,
		},
		{
			command: "pnpm -F web dev",
			reuseExistingServer: true,
			timeout: SERVER_START_TIMEOUT_MS,
			url: WEB_URL,
		},
	],
});
