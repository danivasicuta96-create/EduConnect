import Link from "next/link";
import type { Metadata } from "next";
import { CalendarClock, MessageSquareText } from "lucide-react";
import { requirePermission, requireUser } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/dates";
import { PERMS, SESSION_STATUS_LABELS, listSessions, sessionFilterSchema } from "@/lib/services/counselor";
import { ActionButton } from "@/components/forms";
import { Avatar, EmptyState, Notice, PageHeader } from "@/components/ui";
import { FilterPills, SessionStatusBadge, param } from "../_components/shared";
import { updateSessionAction } from "./actions";

export const metadata: Metadata = { title: "Support conversations" };

const FILTERS: Array<{ value: string; label: string }> = [
  { value: "upcoming", label: "Open" },
  { value: "proposed", label: "Awaiting reply" },
  { value: "accepted", label: "Accepted" },
  { value: "declined", label: "Declined" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "all", label: "All" },
];

export default async function SessionsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireUser(["counselor"]);
  const user = await requirePermission(PERMS.alerts);
  const filter = sessionFilterSchema.parse(param((await searchParams).status));
  const sessions = await listSessions(user, filter);
  return (
    <div className="space-y-6 animate-fade-up">
      <PageHeader
        title="Support conversations"
        description="Invitations you and your colleagues have offered. Students choose whether to accept — declining is always fine."
      />
      <FilterPills
        label="Filter conversations"
        items={FILTERS.map((f) => ({ href: f.value === "upcoming" ? "/counselor/sessions" : `/counselor/sessions?status=${f.value}`, label: f.label, active: f.value === filter }))}
      />

      {sessions.length === 0 ? (
        <EmptyState icon={CalendarClock} title="No conversations here">
          Offer a support conversation from an alert&apos;s detail page. The student receives a neutral invitation.
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {sessions.map((s) => {
            const open = s.status === "proposed" || s.status === "accepted";
            const hidden = { sessionId: s.id, alertId: s.alertId ?? "" };
            return (
              <li key={s.id} className="rounded-2xl bg-white p-4 shadow-[var(--shadow-card)] ring-1 ring-ink-100">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <Avatar name={s.studentName} color={s.studentColor} size="sm" />
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-ink-900">{s.studentName}</p>
                      <p className="text-sm text-ink-600">
                        {formatDateTime(s.proposedAt)}
                        {s.location ? ` · ${s.location}` : ""}
                        {open && s.isPast && <span className="ml-1 font-semibold text-amber-800">(time has passed)</span>}
                      </p>
                      <p className="text-xs text-ink-500">
                        Offered by {s.mine ? "you" : s.counselorName ?? "a former staff member"}
                        {s.alertId && (
                          <> · <Link href={`/counselor/alerts/${s.alertId}`} className="font-semibold text-brand-700 hover:underline">View alert</Link></>
                        )}
                      </p>
                      {s.studentMessage && (
                        <p className="mt-2 flex gap-2 rounded-xl bg-ink-50 p-2 text-sm text-ink-700">
                          <MessageSquareText className="mt-0.5 size-4 shrink-0 text-ink-400" aria-hidden />
                          <span><span className="sr-only">Student&apos;s message: </span>“{s.studentMessage}”</span>
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-start gap-2 sm:flex-col sm:items-end">
                    <SessionStatusBadge status={s.status} label={SESSION_STATUS_LABELS[s.status] ?? s.status} />
                    {open && (
                      <div className="flex flex-wrap gap-2">
                        {s.status === "accepted" && (
                          <ActionButton action={updateSessionAction} hidden={{ ...hidden, status: "completed" }} variant="soft">
                            Mark completed
                          </ActionButton>
                        )}
                        <ActionButton
                          action={updateSessionAction}
                          hidden={{ ...hidden, status: "cancelled" }}
                          variant="ghost"
                          confirm="Cancel this conversation? The student will get a neutral notification."
                        >
                          Cancel
                        </ActionButton>
                      </div>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Notice tone="neutral">
        Completing a conversation adds a &ldquo;Conversation held&rdquo; entry to the linked alert&apos;s timeline. Record what was agreed as a
        follow-up on the alert — not in the conversation itself.
      </Notice>
    </div>
  );
}
