import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { createPrismaClient } from "@sl-ai-admin/db";

import { createAwsDatabaseUrl } from "./database-url";

const run = promisify(execFile);
const databaseDirectory = fileURLToPath(
	new URL("../../../packages/db/", import.meta.url)
);

export async function handler(event: {
	RequestType: "Create" | "Update" | "Delete";
}) {
	if (event.RequestType === "Delete") {
		return;
	}

	const appPassword = process.env.APP_DB_PASSWORD;
	if (!appPassword) {
		throw new Error("Application database configuration is incomplete");
	}
	const databaseUrl = createAwsDatabaseUrl();
	await run(
		process.execPath,
		["node_modules/prisma/build/index.js", "migrate", "deploy"],
		{
			cwd: databaseDirectory,
			env: { ...process.env, DATABASE_URL: databaseUrl },
		}
	).catch(() => {
		throw new Error("Prisma migrate deploy failed");
	});

	const db = createPrismaClient({ DATABASE_URL: databaseUrl });
	try {
		await db.$transaction(async (tx) => {
			await tx.$executeRaw`
				DO $$ BEGIN
					IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'sl_ai_app') THEN
						CREATE ROLE sl_ai_app LOGIN;
					END IF;
				END $$`;
			const [statement] = await tx.$queryRaw<{ sql: string }[]>`
				SELECT format('ALTER ROLE sl_ai_app PASSWORD %L', ${appPassword}::text) AS sql`;
			if (!statement) {
				throw new Error("Could not prepare application role");
			}
			await tx.$executeRawUnsafe(statement.sql);
			await tx.$executeRaw`GRANT USAGE ON SCHEMA public TO sl_ai_app`;
			await tx.$executeRaw`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO sl_ai_app`;
			await tx.$executeRaw`REVOKE ALL ON TABLE public."_prisma_migrations" FROM sl_ai_app`;
		});
	} finally {
		await db.$disconnect();
	}
}
