import { PrismaPg } from "@prisma/adapter-pg";
import type { PoolConfig } from "pg";

import { PrismaClient } from "../prisma/generated/client";
import type { DatabaseConfig } from "./config";

export type DatabaseConnectionOptions = Pick<
	PoolConfig,
	| "host"
	| "port"
	| "user"
	| "database"
	| "password"
	| "ssl"
	| "connectionTimeoutMillis"
>;

export function createDatabasePoolConfig(
	env: DatabaseConfig,
	options: DatabaseConnectionOptions = {}
): PoolConfig {
	return {
		// pg parses a URI after the other options and replaces password callbacks
		// with the URI's empty password. IAM connections must use discrete fields.
		...(typeof options.password === "function"
			? {}
			: { connectionString: env.DATABASE_URL }),
		connectionTimeoutMillis: 5000,
		max: 2,
		...options,
	};
}

export function createPrismaClient(
	env: DatabaseConfig,
	options: DatabaseConnectionOptions = {}
) {
	const adapter = new PrismaPg(createDatabasePoolConfig(env, options));
	return new PrismaClient({ adapter });
}

export type Database = ReturnType<typeof createPrismaClient>;
