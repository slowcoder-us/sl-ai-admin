import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../prisma/generated/client";
import type { DatabaseConfig } from "./config";

export function createPrismaClient(env: DatabaseConfig) {
	const adapter = new PrismaPg({
		connectionString: env.DATABASE_URL,
		connectionTimeoutMillis: 5000,
		max: 2,
	});
	return new PrismaClient({ adapter });
}

export type Database = ReturnType<typeof createPrismaClient>;
