import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { createPrismaClient } from "@sl-ai-admin/db";

import { ensureApplicationDatabase } from "./bootstrap-database";
import {
	createAwsDatabaseOptions,
	createAwsDatabaseUrl,
	createMigrationDatabaseUrl,
} from "./database-url";

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

	await ensureApplicationDatabase();
	const databaseUrl = await createMigrationDatabaseUrl();
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

	const db = createPrismaClient(
		{ DATABASE_URL: createAwsDatabaseUrl() },
		createAwsDatabaseOptions()
	);
	try {
		await db.$transaction(async (tx) => {
			await tx.$executeRaw`
				DO $$ BEGIN
					IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'sl_ai_app') THEN
						CREATE ROLE sl_ai_app LOGIN;
					END IF;
				END $$`;
			await tx.$executeRaw`GRANT rds_iam TO sl_ai_app`;
			await tx.$executeRaw`GRANT USAGE ON SCHEMA public TO sl_ai_app`;
			await tx.$executeRaw`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO sl_ai_app`;
			await tx.$executeRaw`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO sl_ai_app`;
			await tx.$executeRaw`REVOKE ALL ON TABLE public."_prisma_migrations" FROM sl_ai_app`;
		});
	} finally {
		await db.$disconnect();
	}
}
