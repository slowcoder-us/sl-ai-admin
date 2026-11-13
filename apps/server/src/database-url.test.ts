import assert from "node:assert/strict";
import { test } from "node:test";
import { Signer } from "@aws-sdk/rds-signer";
import { createDatabasePoolConfig } from "@sl-ai-admin/db";
import {
	createAwsDatabaseOptions,
	createAwsDatabaseUrl,
	createMigrationDatabaseUrl,
} from "./database-url";

const env = {
	AWS_REGION: "ap-southeast-2",
	DB_AUTH_MODE: "iam",
	DB_HOST: "example.cluster-example.ap-southeast-2.rds.amazonaws.com",
	DB_NAME: "sl_ai_admin",
	DB_USER: "sl_ai_app",
};
const incompleteConfiguration = /configuration is incomplete/;

test("IAM pool refreshes its token for each new connection without URI overrides", async (t) => {
	let requests = 0;
	t.mock.method(Signer.prototype, "getAuthToken", () => {
		requests += 1;
		return Promise.resolve(`test-token-${requests}`);
	});
	const url = createAwsDatabaseUrl(env);
	assert.equal(new URL(url).password, "");
	const config = createDatabasePoolConfig(
		{ DATABASE_URL: url },
		createAwsDatabaseOptions(env)
	);
	assert.equal(config.connectionString, undefined);
	assert.equal(config.connectionTimeoutMillis, 20_000);
	assert.equal(config.host, env.DB_HOST);
	assert.equal(config.user, env.DB_USER);
	assert.deepEqual(config.ssl, { rejectUnauthorized: true });
	assert.equal(requests, 0);
	assert.equal(typeof config.password, "function");
	if (typeof config.password !== "function") {
		throw new Error("Missing dynamic IAM password provider");
	}
	assert.equal(await config.password(), "test-token-1");
	assert.equal(await config.password(), "test-token-2");
});

test("migration URL encodes the fresh token and requires full TLS verification", async (t) => {
	const token =
		"test-token?X-Amz-Credential=test%2Fregion&X-Amz-Security-Token=test%2Bvalue%3D";
	t.mock.method(Signer.prototype, "getAuthToken", async () => token);
	const url = new URL(await createMigrationDatabaseUrl(env));
	assert.equal(decodeURIComponent(url.password), token);
	assert.equal(url.searchParams.get("sslmode"), "require");
	assert.equal(url.searchParams.get("sslaccept"), "strict");
	assert.equal(url.searchParams.get("connect_timeout"), "30");
	assert.equal(url.searchParams.has("sslrootcert"), false);
});

test("local password connections keep their existing URL configuration", () => {
	const databaseUrl =
		"postgresql://postgres:local-test@localhost:5432/sl_ai_admin";
	assert.deepEqual(createAwsDatabaseOptions({}), {});
	assert.equal(
		createDatabasePoolConfig({ DATABASE_URL: databaseUrl }).connectionString,
		databaseUrl
	);
	assert.equal(
		createDatabasePoolConfig({ DATABASE_URL: databaseUrl })
			.connectionTimeoutMillis,
		5000
	);
});

test("incomplete IAM configuration fails before requesting credentials", () => {
	assert.throws(
		() => createAwsDatabaseOptions({ DB_AUTH_MODE: "iam" }),
		incompleteConfiguration
	);
});
