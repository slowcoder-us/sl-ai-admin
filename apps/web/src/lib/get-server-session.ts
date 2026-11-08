import { createAuthClient } from "better-auth/client";
import { headers } from "next/headers";

/**
 * Validates the session against the auth server by forwarding the incoming
 * request's cookies. Any failure (no session, server unreachable) counts as
 * signed out, so protected pages fail closed.
 */
export async function getServerSession() {
	try {
		const baseURL =
			process.env.AWS_API_ORIGIN ?? process.env.NEXT_PUBLIC_SERVER_URL;
		const cookie = (await headers()).get("cookie");
		if (!(baseURL && cookie)) {
			return null;
		}
		const { data } = await createAuthClient({ baseURL }).getSession({
			fetchOptions: { cache: "no-store", headers: { cookie } },
		});
		return data;
	} catch {
		return null;
	}
}
