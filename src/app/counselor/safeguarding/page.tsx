import type { Metadata } from "next";
import { ArrowRight, Flag, ShieldCheck } from "lucide-react";
import { requirePermission, requireUser } from "@/lib/auth/session";
import { formatDateTime, timeAgo } from "@/lib/dates";
import { ROLE_LABELS, type Role } from "@/lib/constants";
import {
  PERMS, REPORT_REASON_LABELS, REPORT_STATUS_LABELS, listSafetyReports, reportFilterSchema,
} from "@/lib/services/counselor";
import { ActionButton } from "@/components/forms";
import { Badge, EmptyState, Notice, PageHeader, type Tone } from "@/components/ui";
import { FilterPills, param } from "../_components/shared";
import { setReportStatusAction } from "./actions";

export const metadata: Metadata = { title: "Safety reports" };

const STATUS_TONE: Record<string, Tone> = { open: "pink", reviewing: "blue", closed: "green" };
const FILTERS = [
  { value: "active", label: "Open & under review" },
  { value: "open", label: "Open" },
  { value: "reviewing", label: "Under review" },
  { value: "closed", label: "Closed" },
  { value: "all", label: "All" },
];
const NEXT: Record<string, Array<{ status: string; label: string; variant: "primary" | "soft" | "ghost" }>> = {
  open: [{ status: "reviewing", label: "Start review", variant: "primary" }, { status: "closed", label: "Close", variant: "ghost" }],
  reviewing: [{ status: "closed", label: "Close", variant: "soft" }, { status: "open", label: "Back to open", variant: "ghost" }],
  closed: [{ status: "reviewing", label: "Reopen for review", variant: "ghost" }],
};

export default async function SafeguardingPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireUser(["counselor"]);
  const user = await requirePermission(PERMS.reports);
  const filter = reportFilterSchema.parse(param((await searchParams).status));
  const reports = await listSafetyReports(user, filter);

  return (
    <div className="space-y-6 animate-fade-up">
      <PageHeader
        title="Safety reports"
        description="Bullying, harassment and other concerns that students reported about someone at school."
      />
      <Notice tone="blue" icon={ShieldCheck} title="Handle reports under your school's anti-bullying and safeguarding policy">
        Reporters trusted the school with this — don&apos;t reveal who made a report to the person reported. EduConnect does not contact
        parents automatically. Viewing this list is logged.
      </Notice>
      <FilterPills
        label="Filter reports"
        items={FILTERS.map((f) => ({ href: f.value === "active" ? "/counselor/safeguarding" : `/counselor/safeguarding?status=${f.value}`, label: f.label, active: f.value === filter }))}
      />

      {reports.length === 0 ? (
        <EmptyState icon={Flag} title="No reports here">When a student reports someone, it appears in this list.</EmptyState>
      ) : (
        <ul className="space-y-3">
          {reports.map((r) => (
            <li key={r.id} className="rounded-2xl bg-white p-4 shadow-[var(--shadow-card)] ring-1 ring-ink-100">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2">
                    <Badge tone="amber">{REPORT_REASON_LABELS[r.reason] ?? r.reason}</Badge>
                    <Badge tone={STATUS_TONE[r.status]}>{REPORT_STATUS_LABELS[r.status]}</Badge>
                    <span className="text-xs text-ink-500">{formatDateTime(r.createdAt)} ({timeAgo(r.createdAt)})</span>
                  </p>
                  <p className="mt-2 flex flex-wrap items-center gap-x-2 text-sm text-ink-800">
                    <span><span className="text-ink-500">Reported by</span> <strong>{r.reporterName}</strong> <span className="text-ink-500">({ROLE_LABELS[r.reporterRole as Role] ?? r.reporterRole})</span></span>
                    <ArrowRight className="size-4 text-ink-400" aria-hidden />
                    <span><span className="text-ink-500">about</span> <strong>{r.reportedName}</strong> <span className="text-ink-500">({ROLE_LABELS[r.reportedRole as Role] ?? r.reportedRole})</span></span>
                  </p>
                  {r.reportedOpenReports > 1 && (
                    <p className="mt-1 text-xs font-semibold text-amber-800">{r.reportedOpenReports} unresolved reports concern this person.</p>
                  )}
                  {r.details ? (
                    <p className="mt-2 whitespace-pre-line rounded-xl bg-ink-50 p-3 text-sm text-ink-700">{r.details}</p>
                  ) : (
                    <p className="mt-2 text-sm text-ink-500">No details were given.</p>
                  )}
                </div>
                <div className="flex shrink-0 flex-wrap gap-2 sm:flex-col sm:items-end">
                  {(NEXT[r.status] ?? []).map((n) => (
                    <ActionButton key={n.status} action={setReportStatusAction} hidden={{ reportId: r.id, status: n.status }} variant={n.variant}>
                      {n.label}
                    </ActionButton>
                  ))}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
