import Link from "next/link";
import type { Metadata } from "next";
import {
  GraduationCap, UsersRound, School, MailPlus, ShieldCheck, CreditCard, History, Info, ChevronRight, UserRoundCheck,
} from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getDashboard, FUNDING_LABELS } from "@/lib/services/admin";
import { formatDate } from "@/lib/dates";
import { Badge, Card, CardHeader, EmptyState, LinkButton, Notice, PageHeader, ProgressBar, Stat } from "@/components/ui";
import { AuditList, SUBSCRIPTION_STATUS } from "./_shared";

export const metadata: Metadata = { title: "School dashboard" };

export default async function AdminDashboard() {
  const user = await requireUser(["admin"]);
  const d = await getDashboard(user);
  const sub = d.subscription;
  const seatsUsed = d.counts.students;
  const status = sub ? SUBSCRIPTION_STATUS[sub.status] ?? { label: sub.status, tone: "neutral" as const } : null;

  return (
    <div className="space-y-6 animate-fade-up">
      <PageHeader
        eyebrow={user.schoolName}
        title="School dashboard"
        description="Accounts, structure, consent and subscription at a glance."
        actions={<LinkButton href="/admin/users#invite" size="sm"><MailPlus className="size-4" aria-hidden /> Invite users</LinkButton>}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Students" value={d.counts.students} icon={GraduationCap} hint={`${d.counts.parents} parent / guardian accounts`} />
        <Stat label="Staff" value={d.counts.staff} icon={UsersRound} tone="blue" hint="Teachers, counselors & admins" />
        <Stat label="Classes" value={d.classes} icon={School} tone="violet" />
        <Stat
          label="Pending invitations"
          value={d.pendingInvitations}
          icon={MailPlus}
          tone="amber"
          hint={d.counts.suspended > 0 ? `${d.counts.suspended} suspended account${d.counts.suspended === 1 ? "" : "s"}` : "No suspended accounts"}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card>
          <CardHeader title="Consent" icon={ShieldCheck} subtitle="Students waiting for guardian consent" />
          {d.counts.pending_consent === 0 ? (
            <EmptyState icon={UserRoundCheck} title="All caught up">Every student account has the consent it needs to be active.</EmptyState>
          ) : (
            <div className="space-y-3">
              <p className="text-3xl font-extrabold text-ink-900">{d.counts.pending_consent}</p>
              <p className="text-sm text-ink-600">
                {d.counts.pending_consent === 1 ? "student account is" : "student accounts are"} limited until a parent or guardian&apos;s consent is recorded.
              </p>
              <LinkButton href="/admin/consent?filter=pending" variant="soft" size="sm">Review consent</LinkButton>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="Subscription" icon={CreditCard} action={<Link href="/admin/subscription" className="text-sm font-semibold text-brand-700 hover:underline">Manage</Link>} />
          {!sub ? (
            <EmptyState title="No subscription on record">Contact EduConnect support to set one up.</EmptyState>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-lg font-bold text-ink-900">{sub.plan_name}</p>
                {status && <Badge tone={status.tone}>{status.label}</Badge>}
              </div>
              <p className="text-sm text-ink-600">
                {sub.billing_cycle === "annual" ? "Annual" : "Monthly"} · {FUNDING_LABELS[sub.funding_source as keyof typeof FUNDING_LABELS] ?? sub.funding_source} · renews {formatDate(sub.current_period_end, { day: "numeric", month: "short", year: "numeric" })}
              </p>
              <div>
                <div className="mb-1 flex justify-between text-xs font-semibold text-ink-600">
                  <span>Seats used</span>
                  <span>{seatsUsed} / {sub.seats}</span>
                </div>
                <ProgressBar value={seatsUsed} max={Math.max(1, sub.seats)} label="Seats used" tone={seatsUsed > sub.seats * 0.9 ? "amber" : "green"} />
              </div>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="Quick links" icon={ChevronRight} />
          <ul className="space-y-1 text-sm">
            {[
              ["/admin/users", "Users, roles & permissions"],
              ["/admin/classes", "Classes, subjects & timetable"],
              ["/admin/audit", "Security & audit log"],
              ["/admin/settings", "Data retention & configuration"],
            ].map(([href, label]) => (
              <li key={href}>
                <Link href={href} className="flex items-center justify-between rounded-lg px-2 py-2 font-semibold text-ink-700 hover:bg-ink-50">
                  {label} <ChevronRight className="size-4 text-ink-400" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader title="Recent audit events" icon={History} action={<Link href="/admin/audit" className="text-sm font-semibold text-brand-700 hover:underline">Full log</Link>} />
          {d.recent.length === 0 ? <EmptyState title="No events yet" /> : <AuditList rows={d.recent} />}
        </Card>
      </div>

      <Notice tone="blue" icon={Info} title="Privacy by design">
        Wellbeing check-ins, notes and alerts are not part of the administrator view. Only staff you explicitly grant a wellbeing permission
        can review them, and every such access is logged.
      </Notice>
    </div>
  );
}
