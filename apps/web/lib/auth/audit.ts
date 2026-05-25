import type { Kysely } from "kysely";

import type { DB } from "../db/types.gen";

export interface AuditEntry {
  userId?: number | null;
  action: string;
  target?: string | null;
  meta?: unknown;
}

/**
 * Append-only audit record for sensitive actions (auth events, admin/source
 * changes) — spec §10. `meta` is stored as jsonb.
 */
export async function writeAudit(db: Kysely<DB>, entry: AuditEntry): Promise<void> {
  await db
    .insertInto("audit_log")
    .values({
      user_id: entry.userId ?? null,
      action: entry.action,
      target: entry.target ?? null,
      // pg parses a JSON string into the jsonb column; a JS string is a valid Json.
      meta_jsonb: entry.meta != null ? JSON.stringify(entry.meta) : null,
    })
    .execute();
}
