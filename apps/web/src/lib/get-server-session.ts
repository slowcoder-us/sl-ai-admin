import { headers } from "next/headers";

import { authClient } from "./auth-client";

/**
 * Validates the session against the auth server by forwarding the incoming
 * request's cookies. Any failure (no session, server unreachable) counts as
 * signed out, so protected pages fail closed.
 */
export async function getServerSession() {
	try {
		const { data } = await authClient.getSession({
			fetchOptions: { headers: await headers() },
		});
		return data;
	} catch {
		return null;
	}
}
