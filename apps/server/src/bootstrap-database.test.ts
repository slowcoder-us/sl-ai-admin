import assert from "node:assert/strict";
import { test } from "node:test";
import type { ClientConfig } from "pg";
import { ensureApplicationDatabase } from "./bootstrap-database";

const env = {
	AWS_REGION: "ap-southeast-2",
	DB_AUTH_MODE: "iam",
	DB_HOST: "example.cluster-example.ap-southeast-2.rds.amazonaws.com",
	DB_NAME: "sl_ai_admin",
	DB_USER: "postgres",
};

function fixture(exists = false, createError?: Error) {
	const calls: string[] = [];
	let config: ClientConfig | undefined;
	return {
		calls,
		createConnection: (options: ClientConfig) => {
			config = options;
			return {
				connect: () => {
					calls.push("connect");
					return Promise.resolve();
				},
				end: () => {
					calls.push("end");
					return Promise.resolve();
				},
				query: (text: string) => {
					calls.push(text);
					if (text.startsWith("CREATE DATABASE") && createError) {
						return Promise.reject(createError);
					}
					return Promise.resolve({
						rows: exists ? [{ datname: "sl_ai_admin" }] : [],
					});
				},
			};
		},
		getConfig: () => config,
	};
}

test("bootstrap connects to postgres over IAM before creating the business database", async () => {
	const db = fixture();
	await ensureApplicationDatabase(env, db.createConnection);
	assert.equal(db.getConfig()?.database, "postgres");
	assert.equal(db.getConfig()?.host, env.DB_HOST);
	assert.equal(db.getConfig()?.connectionString, undefined);
	assert.equal(db.getConfig()?.connectionTimeoutMillis, 30_000);
	assert.equal(typeof db.getConfig()?.password, "function");
	assert.deepEqual(db.getConfig()?.ssl, { rejectUnauthorized: true });
	assert.deepEqual(db.calls, [
		"connect",
		"SELECT datname FROM pg_database WHERE datname = 'sl_ai_admin'",
		"CREATE DATABASE sl_ai_admin",
		"end",
	]);
});

test("bootstrap reuses an existing business database", async () => {
	const db = fixture(true);
	await ensureApplicationDatabase(env, db.createConnection);
	assert.equal(
		db.calls.some((query) => query.startsWith("CREATE DATABASE")),
		false
	);
	assert.equal(db.calls.at(-1), "end");
});

test("bootstrap tolerates concurrent creation of the same database", async () => {
	const db = fixture(
		false,
		Object.assign(new Error("duplicate database"), { code: "42P04" })
	);
	await ensureApplicationDatabase(env, db.createConnection);
	assert.equal(db.calls.at(-1), "end");
});

test("bootstrap preserves database failures and closes the admin connection", async () => {
	const failure = new Error("permission denied");
	const db = fixture(false, failure);
	await assert.rejects(
		ensureApplicationDatabase(env, db.createConnection),
		failure
	);
	assert.equal(db.calls.at(-1), "end");
});

test("bootstrap refuses local or unexpected database configuration", async () => {
	const db = fixture();
	await assert.rejects(ensureApplicationDatabase({}, db.createConnection));
	await assert.rejects(
		ensureApplicationDatabase({ ...env, DB_NAME: "other" }, db.createConnection)
	);
	assert.deepEqual(db.calls, []);
});
