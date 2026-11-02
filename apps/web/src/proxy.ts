import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Optimistic check only: a missing session cookie means signed out, so skip
 * rendering and go straight to /login. Pages still validate the session
 * themselves, because a present cookie may be expired.
 */
export function proxy(request: NextRequest) {
	if (getSessionCookie(request)) {
		return NextResponse.next();
	}
	return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
	matcher: ["/dashboard/:path*"],
};
