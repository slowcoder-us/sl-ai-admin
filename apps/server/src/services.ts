import { createAuth } from "@sl-ai-admin/auth";
import { createPrismaClient } from "@sl-ai-admin/db";
import { createAwsDatabaseOptions } from "./database-url";
import { ENV } from "./env.server";

export const db = createPrismaClient(ENV, createAwsDatabaseOptions());
export const auth = createAuth(ENV, db);
