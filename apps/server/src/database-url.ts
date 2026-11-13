import { Signer } from "@aws-sdk/rds-signer";
import type { DatabaseConnectionOptions } from "@sl-ai-admin/db";

export interface DatabaseEnvironment {
	AWS_REGION?: string;
	DB_AUTH_MODE?: string;
	DB_HOST?: string;
	DB_NAME?: string;
	DB_USER?: string;
}

function readDatabaseConfig(env: DatabaseEnvironment) {
	const { AWS_REGION, DB_HOST, DB_NAME, DB_USER } = env;
	if (!(AWS_REGION && DB_HOST && DB_NAME && DB_USER)) {
		throw new Error("AWS database configuration is incomplete");
	}
	return {
		database: DB_NAME,
		hostname: DB_HOST,
		port: 5432,
		region: AWS_REGION,
		username: DB_USER,
	};
}

// Runtime pools call the password provider for every new connection. Never cache
// an IAM token in DATABASE_URL across Lambda invocations.
export function createAwsDatabaseOptions(
	env: DatabaseEnvironment = process.env
): DatabaseConnectionOptions {
	if (env.DB_AUTH_MODE !== "iam") {
		return {};
	}
	const config = readDatabaseConfig(env);
	const signer = new Signer(config);
	return {
		// Express IAM authentication can take longer than five seconds even when
		// TLS and authorization succeed. Keep local connection defaults separate.
		connectionTimeoutMillis: 20_000,
		database: config.database,
		host: config.hostname,
		password: () => signer.getAuthToken(),
		port: config.port,
		ssl: { rejectUnauthorized: true },
		user: config.username,
	};
}

export function createAwsDatabaseUrl(env: DatabaseEnvironment = process.env) {
	const {
		hostname: DB_HOST,
		database: DB_NAME,
		username,
	} = readDatabaseConfig(env);
	const url = new URL(`postgresql://${DB_HOST}/${DB_NAME}`);
	url.username = username;
	return url.href;
}

// The Prisma migration subprocess is short-lived; generate its token immediately
// before launch and pass it only through its environment, never CLI arguments.
export async function createMigrationDatabaseUrl(
	env: DatabaseEnvironment = process.env
) {
	const url = new URL(createAwsDatabaseUrl(env));
	// Tokens already contain percent escapes in their query values. Encode the
	// whole token once more for userinfo so Prisma's URI decode preserves it.
	url.password = encodeURIComponent(
		await new Signer(readDatabaseConfig(env)).getAuthToken()
	);
	// Prisma's native migration engine accepts require + sslaccept=strict;
	// unlike pg, it treats verify-full as an unsupported mode.
	url.searchParams.set("sslmode", "require");
	url.searchParams.set("sslaccept", "strict");
	url.searchParams.set("connect_timeout", "30");
	return url.href;
}
