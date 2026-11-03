import { request } from "@playwright/test";

import { signUpViaApi, TEST_ACCOUNT } from "./helpers";

/** Makes sure the shared `test` account exists before any spec runs. */
export default async function globalSetup() {
	const api = await request.newContext();
	try {
		const response = await signUpViaApi(
			api,
			TEST_ACCOUNT.username,
			TEST_ACCOUNT.password
		);
		if (response.ok()) {
			return;
		}
		const body = await response.json();
		if (body.code !== "USERNAME_IS_ALREADY_TAKEN") {
			throw new Error(
				`Could not create the shared test account: ${response.status()} ${JSON.stringify(body)}`
			);
		}
	} finally {
		await api.dispose();
	}
}
