import { fileURLToPath } from "node:url";
import { handle } from "hono/aws-lambda";

import { createAwsDatabaseUrl } from "./database-url";

process.chdir(fileURLToPath(new URL("../", import.meta.url)));
process.env.DATABASE_URL = createAwsDatabaseUrl();

const { default: app } = await import("./app");
export const handler = handle(app);
