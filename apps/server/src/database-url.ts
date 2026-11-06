export function createAwsDatabaseUrl() {
	const { DB_HOST, DB_NAME, DB_PASSWORD, DB_USER } = process.env;
	if (!(DB_HOST && DB_NAME && DB_PASSWORD && DB_USER)) {
		throw new Error("AWS database configuration is incomplete");
	}
	const url = new URL(`postgresql://${DB_HOST}/${DB_NAME}`);
	url.username = DB_USER;
	url.password = DB_PASSWORD;
	url.searchParams.set("sslmode", "verify-full");
	url.searchParams.set("sslrootcert", "/var/task/rds-ca.pem");
	return url.href;
}
