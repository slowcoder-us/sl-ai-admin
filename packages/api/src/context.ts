import type { Session } from "@sl-ai-admin/auth";
import type { Database } from "@sl-ai-admin/db";

export type Context = {
  session: Session | null;
  db: Database;
};
