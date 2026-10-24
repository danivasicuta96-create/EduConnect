import type { Metadata } from "next";
import { Check, CreditCard, Info, Receipt, Settings2 } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { FUNDING_LABELS, getSubscription } from "@/lib/services/admin";
import { formatDate } from "@/lib/dates";
import { Badge, Card, CardHeader, EmptyState, Notice, PageHeader, ProgressBar, Table, Td, Th, cx, type Tone } from "@/components/ui";
import { SUBSCRIPTION_STATUS, money } from "../_shared";
import { SubscriptionForm } from "./forms";

export const metadata: Metadata = { title: "Subscription" };

const FEATURE_LABELS: Record<string, string> = {
  student_app: "Student app",
  checkins: "Daily wellbeing check-ins",
  matchmaking: "Peer matchmaking & study groups",
  teacher_dashboard: "Teacher dashboards",
  counselor_dashboard: "Counselor tools & alert queue",
  ai_tutor: "AI tutor",
  wellbeing_assistant: "Wellbeing assistant",
  audit_logs: "Audit logs & CSV export",
  advanced_analytics: "Advanced academic analytics",
  premium_reports: "Personal development reports",
  relaxation_library: "Extended relaxation library",
};

const BILLING_TONE: Record<string, Tone> = { draft: "neutral", issued: "blue", paid: "green", void: "red" };
const longDate = (d: string) => formatDate(d, { day: "numeric", month: "short", year: "numeric" });

export default async function SubscriptionPage() {
  const user = await requireUser(["admin"]);
  const { current, plans, billing, students } = await getSubscription(user);
  const plan = plans.find((p) => p.id === current?.plan_id) ?? null;
  const status = current ? SUBSCRIPTION_STATUS[current.status] ?? { label: current.status, tone: "neutral" as Tone } : null;

  return (
    <div className="space-y-6 animate-fade-up">
      <PageHeader title="Subscription" description="Your school's plan, seats and billing records." />

      <Notice tone="amber" icon={Info} title="Payment processing isn't configured">
        Plan and billing-cycle changes are recorded and documented with a <strong>draft</strong> billing record, but no payment is taken.
        No payment details are needed for this demo. Billing never uses or depends on any wellbeing data.
      </Notice>

      {!current || !plan ? (
        <Card><EmptyState icon={CreditCard} title="No subscription on record">Contact EduConnect support to set up your school&apos;s subscription.</EmptyState></Card>
      ) : (
        <div className="grid gap-5 lg:grid-cols-5">
          <Card className="lg:col-span-2">
            <CardHeader title="Current plan" icon={CreditCard} />
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-2xl font-extrabold text-ink-900">{plan.name}</p>
                {status && <Badge tone={status.tone}>{status.label}</Badge>}
              </div>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div><dt className="text-ink-500">Billing cycle</dt><dd className="font-semibold">{current.billing_cycle === "annual" ? "Annual" : "Monthly"}</dd></div>
                <div><dt className="text-ink-500">Price</dt><dd className="font-semibold">{money(current.billing_cycle === "annual" ? plan.price_annual_cents : plan.price_monthly_cents, plan.currency)} / {current.billing_cycle === "annual" ? "year" : "month"}</dd></div>
                <div><dt className="text-ink-500">Funding source</dt><dd className="font-semibold">{FUNDING_LABELS[current.funding_source] ?? current.funding_source}</dd></div>
                <div><dt className="text-ink-500">{current.status === "trialing" ? "Trial ends" : "Current period ends"}</dt><dd className="font-semibold">{longDate(current.current_period_end)}</dd></div>
              </dl>
              <div>
                <div className="mb-1 flex justify-between text-xs font-semibold text-ink-600">
                  <span>Student seats used</span>
                  <span>{students} / {current.seats}</span>
                </div>
                <ProgressBar value={students} max={Math.max(1, current.seats)} label="Student seats used" tone={students > current.seats ? "amber" : "green"} />
                {students > current.seats && <p className="mt-1 text-xs text-amber-800">You have more student accounts than seats. Increase seats below.</p>}
                {plan.max_students !== null && <p className="mt-1 text-xs text-ink-500">This plan supports up to {plan.max_students} students.</p>}
              </div>
            </div>
          </Card>

          <Card className="lg:col-span-3">
            <CardHeader title="Change plan or billing" icon={Settings2} subtitle="Changes take effect immediately in the demo" />
            <SubscriptionForm
              plans={plans.map((p) => ({ id: p.id, name: p.name, max: p.max_students }))}
              current={{ planId: current.plan_id, billingCycle: current.billing_cycle, fundingSource: current.funding_source, seats: current.seats }}
              minSeats={students}
            />
          </Card>
        </div>
      )}

      <section aria-labelledby="plans-heading">
        <h2 id="plans-heading" className="mb-3 text-lg font-bold text-ink-900">Compare plans</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {plans.map((p) => {
            const isCurrent = p.id === current?.plan_id;
            return (
              <Card key={p.id} className={cx("flex flex-col", isCurrent && "ring-2 ring-brand-500")}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="text-lg font-bold text-ink-900">{p.name}</h3>
                  {isCurrent && <Badge tone="brand">Current plan</Badge>}
                </div>
                <p className="text-sm text-ink-600">{p.description}</p>
                <p className="mt-3 text-2xl font-extrabold text-ink-900">
                  {p.price_monthly_cents === 0 ? "Free" : money(p.price_monthly_cents, p.currency)}
                  {p.price_monthly_cents > 0 && <span className="text-sm font-semibold text-ink-500"> / month</span>}
                </p>
                {p.price_annual_cents > 0 && <p className="text-xs text-ink-500">or {money(p.price_annual_cents, p.currency)} / year</p>}
                <p className="mt-1 text-xs font-semibold text-ink-600">{p.max_students ? `Up to ${p.max_students} students` : "Unlimited students"}</p>
                <ul className="mt-3 space-y-1.5 text-sm">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
                      <span>{FEATURE_LABELS[f] ?? f}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}
        </div>
      </section>

      <Card>
        <CardHeader title="Billing records" icon={Receipt} />
        {billing.length === 0 ? (
          <EmptyState icon={Receipt} title="No billing records yet" />
        ) : (
          <Table>
            <thead>
              <tr><Th>Description</Th><Th>Period</Th><Th>Amount</Th><Th>Status</Th></tr>
            </thead>
            <tbody>
              {billing.map((b) => (
                <tr key={b.id}>
                  <Td className="font-semibold">{b.description}</Td>
                  <Td className="whitespace-nowrap text-xs text-ink-600">{longDate(b.period_start)} – {longDate(b.period_end)}</Td>
                  <Td className="whitespace-nowrap">{money(b.amount_cents, b.currency)}</Td>
                  <Td><Badge tone={BILLING_TONE[b.status] ?? "neutral"}>{b.status[0].toUpperCase() + b.status.slice(1)}</Badge></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
