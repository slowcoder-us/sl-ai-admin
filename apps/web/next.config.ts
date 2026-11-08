import path from "node:path";
import { varlockNextConfigPlugin } from "@varlock/nextjs-integration/plugin";
import type { NextConfig } from "next";

const withVarlock = varlockNextConfigPlugin();

const nextConfig: NextConfig = {
	outputFileTracingRoot: path.join(import.meta.dirname, "../.."),
	reactCompiler: true,
	typedRoutes: true,
};

export default withVarlock(nextConfig);
