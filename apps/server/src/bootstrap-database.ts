import { Client, type ClientConfig } from "pg";
import {
	createAwsDatabaseOptions,
	type DatabaseEnvironment,
} from "./database-url";

interface AdminConnection {
	connect: () => Promise<unknown>;
	end: () => Promise<void>;
	query: (text: string) => Promise<{ rows: unknown[] }>;
}

// Express starts with postgres. Create the application database over SQL before
// Prisma tries to connect to it. CREATE DATABASE must run outside a transaction.
export async function ensureApplicationDatabase(
	env: DatabaseEnvironment = process.env,
	createConnection: (config: ClientConfig) => AdminConnection = (config) =>
		new Client(config)
) {
	if (env.DB_AUTH_MODE !== "iam" || env.DB_NAME !== "sl_ai_admin") {
		throw new Error(
			"Database bootstrap requires the AWS application configuration"
		);
	}
	const client = createConnection({
		...createAwsDatabaseOptions({ ...env, DB_NAME: "postgres" }),
		connectionTimeoutMillis: 30_000,
	});
	let phase = "connect";
	const started = Date.now();
	try {
		await client.connect();
		phase = "check-database";
		const { rows } = await client.query(
			"SELECT datname FROM pg_database WHERE datname = 'sl_ai_admin'"
		);
		if (rows.length === 0) {
			phase = "create-database";
			try {
				await client.query("CREATE DATABASE sl_ai_admin");
			} catch (error) {
				// Another deployment may have created it after the existence check.
				if (
					!(error instanceof Error && "code" in error && error.code === "42P04")
				) {
					throw error;
				}
			}
		}
	} catch (error) {
		console.error("Aurora database bootstrap failed", {
			elapsedMs: Date.now() - started,
			phase,
		});
		throw error;
	} finally {
		await client.end();
	}
}
