import { auditFilterSchema, type AuditFilter } from "@/lib/services/admin";

type Params = Record<string, string | string[] | undefined> | URLSearchParams;

/** Shared by the audit page and the CSV export so both apply identical filters. */
export function parseAuditParams(sp: Params): AuditFilter {
  const get = (k: string) => {
    const v = sp instanceof URLSearchParams ? sp.get(k) : sp[k];
    return typeof v === "string" && v.trim() ? v.trim() : undefined;
  };
  return auditFilterSchema.parse({ action: get("prefix") ?? get("action") ?? "", from: get("from"), to: get("to") });
}

export function auditQuery(f: AuditFilter): string {
  const u = new URLSearchParams();
  if (f.action) u.set("action", f.action);
  if (f.from) u.set("from", f.from);
  if (f.to) u.set("to", f.to);
  const s = u.toString();
  return s ? `?${s}` : "";
}
