import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Context } from "../context";
import { appRouter } from "./index";

const GITHUB_TIMEOUT_MS = 5000;
const HTTP_OK = 200;

const RATE_LIMITED = "GitHub 查询暂时受限，请稍后重试";
const UNAVAILABLE = "暂时无法读取 GitHub 资料，请稍后重试";

const githubUser = {
	avatar_url: "https://avatars.githubusercontent.com/u/583231?v=4",
	bio: "bio",
	id: 583_231,
	location: "San Francisco",
	login: "octocat",
	name: "The Octocat",
};

const fetchMock = vi.fn<typeof fetch>();

function caller(signedIn = true) {
	const session = signedIn ? { user: { id: "user-1" } } : null;
	return appRouter.createCaller({
		db: {},
		session,
	} as unknown as Context).githubProfiles;
}

function respondWith(body: unknown, status = HTTP_OK) {
	fetchMock.mockResolvedValue(Response.json(body, { status }));
}

beforeEach(() => {
	fetchMock.mockReset();
	vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe("githubProfiles.lookup", () => {
	it("returns the mapped public profile", async () => {
		respondWith(githubUser);

		await expect(caller().lookup("octocat")).resolves.toEqual({
			avatarUrl: githubUser.avatar_url,
			bio: "bio",
			githubId: "583231",
			location: "San Francisco",
			name: "The Octocat",
			username: "octocat",
		});
		expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
			"https://api.github.com/users/octocat"
		);
	});

	it("uses the login returned by GitHub", async () => {
		respondWith(githubUser);

		const profile = await caller().lookup("OCTOCAT");

		expect(profile.username).toBe("octocat");
	});

	it("keeps empty profile fields as null", async () => {
		respondWith({ ...githubUser, bio: null, location: null, name: null });

		await expect(caller().lookup("octocat")).resolves.toMatchObject({
			bio: null,
			location: null,
			name: null,
		});
	});

	it("drops avatars that are not hosted by GitHub", async () => {
		respondWith({
			...githubUser,
			avatar_url: "https://example.com/avatar.png",
		});

		const profile = await caller().lookup("octocat");

		expect(profile.avatarUrl).toBeNull();
	});

	it.each([
		[404, "NOT_FOUND", "找不到该 GitHub 用户"],
		[403, "TOO_MANY_REQUESTS", RATE_LIMITED],
		[429, "TOO_MANY_REQUESTS", RATE_LIMITED],
		[500, "BAD_GATEWAY", UNAVAILABLE],
	])("maps GitHub status %i to %s", async (status, code, message) => {
		respondWith({ message: "error" }, status);

		await expect(caller().lookup("octocat")).rejects.toMatchObject({
			code,
			message,
		});
	});

	it("reports a timeout and gives GitHub 5 seconds", async () => {
		const timeout = vi.spyOn(AbortSignal, "timeout");
		fetchMock.mockRejectedValue(new DOMException("timed out", "TimeoutError"));

		await expect(caller().lookup("octocat")).rejects.toMatchObject({
			code: "BAD_GATEWAY",
			message: UNAVAILABLE,
		});
		expect(timeout).toHaveBeenCalledWith(GITHUB_TIMEOUT_MS);
	});

	it("reports a network failure", async () => {
		fetchMock.mockRejectedValue(new TypeError("fetch failed"));

		await expect(caller().lookup("octocat")).rejects.toMatchObject({
			code: "BAD_GATEWAY",
			message: UNAVAILABLE,
		});
	});

	it.each([
		["a body of the wrong shape", Response.json({ login: "octocat" })],
		["a body that is not JSON", new Response("<html>")],
	])("reports %s", async (_label, response) => {
		fetchMock.mockResolvedValue(response);

		await expect(caller().lookup("octocat")).rejects.toMatchObject({
			code: "BAD_GATEWAY",
			message: UNAVAILABLE,
		});
	});

	it("rejects signed-out callers without calling GitHub", async () => {
		await expect(caller(false).lookup("octocat")).rejects.toMatchObject({
			code: "UNAUTHORIZED",
		});
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("rejects an invalid username without calling GitHub", async () => {
		await expect(caller().lookup("-abc")).rejects.toMatchObject({
			code: "BAD_REQUEST",
		});
		expect(fetchMock).not.toHaveBeenCalled();
	});
});
