import Link from "next/link";
import type { Metadata } from "next";
import {
  BellRing, CalendarClock, ChartLine, ChevronRight, CircleCheck, History, Inbox, Lock, UserCheck,
} from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { formatDate, formatDateTime, timeAgo } from "@/lib/dates";
import { FOLLOWUP_ACTION_LABELS, PERMS, SESSION_STATUS_LABELS, getDashboard, type ActivityItem } from "@/lib/services/counselor";
import { Avatar, Card, CardHeader, EmptyState, LinkButton, Notice, PageHeader, Stat } from "@/components/ui";
import { TrendChart } from "@/components/charts";
import { DecisionSupportDisclaimer, SessionStatusBadge, SeverityBadge, StatusBadge, sourceLabel } from "./_components/shared";

export const metadata: Metadata = { title: "Counselor dashboard" };

function activityText(a: ActivityItem): string {
  if (a.kind === "alert_created") return "New support follow-up suggested";
  return `${FOLLOWUP_ACTION_LABELS[a.kind] ?? "Update"}${a.authorName ? ` · ${a.authorName}` : " · automatic"}`;
}

export default async function CounselorDashboard() {
  const user = await requireUser(["counselor"]);
  const firstName = user.displayName.split(" ")[0];

  if (!user.permissions.includes(PERMS.alerts)) {
    return (
      <div className="space-y-6">
        <PageHeader title={`Welcome, ${firstName}`} description="Counselor workspace" />
        <Notice tone="amber" icon={Lock} title="No access to wellbeing alerts yet">
          Your account doesn&apos;t have the &ldquo;Review wellbeing alerts&rdquo; permission. A school administrator can grant it
          under Users &amp; roles. Access to sensitive records is always logged.
        </Notice>
      </div>
    );
  }

  const d = await getDashboard(user);
  const totalPending = d.bySeverity.urgent + d.bySeverity.attention + d.bySeverity.info;
  const trendPoints = (d.trend?.weekly ?? []).map((w) => ({ label: `w/c ${formatDate(w.week_start)}`, value: w.average }));

  return (
    <div className="space-y-6 animate-fade-up">
      <PageHeader
        eyebrow={formatDate(d.today, { weekday: "long", day: "numeric", month: "long" })}
        title={`Welcome, ${firstName}`}
        description="Support follow-ups, conversations and school-wide trends at a glance."
        actions={<LinkButton href="/counselor/alerts">Open alert queue</LinkButton>}
      />

      <DecisionSupportDisclaimer />

      <section aria-label="Pending alerts by severity" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/counselor/alerts?severity=urgent" className="rounded-2xl focus-visible:outline-3 focus-visible:outline-brand-500">
          <Stat label="Urgent review" value={d.bySeverity.urgent} icon={BellRing} tone="red" hint="Pending, not yet resolved" />
        </Link>
        <Link href="/counselor/alerts?severity=attention" className="rounded-2xl focus-visible:outline-3 focus-visible:outline-brand-500">
          <Stat label="Attention needed" value={d.bySeverity.attention} icon={Inbox} tone="amber" hint={`${d.byStatus.open ?? 0} still open in total`} />
        </Link>
        <Link href="/counselor/alerts?severity=info" className="rounded-2xl focus-visible:outline-3 focus-visible:outline-brand-500">
          <Stat label="Informational" value={d.bySeverity.info} icon={Inbox} tone="blue" />
        </Link>
        <Link href="/counselor/alerts?assigned=me" className="rounded-2xl focus-visible:outline-3 focus-visible:outline-brand-500">
          <Stat label="Assigned to me" value={d.assignedToMe} icon={UserCheck} tone="violet" hint={`${d.resolvedLast30} resolved in the last 30 days`} />
        </Link>
      </section>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Pending follow-ups"
            icon={Inbox}
            subtitle={`${totalPending} not yet resolved`}
            action={<Link href="/counselor/alerts" className="text-sm font-semibold text-brand-700 hover:underline">View all</Link>}
          />
          {d.pending.length === 0 ? (
            <EmptyState icon={CircleCheck} title="Nothing pending">No support follow-ups are waiting for review.</EmptyState>
          ) : (
            <ul className="divide-y divide-ink-50">
              {d.pending.map((a) => (
                <li key={a.id}>
                  <Link href={`/counselor/alerts/${a.id}`} className="flex items-center gap-3 rounded-xl py-3 transition hover:bg-ink-50 sm:px-2">
                    <Avatar name={a.studentName} color={a.studentColor} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-ink-900">
                        {a.studentName}
                        {a.className && <span className="font-normal text-ink-500"> · {a.className}</span>}
                      </span>
                      <span className="block truncate text-xs text-ink-500">
                        {sourceLabel(a.source, a.ruleName)} · {timeAgo(a.createdAt)}
                      </span>
                    </span>
                    <span className="hidden flex-col items-end gap-1 sm:flex">
                      <SeverityBadge severity={a.severity} />
                      <StatusBadge status={a.status} />
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-ink-400" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Upcoming conversations"
            icon={CalendarClock}
            action={<Link href="/counselor/sessions" className="text-sm font-semibold text-brand-700 hover:underline">All</Link>}
          />
          {d.upcoming.length === 0 ? (
            <EmptyState icon={CalendarClock} title="No conversations planned">Offer one from an alert&apos;s detail page.</EmptyState>
          ) : (
            <ul className="space-y-3">
              {d.upcoming.map((s) => (
                <li key={s.id} className="rounded-xl bg-ink-50 p-3">
                  <p className="flex items-center justify-between gap-2 text-sm font-bold text-ink-900">
                    <span className="truncate">{s.studentName}</span>
                    <SessionStatusBadge status={s.status} label={SESSION_STATUS_LABELS[s.status] ?? s.status} />
                  </p>
                  <p className="mt-0.5 text-xs text-ink-600">
                    {formatDateTime(s.proposedAt)}{s.location ? ` · ${s.location}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader
            title="School-wide wellbeing trend"
            icon={ChartLine}
            subtitle="Weekly average self-reported mood (1–10), all students. Weeks with fewer than 5 reporting students are hidden."
            action={d.canAggregate ? <Link href="/counselor/reports" className="text-sm font-semibold text-brand-700 hover:underline">Reports</Link> : undefined}
          />
          {!d.canAggregate ? (
            <Notice tone="neutral" icon={Lock}>Aggregate reports need the &ldquo;View school-wide aggregate wellbeing&rdquo; permission.</Notice>
          ) : !d.trend || d.trend.suppressed ? (
            <EmptyState icon={ChartLine} title="Not enough data yet">
              Trends appear once at least {d.trend?.k ?? 5} students have checked in during the period.
            </EmptyState>
          ) : (
            <>
              <TrendChart data={trendPoints} title="School-wide weekly average mood" />
              <p className="mt-2 text-xs text-ink-500">
                {d.trend.students_reporting} of {d.trend.students_total} students reported in the last 8 weeks · average {d.trend.average ?? "—"}/10.
                Aggregates never show individual students.
              </p>
            </>
          )}
        </Card>

        <Card>
          <CardHeader title="Recent activity" icon={History} />
          {d.activity.length === 0 ? (
            <EmptyState icon={History} title="No activity yet" />
          ) : (
            <ol className="space-y-3">
              {d.activity.map((a) => (
                <li key={`${a.kind}-${a.id}`}>
                  <Link href={`/counselor/alerts/${a.alertId}`} className="block rounded-xl p-2 -m-2 transition hover:bg-ink-50">
                    <p className="text-sm font-semibold text-ink-900">{a.studentName}</p>
                    <p className="text-xs text-ink-500">{activityText(a)} · {timeAgo(a.at)}</p>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>
    </div>
  );
}
