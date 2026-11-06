const forwardedHeaders = ["accept", "content-type", "cookie", "origin"];

export async function proxyAwsApi(request: Request) {
	const origin = process.env.AWS_API_ORIGIN;
	if (!origin) {
		return new Response("API origin is unavailable", { status: 503 });
	}

	const incoming = new URL(request.url);
	const upstream = new URL(origin);
	upstream.pathname = incoming.pathname;
	upstream.search = incoming.search;
	const headers = new Headers();
	for (const name of forwardedHeaders) {
		const value = request.headers.get(name);
		if (value !== null) {
			headers.set(name, value);
		}
	}

	const body = request.method === "POST" ? await request.arrayBuffer() : null;
	const response = await fetch(upstream, {
		body,
		cache: "no-store",
		headers,
		method: request.method,
		redirect: "manual",
	}).catch(() => new Response("API origin is unavailable", { status: 502 }));
	const responseHeaders = new Headers(response.headers);
	responseHeaders.delete("content-encoding");
	responseHeaders.delete("content-length");
	responseHeaders.set("cache-control", "private, no-store");
	return new Response(response.body, {
		headers: responseHeaders,
		status: response.status,
	});
}
