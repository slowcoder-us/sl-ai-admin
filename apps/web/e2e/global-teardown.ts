import { execFileSync } from "node:child_process";

import { TEMP_USER_PREFIX, TEST_ACCOUNT } from "./helpers";

/**
 * Leaves only the shared `test` account behind: deletes every throwaway user
 * (their accounts and sessions cascade) and the sessions the run opened for
 * `test`. Runs through the db package's Prisma CLI so it uses the same
 * DATABASE_URL as the server.
 */
export default function globalTeardown() {
	const tempEmailPattern = `${TEMP_USER_PREFIX.replaceAll("_", "\\_")}%`;
	const sql = `
DELETE FROM "user" WHERE email LIKE '${tempEmailPattern}';
DELETE FROM "session" WHERE "userId" IN (SELECT id FROM "user" WHERE username = '${TEST_ACCOUNT.username}');
`;
	execFileSync(
		"pnpm",
		["-F", "@sl-ai-admin/db", "exec", "prisma", "db", "execute", "--stdin"],
		{ input: sql, stdio: ["pipe", "ignore", "inherit"] }
	);
}
