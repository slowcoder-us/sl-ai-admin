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

function caller(signedIn = true, db: unknown = {}, userId = "user-1") {
	const session = signedIn ? { user: { id: userId } } : null;
	return appRouter.createCaller({
		db,
		session,
	} as unknown as Context).githubProfiles;
}

/** Applies the same (ownerId, githubId) uniqueness as the real table. */
function createDb() {
	const saved = new Set<string>();
	const createMany = vi.fn(
		({ data }: { data: { githubId: string; ownerId: string } }) => {
			const key = `${data.ownerId}:${data.githubId}`;
			const count = saved.has(key) ? 0 : 1;
			saved.add(key);
			return Promise.resolve({ count });
		}
	);
	const findMany = vi.fn(() => Promise.resolve([{ id: "profile-1" }]));
	return { githubProfile: { createMany, findMany } };
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

describe("githubProfiles.add", () => {
	it("saves the latest GitHub profile under the signed-in account", async () => {
		const db = createDb();
		respondWith({ ...githubUser, name: "Renamed Cat" });

		await caller(true, db).add("OCTOCAT");

		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(db.githubProfile.createMany).toHaveBeenCalledWith({
			data: {
				avatarUrl: githubUser.avatar_url,
				bio: "bio",
				githubId: "583231",
				location: "San Francisco",
				name: "Renamed Cat",
				ownerId: "user-1",
				username: "octocat",
			},
			skipDuplicates: true,
		});
	});

	it("reports a repeated save as CONFLICT", async () => {
		const db = createDb();
		respondWith(githubUser);
		await caller(true, db).add("octocat");

		respondWith(githubUser);
		await expect(caller(true, db).add("octocat")).rejects.toMatchObject({
			code: "CONFLICT",
			message: "该用户已保存",
		});
	});

	it("treats a renamed GitHub user as the same user", async () => {
		const db = createDb();
		respondWith(githubUser);
		await caller(true, db).add("octocat");

		respondWith({ ...githubUser, login: "octocat-renamed" });
		await expect(caller(true, db).add("octocat-renamed")).rejects.toMatchObject(
			{ code: "CONFLICT" }
		);
	});

	it("lets different accounts save the same GitHub user", async () => {
		const db = createDb();
		respondWith(githubUser);
		await caller(true, db, "user-a").add("octocat");

		respondWith(githubUser);
		await expect(
			caller(true, db, "user-b").add("octocat")
		).resolves.toBeUndefined();
	});

	it.each([
		[404, "NOT_FOUND", "找不到该 GitHub 用户"],
		[403, "TOO_MANY_REQUESTS", RATE_LIMITED],
		[500, "BAD_GATEWAY", UNAVAILABLE],
	])(
		"passes GitHub status %i through as %s without saving",
		async (status, code, message) => {
			const db = createDb();
			respondWith({ message: "error" }, status);

			await expect(caller(true, db).add("octocat")).rejects.toMatchObject({
				code,
				message,
			});
			expect(db.githubProfile.createMany).not.toHaveBeenCalled();
		}
	);

	it("rejects signed-out callers without calling GitHub or saving", async () => {
		const db = createDb();

		await expect(caller(false, db).add("octocat")).rejects.toMatchObject({
			code: "UNAUTHORIZED",
		});
		expect(fetchMock).not.toHaveBeenCalled();
		expect(db.githubProfile.createMany).not.toHaveBeenCalled();
	});
});

describe("githubProfiles.list", () => {
	it("returns only the current account's records, newest first", async () => {
		const db = createDb();

		await expect(caller(true, db).list()).resolves.toEqual([
			{ id: "profile-1" },
		]);
		expect(db.githubProfile.findMany).toHaveBeenCalledWith({
			orderBy: [{ createdAt: "desc" }, { id: "desc" }],
			where: { ownerId: "user-1" },
		});
	});

	it("rejects signed-out callers", async () => {
		const db = createDb();

		await expect(caller(false, db).list()).rejects.toMatchObject({
			code: "UNAUTHORIZED",
		});
		expect(db.githubProfile.findMany).not.toHaveBeenCalled();
	});
});
