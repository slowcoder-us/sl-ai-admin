import { execFile } from "node:child_process";
import { lookup } from "node:dns/promises";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { promisify } from "node:util";

const requireServer = createRequire(
	new URL("../apps/server/package.json", import.meta.url)
);
const { Client } = requireServer("pg");
const run = promisify(execFile);
const profile = process.env.AWS_PROFILE || "happy-path";
const region = process.env.AWS_REGION || "ap-southeast-2";
const aws = process.env.AWS_CLI_BINARY || "aws";
const expectedAccount = process.env.EXPECTED_AWS_ACCOUNT_ID || "347076820926";
const hostnamePattern = /^[a-zA-Z0-9.-]+\.rds\.amazonaws\.com$/;
let phase = "metadata";
const started = Date.now();
let client;

function progress(nextPhase) {
	phase = nextPhase;
	console.info(`${phase}: ${Date.now() - started}ms`);
}

async function awsOutput(args) {
	try {
		const { stdout } = await run(
			aws,
			[...args, "--profile", profile, "--region", region, "--no-cli-pager"],
			{ maxBuffer: 64 * 1024, timeout: 20_000 }
		);
		return stdout.trim();
	} catch {
		// Do not include child output in errors: a successful signing operation's
		// stdout contains the temporary IAM credential.
		// biome-ignore lint/style/useErrorCause: Child errors can contain the temporary IAM token in stdout.
		throw new Error(
			"AWS CLI failed; check the selected profile and login session"
		);
	}
}

try {
	const metadata = JSON.parse(
		await readFile(
			process.env.AURORA_METADATA_FILE || "/tmp/sl-ai-admin-express.json",
			"utf8"
		)
	);
	if (
		!(hostnamePattern.test(metadata.DatabaseHost) && metadata.DatabaseAdminUser)
	) {
		throw new Error("Invalid Aurora connection metadata");
	}
	progress("account-check");
	const account = await awsOutput([
		"sts",
		"get-caller-identity",
		"--query",
		"Account",
		"--output",
		"text",
	]);
	if (account !== expectedAccount) {
		throw new Error("Selected profile points to an unexpected AWS account");
	}
	progress("dns-lookup");
	const addresses = await lookup(metadata.DatabaseHost, { all: true });
	console.info("Local DNS addresses:", addresses);
	client = new Client({
		application_name: "sl-ai-admin-connection-check",
		connectionTimeoutMillis: 30_000,
		database: "postgres",
		host: metadata.DatabaseHost,
		password: async () => {
			progress("iam-token-generation");
			const token = await awsOutput([
				"rds",
				"generate-db-auth-token",
				"--hostname",
				metadata.DatabaseHost,
				"--port",
				"5432",
				"--username",
				metadata.DatabaseAdminUser,
			]);
			progress("database-authentication");
			return token;
		},
		port: 5432,
		ssl: { rejectUnauthorized: true },
		user: metadata.DatabaseAdminUser,
	});
	progress("database-connect");
	await client.connect();
	progress("connection-ready");
	console.info("PASS: IAM login and verified TLS; no SQL was executed.");
} catch (error) {
	console.error("FAIL:", {
		code: error?.code,
		elapsedMs: Date.now() - started,
		message: error instanceof Error ? error.message : "Connection check failed",
		phase,
	});
	process.exitCode = 1;
} finally {
	if (client) {
		await client.end().catch(() => {
			console.error("Connection cleanup failed");
			process.exitCode = 1;
		});
	}
}
