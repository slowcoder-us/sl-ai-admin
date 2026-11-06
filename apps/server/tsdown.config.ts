import { defineConfig } from "tsdown";

export default defineConfig({
	clean: true,
	deps: {
		alwaysBundle: [/@sl-ai-admin\/.*/],
	},
	entry: ["./src/index.ts", "./src/lambda.ts", "./src/migrate.ts"],
	format: "esm",
	outDir: "./dist",
});
