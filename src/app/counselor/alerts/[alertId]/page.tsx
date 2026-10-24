import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  ArrowLeft, Bot, CalendarClock, ChartLine, CircleCheck, ClipboardList, History, Lock, MessageSquareText, NotebookPen, UserCheck,
} from "lucide-react";
import { requirePermission, requireUser } from "@/lib/auth/session";
import { addDays, formatDate, formatDateTime, todayIn } from "@/lib/dates";
import {
  FOLLOWUP_ACTION_LABELS, PERMS, SESSION_STATUS_LABELS, getAlertDetail, type AlertDetail,
} from "@/lib/services/counselor";
import { ActionButton } from "@/components/forms";
import { Avatar, Badge, Card, CardHeader, EmptyState, Notice, PageHeader } from "@/components/ui";
import { TrendChart } from "@/components/charts";
import {
  DecisionSupportDisclaimer, SafeguardingGuidance, SessionStatusBadge, SeverityBadge, StatusBadge, sourceLabel,
} from "../../_components/shared";
import { acknowledgeAlertAction, assignToMeAction, markInProgressAction } from "./actions";
import { FollowupForm, OfferSessionForm, ResolveForm } from "./forms";

export const metadata: Metadata = { title: "Alert review" };

/** "YYYY-MM-DDTHH:mm" in the given time zone (for datetime-local inputs). */
function localNow(timeZone: string): string {
  const s = new Intl.DateTimeFormat("sv-SE", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
  return s.replace(" ", "T").slice(0, 16);
}

function ruleDescription(rule: NonNullable<AlertDetail["rule"]>): string {
  if (rule.kind === "consecutive_low") {
    return `The last ${rule.consecutiveCount ?? "?"} check-ins within ${rule.windowDays} days are all at or below ${rule.threshold}/10 (at least ${rule.minCheckins} check-ins needed).`;
  }
  return `The average of check-ins over ${rule.windowDays} days is below ${rule.threshold}/10 (at least ${rule.minCheckins} check-ins needed).`;
}

function ObservedValue({ label, value }: { label: string; value: string | number | undefined | null }) {
  return (
    <div className="rounded-xl bg-ink-50 px-3 py-2">
      <dt className="text-xs font-medium text-ink-500">{label}</dt>
      <dd className="text-lg font-extrabold text-ink-900">{value ?? "—"}</dd>
    </div>
  );
}

export default async function AlertDetailPage({ params }: { params: Promise<{ alertId: string }> }) {
  await requireUser(["counselor"]);
  const user = await requirePermission(PERMS.alerts);
  const { alertId } = await params;
  // Writes the `wellbeing.alert.viewed` audit event.
  const detail = await getAlertDetail(user, alertId);
  if (!detail) notFound();

  const { alert, rule, range, checkins, sharedNotes, followups, sessions, otherAlerts, dataAccessible } = detail;
  const o = alert.observed;
  const isRule = alert.source === "rule";
  const resolved = alert.status === "resolved";
  const hidden = { alertId: alert.id };
  const activeSession = sessions.find((s) => s.status === "proposed" || s.status === "accepted");
  const nowLocal = localNow(user.timezone);
  const defaultWhen = `${addDays(todayIn(user.timezone), 1)}T10:00`;
  const chartData = checkins.map((c) => ({ label: formatDate(c.date), value: c.mood }));

  return (
    <div className="space-y-6 animate-fade-up">
      <Link href="/counselor/alerts" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">
        <ArrowLeft className="size-4" aria-hidden /> Alert queue
      </Link>

      <PageHeader
        eyebrow="Support follow-up suggested"
        title={
          <span className="flex items-center gap-3">
            <Avatar name={alert.studentName} color={alert.studentColor} />
            <span>{alert.studentName}</span>
          </span>
        }
        description={
          <>
            {alert.className ? `Class ${alert.className} · ` : ""}
            {sourceLabel(alert.source, alert.ruleName)} · created {formatDateTime(alert.createdAt)}
          </>
        }
        actions={
          <span className="flex flex-wrap gap-2">
            <SeverityBadge severity={alert.severity} />
            <StatusBadge status={alert.status} />
          </span>
        }
      />

      <DecisionSupportDisclaimer />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {/* ── Observed data ───────────────────────────── */}
          <Card aria-labelledby="observed-heading">
            <CardHeader
              title={<span id="observed-heading">Observed data</span>}
              icon={ChartLine}
              subtitle={
                range.basis === "alert_window"
                  ? `Self-reported check-ins, ${formatDate(range.from)} – ${formatDate(range.to)}`
                  : `Self-reported check-ins in the 14 days before the request (${formatDate(range.from)} – ${formatDate(range.to)})`
              }
            />
            {isRule ? (
              <dl className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
                <ObservedValue label="Average" value={o.average !== undefined ? `${o.average}/10` : null} />
                <ObservedValue label="Check-ins" value={o.checkins} />
                <ObservedValue label="Lowest" value={o.lowest !== undefined ? `${o.lowest}/10` : null} />
                <ObservedValue label="Rule level" value={o.threshold !== undefined ? `${o.threshold}/10` : null} />
                <ObservedValue label="Window" value={o.windowDays !== undefined ? `${o.windowDays} days` : null} />
              </dl>
            ) : (
              <p className="mb-4 text-sm text-ink-600">
                No automated measurement — the student asked a counselor to reach out. Recent check-ins are shown for context only.
              </p>
            )}
            {!dataAccessible ? (
              <Notice tone="neutral" icon={Lock}>
                Individual check-ins are no longer available for this student: access ends 90 days after an alert is resolved.
              </Notice>
            ) : checkins.length === 0 ? (
              <EmptyState icon={ChartLine} title="No check-ins in this period">
                The student didn&apos;t check in during these dates, or the data has passed the school&apos;s retention period.
              </EmptyState>
            ) : (
              <>
                <TrendChart
                  data={chartData}
                  title={`Self-reported mood for ${alert.studentName}, ${formatDate(range.from)} to ${formatDate(range.to)}`}
                  domain={[0, 10]}
                  threshold={isRule ? o.threshold : undefined}
                  thresholdLabel={isRule ? "Rule level" : undefined}
                  height={200}
                  suffix="/10"
                />
                <p className="mt-2 text-xs text-ink-500">
                  Scores are the student&apos;s own 1–10 ratings. Only date and score are shown; factors and private notes stay with the student.
                </p>
              </>
            )}
          </Card>

          {/* ── Automated suggestion / student request ───────────────────────────── */}
          {isRule ? (
            <Card aria-labelledby="suggestion-heading" className="ring-violet-100">
              <CardHeader title={<span id="suggestion-heading">Automated suggestion</span>} icon={Bot} subtitle="What the rule engine concluded — review it, don't rely on it." />
              <p className="text-sm text-ink-800">{alert.summary}</p>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="font-semibold text-ink-700">Rule</dt>
                  <dd className="text-ink-600">
                    {rule ? (
                      <>
                        {rule.name}
                        {!rule.enabled && <Badge className="ml-2">Now disabled</Badge>}
                      </>
                    ) : (
                      "No rule is linked to this alert (it may have been removed)."
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-ink-700">Suggested severity</dt>
                  <dd><SeverityBadge severity={alert.severity} /></dd>
                </div>
                {rule && (
                  <div className="sm:col-span-2">
                    <dt className="font-semibold text-ink-700">Current rule logic</dt>
                    <dd className="text-ink-600">{ruleDescription(rule)}</dd>
                  </div>
                )}
              </dl>
              <p className="mt-4 text-xs text-ink-500">
                Rules are configurable examples, not clinically validated thresholds. The rule may have been edited since this alert was created;
                the observed numbers above are what it saw at the time.
              </p>
            </Card>
          ) : (
            <Card aria-labelledby="request-heading">
              <CardHeader title={<span id="request-heading">Student request</span>} icon={MessageSquareText} subtitle="The student used “Ask a counselor to reach out”." />
              <p className="text-sm text-ink-800">{alert.summary}</p>
            </Card>
          )}

          {/* ── Shared notes ───────────────────────────── */}
          <Card aria-labelledby="notes-heading">
            <CardHeader title={<span id="notes-heading">Notes the student chose to share</span>} icon={NotebookPen} />
            {sharedNotes.length === 0 ? (
              <p className="text-sm text-ink-500">
                The student hasn&apos;t shared any check-in notes from this period. Private notes are never visible to staff.
              </p>
            ) : (
              <ul className="space-y-2">
                {sharedNotes.map((n, i) => (
                  <li key={i} className="rounded-xl bg-blush-50 p-3 text-sm">
                    <p className="text-xs font-semibold text-ink-500">{formatDate(n.date, { weekday: "short", day: "numeric", month: "short" })}</p>
                    <p className="mt-0.5 whitespace-pre-line text-ink-800">{n.note}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* ── Timeline ───────────────────────────── */}
          <Card aria-labelledby="timeline-heading">
            <CardHeader title={<span id="timeline-heading">Timeline</span>} icon={History} subtitle="Follow-ups are permanent and can't be edited or deleted." />
            <ol className="relative space-y-4 border-l border-ink-100 pl-5">
              <li>
                <span className="absolute -left-[5px] mt-1.5 size-2.5 rounded-full bg-brand-500" aria-hidden />
                <p className="text-sm font-semibold text-ink-900">{isRule ? "Alert created by rule evaluation" : "Student asked to talk"}</p>
                <p className="text-xs text-ink-500">{formatDateTime(alert.createdAt)}</p>
              </li>
              {followups.map((f) => (
                <li key={f.id}>
                  <span className="absolute -left-[5px] mt-1.5 size-2.5 rounded-full bg-ink-300" aria-hidden />
                  <p className="text-sm font-semibold text-ink-900">{FOLLOWUP_ACTION_LABELS[f.action] ?? f.action}</p>
                  <p className="text-xs text-ink-500">
                    {f.authorName ?? "Automatic"} · {formatDateTime(f.createdAt)}
                  </p>
                  {f.note && <p className="mt-1 whitespace-pre-line text-sm text-ink-700">{f.note}</p>}
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <div className="space-y-5">
          {/* ── Status & actions ───────────────────────────── */}
          <Card aria-labelledby="status-heading">
            <CardHeader title={<span id="status-heading">Status</span>} icon={ClipboardList} />
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-ink-500">Status</dt><dd><StatusBadge status={alert.status} /></dd></div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-500">Assigned to</dt>
                <dd className="font-semibold text-ink-800">{alert.assignedToMe ? "You" : alert.assignedToName ?? "Nobody yet"}</dd>
              </div>
              {alert.acknowledgedAt && (
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-500">Acknowledged</dt>
                  <dd className="text-right text-ink-800">{alert.acknowledgedByName ?? "—"}<br /><span className="text-xs text-ink-500">{formatDateTime(alert.acknowledgedAt)}</span></dd>
                </div>
              )}
              {alert.resolvedAt && (
                <div className="flex justify-between gap-3"><dt className="text-ink-500">Resolved</dt><dd className="text-ink-800">{formatDateTime(alert.resolvedAt)}</dd></div>
              )}
            </dl>
            {resolved ? (
              <div className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">
                <p className="flex items-center gap-1.5 font-bold"><CircleCheck className="size-4" aria-hidden /> Resolved</p>
                {alert.resolution && <p className="mt-1 whitespace-pre-line">{alert.resolution}</p>}
              </div>
            ) : (
              <div className="mt-4 flex flex-wrap gap-2">
                {alert.status === "open" && <ActionButton action={acknowledgeAlertAction} hidden={hidden} variant="primary">Acknowledge</ActionButton>}
                {(alert.status === "open" || alert.status === "acknowledged") && (
                  <ActionButton action={markInProgressAction} hidden={hidden}>Mark support in progress</ActionButton>
                )}
                {!alert.assignedToMe && (
                  <ActionButton action={assignToMeAction} hidden={hidden}>
                    <UserCheck className="size-4" aria-hidden /> Assign to me
                  </ActionButton>
                )}
              </div>
            )}
          </Card>

          {!resolved && (
            <Card aria-labelledby="offer-heading">
              <CardHeader title={<span id="offer-heading">Offer a support conversation</span>} icon={CalendarClock} />
              {activeSession ? (
                <div className="text-sm">
                  <p className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{formatDateTime(activeSession.proposedAt)}</span>
                    <SessionStatusBadge status={activeSession.status} label={SESSION_STATUS_LABELS[activeSession.status] ?? activeSession.status} />
                  </p>
                  {activeSession.location && <p className="text-ink-600">{activeSession.location}</p>}
                  {activeSession.studentMessage && <p className="mt-2 rounded-xl bg-ink-50 p-2 text-ink-700">“{activeSession.studentMessage}”</p>}
                  <Link href="/counselor/sessions" className="mt-3 inline-block font-semibold text-brand-700 hover:underline">Manage conversations</Link>
                </div>
              ) : (
                <OfferSessionForm alertId={alert.id} defaultWhen={defaultWhen} minWhen={nowLocal} />
              )}
            </Card>
          )}

          <Card aria-labelledby="followup-heading">
            <CardHeader title={<span id="followup-heading">Add a follow-up</span>} icon={NotebookPen} />
            <FollowupForm alertId={alert.id} />
          </Card>

          {!resolved && (
            <Card aria-labelledby="resolve-heading">
              <CardHeader title={<span id="resolve-heading">Resolve</span>} icon={CircleCheck} subtitle="When no further follow-up is needed." />
              <ResolveForm alertId={alert.id} />
            </Card>
          )}

          <SafeguardingGuidance />

          {sessions.length > 0 && (
            <Card aria-labelledby="sessions-heading">
              <CardHeader title={<span id="sessions-heading">Conversations for this alert</span>} icon={CalendarClock} />
              <ul className="space-y-2 text-sm">
                {sessions.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-2">
                    <span>{formatDateTime(s.proposedAt)}</span>
                    <SessionStatusBadge status={s.status} label={SESSION_STATUS_LABELS[s.status] ?? s.status} />
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {otherAlerts.length > 0 && (
            <Card aria-labelledby="other-heading">
              <CardHeader title={<span id="other-heading">Other alerts for this student</span>} icon={History} />
              <ul className="space-y-2 text-sm">
                {otherAlerts.map((a) => (
                  <li key={a.id}>
                    <Link href={`/counselor/alerts/${a.id}`} className="flex items-center justify-between gap-2 rounded-lg p-1 -m-1 hover:bg-ink-50">
                      <span>{formatDate(a.createdAt, { day: "numeric", month: "short", year: "numeric" })} · {a.source === "self_referral" ? "Asked to talk" : "Rule"}</span>
                      <StatusBadge status={a.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
