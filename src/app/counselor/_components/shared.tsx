// Presentational helpers shared by the counselor pages. Server-component safe.
import Link from "next/link";
import { Info, ShieldAlert } from "lucide-react";
import { Badge, Notice, cx, type Tone } from "@/components/ui";
import { ALERT_STATUS_LABELS, SEVERITY_LABELS } from "@/lib/constants";

const SEVERITY_TONE: Record<string, Tone> = { info: "blue", attention: "amber", urgent: "red" };
const STATUS_TONE: Record<string, Tone> = { open: "pink", acknowledged: "violet", in_progress: "blue", resolved: "green" };
const SESSION_TONE: Record<string, Tone> = { proposed: "amber", accepted: "green", declined: "neutral", completed: "blue", cancelled: "neutral" };

export function SeverityBadge({ severity }: { severity: string }) {
  return <Badge tone={SEVERITY_TONE[severity] ?? "neutral"}>{SEVERITY_LABELS[severity] ?? severity}</Badge>;
}

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={STATUS_TONE[status] ?? "neutral"}>{ALERT_STATUS_LABELS[status] ?? status}</Badge>;
}

export function SessionStatusBadge({ status, label }: { status: string; label: string }) {
  return <Badge tone={SESSION_TONE[status] ?? "neutral"}>{label}</Badge>;
}

/** Neutral description of where an alert came from. */
export function sourceLabel(source: string, ruleName: string | null): string {
  if (source === "self_referral") return "Student asked to talk";
  return ruleName ? `Rule: ${ruleName}` : "Automated rule";
}

/** Shown wherever alerts are listed or reviewed. */
export function DecisionSupportDisclaimer({ compact = false }: { compact?: boolean }) {
  return (
    <Notice tone="amber" icon={Info} title={compact ? undefined : "Alerts are decision-support tools"}>
      {compact ? (
        <>Alerts are decision-support tools — not a diagnosis, and not a substitute for professional assessment.</>
      ) : (
        <>
          An alert means a configurable rule noticed a pattern in a student&apos;s self-reported check-ins, or a student asked to talk.
          It is <strong>not a diagnosis</strong> and <strong>not a substitute for professional assessment</strong>. Use your own
          judgement, talk with the student, and follow your school&apos;s procedures.
        </>
      )}
    </Notice>
  );
}

export function SafeguardingGuidance() {
  return (
    <Notice tone="blue" icon={ShieldAlert} title="Follow your school's safeguarding policy">
      <ul className="mt-1 list-disc space-y-1 pl-4">
        <li>EduConnect never contacts parents or guardians automatically. Decide on any contact with the family according to your school&apos;s safeguarding policy and the student&apos;s best interests.</li>
        <li>If you believe a student is in immediate danger, follow your school&apos;s emergency procedure and call <strong>112</strong>.</li>
        <li>Concerns about abuse or neglect can be reported to the national child protection line <strong>119</strong>.</li>
        <li>Record facts and actions in follow-ups; keep opinions and third-party details to a minimum.</li>
      </ul>
    </Notice>
  );
}

/** Pill-style links for query-string filters (keeps working without JavaScript). */
export function FilterPills({ label, items }: { label: string; items: Array<{ href: string; label: string; active: boolean; count?: number }> }) {
  return (
    <nav aria-label={label} className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex w-max gap-1 rounded-2xl bg-white p-1 ring-1 ring-ink-100">
        {items.map((i) => (
          <li key={i.href}>
            <Link
              href={i.href}
              aria-current={i.active ? "page" : undefined}
              className={cx(
                "block rounded-xl px-3.5 py-2 text-sm font-semibold whitespace-nowrap transition-colors",
                i.active ? "bg-brand-600 text-white" : "text-ink-600 hover:bg-ink-50",
              )}
            >
              {i.label}
              {i.count !== undefined && <span className="ml-1.5 opacity-80">({i.count})</span>}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** First value of a search param. */
export function param(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}
