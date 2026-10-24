import Link from "next/link";
import type { Metadata } from "next";
import { Check, History, Info, Minus, ShieldCheck, UserRoundCheck, X } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { ALL_CONSENTS, consentHistory, listStudentConsent, type ConsentStatus } from "@/lib/services/admin";
import { canSelfConsent } from "@/lib/services/consent";
import { CONSENT_LABELS } from "@/lib/constants";
import { formatDate, formatDateTime } from "@/lib/dates";
import { Avatar, Badge, Card, CardHeader, EmptyState, Notice, PageHeader, Stat, Table, Td, Th, cx } from "@/components/ui";
import { AccountStateBadge } from "../_shared";
import { RecordConsentForm } from "./forms";

export const metadata: Metadata = { title: "Consent" };

const SHORT: Record<string, string> = {
  platform: "Platform",
  wellbeing_checkins: "Check-ins",
  matchmaking: "Matching",
  ai_features: "AI",
  guardian_access: "Guardian",
};

const METHOD: Record<string, string> = { in_app: "in the app", paper_form: "paper form", school_policy: "school policy" };
const BY: Record<string, string> = { student: "student", guardian: "guardian", admin: "school" };

function ConsentIcon({ status, label }: { status: ConsentStatus; label: string }) {
  if (!status.recordedAt) {
    return <span className="inline-grid size-6 place-items-center rounded-full bg-ink-100 text-ink-400" title={`${label}: not recorded`}><Minus className="size-3.5" aria-hidden /><span className="sr-only">{label}: not recorded</span></span>;
  }
  return status.granted ? (
    <span className="inline-grid size-6 place-items-center rounded-full bg-emerald-50 text-emerald-700" title={`${label}: granted`}><Check className="size-3.5" aria-hidden /><span className="sr-only">{label}: granted</span></span>
  ) : (
    <span className="inline-grid size-6 place-items-center rounded-full bg-red-50 text-red-700" title={`${label}: not granted`}><X className="size-3.5" aria-hidden /><span className="sr-only">{label}: not granted</span></span>
  );
}

export default async function ConsentPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser(["admin"]);
  const sp = await searchParams;
  const filter = sp.filter === "pending" ? "pending" : "all";
  const studentParam = typeof sp.student === "string" ? sp.student : null;
  const students = await listStudentConsent(user);
  const selected = students.find((s) => s.user_id === studentParam) ?? null;
  const history = await consentHistory(user, selected?.user_id ?? null, selected ? 30 : 20);

  const pending = students.filter((s) => s.account_state === "pending_guardian_consent");
  const noCheckins = students.filter((s) => !s.consents.wellbeing_checkins.granted).length;
  const noGuardian = students.filter((s) => !s.consents.guardian_access.granted).length;
  const shown = filter === "pending" ? pending : students;
  const qs = (params: Record<string, string | null>) => {
    const u = new URLSearchParams();
    if (filter === "pending") u.set("filter", "pending");
    for (const [k, v] of Object.entries(params)) {
      if (v === null) u.delete(k);
      else u.set(k, v);
    }
    const s = u.toString();
    return s ? `/admin/consent?${s}` : "/admin/consent";
  };

  return (
    <div className="space-y-6 animate-fade-up">
      <PageHeader
        title="Consent"
        description="Consent status for every student. Record decisions from signed paper forms or school policy; students under 16 need a parent or guardian's consent."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Waiting for guardian consent" value={pending.length} icon={ShieldCheck} tone="amber" hint="Limited accounts" />
        <Stat label="Without check-in consent" value={noCheckins} icon={Info} tone="blue" hint="Check-ins stay switched off" />
        <Stat label="Without guardian access" value={noGuardian} icon={UserRoundCheck} tone="violet" hint="Parents can't see grades" />
      </div>

      {selected && (
        <Card id="record" className="ring-2 ring-brand-200">
          <CardHeader
            title={`Record consent — ${selected.display_name}`}
            icon={ShieldCheck}
            subtitle={<>{selected.class_names ?? "No class"} · <AccountStateBadge state={selected.account_state} /></>}
            action={<Link href={qs({ student: null })} className="text-sm font-semibold text-ink-600 hover:underline">Close</Link>}
          />
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              {selected.account_state === "pending_guardian_consent" && (
                <Notice tone="amber" icon={Info} title="Account waiting for consent">
                  Recording <strong>platform</strong> consent activates the account. Check-ins, matchmaking and AI stay off unless their own consent is granted.
                </Notice>
              )}
              {canSelfConsent(selected.birth_year) && (
                <Notice tone="blue" icon={Info}>
                  This student is 16 or older and can give or withdraw their own consent in the app. Their latest choice always applies.
                </Notice>
              )}
              <ul className="space-y-2">
                {ALL_CONSENTS.map((t) => {
                  const c = selected.consents[t];
                  return (
                    <li key={t} className="flex items-start gap-3 text-sm">
                      <ConsentIcon status={c} label={CONSENT_LABELS[t]} />
                      <span>
                        <span className="block font-semibold text-ink-800">{CONSENT_LABELS[t]}</span>
                        <span className="text-xs text-ink-500">
                          {c.recordedAt ? `${c.granted ? "Granted" : "Not granted"} by ${BY[c.givenByRole ?? ""] ?? c.givenByRole} via ${METHOD[c.method ?? ""] ?? c.method} · ${formatDate(c.recordedAt, { day: "numeric", month: "short", year: "numeric" })}` : "Not recorded"}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
              <p className="text-xs text-ink-500">{selected.guardians} linked guardian account{selected.guardians === 1 ? "" : "s"}.</p>
            </div>
            <div className="rounded-2xl bg-ink-50 p-4">
              <RecordConsentForm
                key={selected.user_id}
                studentId={selected.user_id}
                current={Object.fromEntries(ALL_CONSENTS.map((t) => [t, selected.consents[t].recordedAt ? selected.consents[t].granted : null]))}
              />
            </div>
          </div>
        </Card>
      )}

      <Card>
        <CardHeader
          title="Students"
          icon={UserRoundCheck}
          subtitle={`${shown.length} shown`}
          action={
            <div className="flex gap-1 rounded-xl bg-ink-50 p-1 text-sm" role="group" aria-label="Filter students">
              <Link href="/admin/consent" aria-current={filter === "all" ? "page" : undefined} className={cx("rounded-lg px-3 py-1 font-semibold", filter === "all" ? "bg-white shadow-sm" : "text-ink-600")}>All</Link>
              <Link href="/admin/consent?filter=pending" aria-current={filter === "pending" ? "page" : undefined} className={cx("rounded-lg px-3 py-1 font-semibold", filter === "pending" ? "bg-white shadow-sm" : "text-ink-600")}>Waiting ({pending.length})</Link>
            </div>
          }
        />
        {shown.length === 0 ? (
          <EmptyState icon={UserRoundCheck} title={filter === "pending" ? "Nobody is waiting" : "No students yet"}>
            {filter === "pending" ? "Every student account has platform consent." : "Invite students from the Users page."}
          </EmptyState>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Student</Th>
                <Th>Account</Th>
                {ALL_CONSENTS.map((t) => <Th key={t} className="text-center"><span title={CONSENT_LABELS[t]}>{SHORT[t]}</span></Th>)}
                <Th><span className="sr-only">Actions</span></Th>
              </tr>
            </thead>
            <tbody>
              {shown.map((s) => (
                <tr key={s.user_id} className={cx(s.account_state === "pending_guardian_consent" && "bg-amber-50/50")}>
                  <Td>
                    <span className="flex items-center gap-2">
                      <Avatar name={s.display_name} color={s.avatar_color} size="sm" />
                      <span className="min-w-0">
                        <span className="block font-semibold">{s.display_name}</span>
                        <span className="block text-xs text-ink-500">{s.class_names ?? "No class"}</span>
                      </span>
                    </span>
                  </Td>
                  <Td><AccountStateBadge state={s.account_state} /></Td>
                  {ALL_CONSENTS.map((t) => <Td key={t} className="text-center"><ConsentIcon status={s.consents[t]} label={CONSENT_LABELS[t]} /></Td>)}
                  <Td className="text-right">
                    <Link href={`${qs({ student: s.user_id })}#record`} className="text-sm font-semibold text-brand-700 hover:underline">
                      Record<span className="sr-only"> consent for {s.display_name}</span>
                    </Link>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Card>
        <CardHeader title={selected ? `History — ${selected.display_name}` : "Recent consent history"} icon={History} />
        {history.length === 0 ? (
          <EmptyState title="No consent recorded yet" />
        ) : (
          <ul className="divide-y divide-ink-50">
            {history.map((h) => (
              <li key={h.id} className="flex flex-col gap-1 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between">
                <span className="min-w-0">
                  {!selected && <span className="font-semibold text-ink-900">{h.student_name} · </span>}
                  <span className="text-ink-800">{CONSENT_LABELS[h.consent_type]}</span>{" "}
                  <Badge tone={h.granted ? "green" : "red"}>{h.granted ? "Granted" : "Not granted"}</Badge>
                  <span className="block text-xs text-ink-500">
                    By {BY[h.given_by_role] ?? h.given_by_role} via {METHOD[h.method] ?? h.method}
                    {h.given_by_name && <> · recorded by {h.given_by_name}</>}
                  </span>
                </span>
                <time dateTime={h.recorded_at} className="shrink-0 text-xs text-ink-500">{formatDateTime(h.recorded_at)}</time>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
