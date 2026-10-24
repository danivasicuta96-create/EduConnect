// Small server-safe presentational helpers shared by the admin pages.
import { Badge, type Tone } from "@/components/ui";
import { formatDateTime } from "@/lib/dates";
import { safeMetadata, type AuditRow } from "@/lib/services/admin";

export const ACCOUNT_STATE: Record<string, { label: string; tone: Tone }> = {
  active: { label: "Active", tone: "green" },
  pending_guardian_consent: { label: "Awaiting consent", tone: "amber" },
  suspended: { label: "Suspended", tone: "red" },
};

export function AccountStateBadge({ state }: { state: string }) {
  const s = ACCOUNT_STATE[state] ?? { label: state, tone: "neutral" as Tone };
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export const SUBSCRIPTION_STATUS: Record<string, { label: string; tone: Tone }> = {
  trialing: { label: "Trial", tone: "blue" },
  active: { label: "Active", tone: "green" },
  past_due: { label: "Past due", tone: "amber" },
  cancelled: { label: "Cancelled", tone: "red" },
};

export function money(cents: number, currency = "EUR") {
  return new Intl.NumberFormat("en-IE", { style: "currency", currency, maximumFractionDigits: cents % 100 === 0 ? 0 : 2 }).format(cents / 100);
}

export function shortId(id: string | null) {
  if (!id) return "—";
  return id.length > 12 ? `${id.slice(0, 8)}…` : id;
}

/** Metadata rendered as identifier / count chips only. */
export function MetadataChips({ metadata }: { metadata: unknown }) {
  const items = safeMetadata(metadata);
  if (items.length === 0) return <span className="text-ink-400">—</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {items.map(([k, v]) => (
        <code key={k} className="rounded-md bg-ink-50 px-1.5 py-0.5 text-[11px] text-ink-700 ring-1 ring-ink-100" title={`${k}: ${v}`}>
          {k}={v.length > 14 && /^[0-9a-f-]{36}$/.test(v) ? shortId(v) : v}
        </code>
      ))}
    </span>
  );
}

export function AuditList({ rows }: { rows: AuditRow[] }) {
  return (
    <ul className="divide-y divide-ink-50">
      {rows.map((r) => (
        <li key={r.id} className="flex flex-col gap-1 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <code className="text-sm font-semibold text-ink-900">{r.action}</code>
            <p className="truncate text-xs text-ink-500">
              {r.actor_name ?? (r.actor_id ? "Former user" : "System")}
              {r.resource_type && <> · {r.resource_type} {shortId(r.resource_id)}</>}
            </p>
          </div>
          <time dateTime={r.created_at} className="shrink-0 text-xs text-ink-500">{formatDateTime(r.created_at)}</time>
        </li>
      ))}
    </ul>
  );
}
