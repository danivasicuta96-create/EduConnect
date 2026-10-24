import Link from "next/link";
import type { Metadata } from "next";
import { ChevronRight, CircleCheck, Filter, UserCheck } from "lucide-react";
import { requirePermission, requireUser } from "@/lib/auth/session";
import { formatDate, timeAgo } from "@/lib/dates";
import { ALERT_STATUS_LABELS, SEVERITY_LABELS } from "@/lib/constants";
import { PERMS, alertFilterSchema, listAlerts, listRuleOptions } from "@/lib/services/counselor";
import { Avatar, Card, EmptyState, LinkButton, PageHeader, buttonClass } from "@/components/ui";
import { Label, Select } from "@/components/forms";
import { DecisionSupportDisclaimer, SeverityBadge, StatusBadge, param, sourceLabel } from "../_components/shared";

export const metadata: Metadata = { title: "Alert queue" };

export default async function AlertQueue({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireUser(["counselor"]);
  const user = await requirePermission(PERMS.alerts);
  const sp = await searchParams;
  const filters = alertFilterSchema.parse({
    status: param(sp.status),
    severity: param(sp.severity),
    source: param(sp.source),
    assigned: param(sp.assigned),
  });
  const [alerts, rules] = await Promise.all([listAlerts(user, filters), listRuleOptions(user)]);
  const filtered = filters.status !== "active" || filters.severity !== "all" || filters.source !== "all" || filters.assigned !== "all";

  return (
    <div className="space-y-6 animate-fade-up">
      <PageHeader
        title="Alert queue"
        description="Each item means a support follow-up is suggested. Review the context, then decide what — if anything — is needed."
      />
      <DecisionSupportDisclaimer compact />

      <Card>
        <form method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:items-end" aria-label="Filter alerts">
          <div>
            <Label htmlFor="f-status">Status</Label>
            <Select id="f-status" name="status" defaultValue={filters.status}>
              <option value="active">All unresolved</option>
              {Object.entries(ALERT_STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              <option value="all">Everything</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="f-severity">Severity</Label>
            <Select id="f-severity" name="severity" defaultValue={filters.severity}>
              <option value="all">Any severity</option>
              {Object.entries(SEVERITY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
          </div>
          <div>
            <Label htmlFor="f-source">Source</Label>
            <Select id="f-source" name="source" defaultValue={filters.source}>
              <option value="all">Any source</option>
              <option value="self_referral">Student asked to talk</option>
              <option value="rule">Any automated rule</option>
              {rules.map((r) => <option key={r.id} value={r.id}>Rule: {r.name}</option>)}
            </Select>
          </div>
          <div>
            <Label htmlFor="f-assigned">Assigned</Label>
            <Select id="f-assigned" name="assigned" defaultValue={filters.assigned}>
              <option value="all">Anyone</option>
              <option value="me">Assigned to me</option>
              <option value="unassigned">Unassigned</option>
            </Select>
          </div>
          <div className="flex gap-2">
            <button type="submit" className={buttonClass("primary", "md", "flex-1")}>
              <Filter className="size-4" aria-hidden /> Apply
            </button>
            {filtered && <LinkButton href="/counselor/alerts" variant="ghost">Reset</LinkButton>}
          </div>
        </form>
      </Card>

      <section aria-label="Alerts">
        <p className="mb-2 text-sm text-ink-500" aria-live="polite">
          {alerts.length === 200 ? "Showing the first 200 alerts" : `${alerts.length} alert${alerts.length === 1 ? "" : "s"}`}
        </p>
        {alerts.length === 0 ? (
          <EmptyState icon={CircleCheck} title={filtered ? "No alerts match these filters" : "The queue is clear"}>
            {filtered ? "Try widening the filters." : "No support follow-ups are waiting for review right now."}
          </EmptyState>
        ) : (
          <ul className="space-y-2">
            {alerts.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/counselor/alerts/${a.id}`}
                  className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-[var(--shadow-card)] ring-1 ring-ink-100 transition hover:ring-brand-300 sm:flex-row sm:items-center"
                >
                  <span className="flex min-w-0 flex-1 items-start gap-3">
                    <Avatar name={a.studentName} color={a.studentColor} size="sm" />
                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-ink-900">
                        Support follow-up suggested · {a.studentName}
                        {a.className && <span className="font-normal text-ink-500"> · {a.className}</span>}
                      </span>
                      <span className="mt-0.5 block text-xs text-ink-600">{sourceLabel(a.source, a.ruleName)}</span>
                      <span className="mt-0.5 block text-xs text-ink-500">
                        {a.windowStart && a.windowEnd ? <>Data from {formatDate(a.windowStart)} – {formatDate(a.windowEnd)} · </> : null}
                        Created {formatDate(a.createdAt, { day: "numeric", month: "short", year: "numeric" })} ({timeAgo(a.createdAt)})
                        {a.assignedToName && (
                          <> · <UserCheck className="inline size-3.5 align-[-2px]" aria-hidden /> {a.assignedToMe ? "You" : a.assignedToName}</>
                        )}
                      </span>
                    </span>
                  </span>
                  <span className="flex items-center gap-2 sm:flex-col sm:items-end">
                    <SeverityBadge severity={a.severity} />
                    <StatusBadge status={a.status} />
                  </span>
                  <ChevronRight className="hidden size-4 shrink-0 text-ink-400 sm:block" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
