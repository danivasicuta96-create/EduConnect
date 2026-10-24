import { col, COLLECTIONS, newId } from "@/lib/db/mongo";

/**
 * Append an audit event. Metadata must contain identifiers and counts only —
 * never notes, check-in content, scores, or credentials. Audit logs are
 * append-only: no service updates or deletes them (except retention cleanup).
 */
export async function audit(event: {
  schoolId: string | null;
  actorId: string | null;
  action: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, string | number | boolean | null>;
}): Promise<void> {
  await (await col(COLLECTIONS.auditLogs)).insertOne({
    _id: newId() as never,
    school_id: event.schoolId,
    actor_id: event.actorId,
    action: event.action,
    resource_type: event.resourceType ?? null,
    resource_id: event.resourceId ?? null,
    metadata: event.metadata ?? {},
    created_at: new Date(),
  });
}
