import type { Metadata } from "next";
import { Plus, RefreshCw, SlidersHorizontal, TriangleAlert } from "lucide-react";
import { requirePermission, requireUser } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/dates";
import { PERMS, listRules, type RuleItem } from "@/lib/services/counselor";
import { ActionButton } from "@/components/forms";
import { Badge, Card, CardHeader, EmptyState, Notice, PageHeader } from "@/components/ui";
import { SeverityBadge } from "../_components/shared";
import { toggleRuleAction } from "./actions";
import { ReevaluateForm, RuleForm } from "./forms";

export const metadata: Metadata = { title: "Alert rules" };

function describe(r: RuleItem): string {
  if (r.kind === "consecutive_low") {
    return `Last ${r.consecutiveCount} check-ins within ${r.windowDays} days all at or below ${r.threshold}/10 · min. ${r.minCheckins} check-ins`;
  }
  return `Average over ${r.windowDays} days below ${r.threshold}/10 · min. ${r.minCheckins} check-ins`;
}

export default async function RulesPage() {
  await requireUser(["counselor"]);
  const user = await requirePermission(PERMS.rules);
  const rules = await listRules(user);

  return (
    <div className="space-y-6 animate-fade-up">
      <PageHeader
        title="Alert rules"
        description="Rules decide when a support follow-up is suggested, based on students' self-reported check-ins."
      />

      <Notice tone="amber" icon={TriangleAlert} title="The default rules are examples — review them against your school's policy">
        The rules installed with EduConnect are illustrative starting points. They are <strong>not clinically validated thresholds</strong>, and
        no rule can detect or diagnose a condition. Agree the rules with your safeguarding lead before relying on them. Every change is logged.
      </Notice>

      <Card>
        <CardHeader
          title="Re-evaluate now"
          icon={RefreshCw}
          subtitle="Runs every enabled rule for every student in your school. Students who already have an unresolved alert are not alerted twice; a recently resolved rule waits for its cool-down."
        />
        <ReevaluateForm />
      </Card>

      <section aria-labelledby="rules-heading" className="space-y-3">
        <h2 id="rules-heading" className="text-lg font-bold text-ink-900">Configured rules</h2>
        {rules.length === 0 ? (
          <EmptyState icon={SlidersHorizontal} title="No rules configured">No automated follow-ups will be suggested until a rule is added. Students can still ask to talk.</EmptyState>
        ) : (
          <ul className="space-y-3">
            {rules.map((r) => (
              <li key={r.id}>
                <Card className={r.enabled ? undefined : "opacity-80"}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 font-bold text-ink-900">
                        {r.name}
                        <SeverityBadge severity={r.severity} />
                        {r.enabled ? <Badge tone="green">Enabled</Badge> : <Badge>Disabled</Badge>}
                      </p>
                      <p className="mt-1 text-sm text-ink-600">{describe(r)}</p>
                      <p className="mt-0.5 text-xs text-ink-500">
                        {r.openAlerts} unresolved alert{r.openAlerts === 1 ? "" : "s"} · last changed {formatDateTime(r.updatedAt)}
                        {r.updatedByName ? ` by ${r.updatedByName}` : " (installed default)"}
                      </p>
                    </div>
                    <ActionButton
                      action={toggleRuleAction}
                      hidden={{ ruleId: r.id, enabled: r.enabled ? "false" : "true" }}
                      variant={r.enabled ? "ghost" : "soft"}
                      confirm={r.enabled ? "Disable this rule? It will stop suggesting new follow-ups. Existing alerts are kept." : undefined}
                    >
                      {r.enabled ? "Disable" : "Enable"}
                    </ActionButton>
                  </div>
                  <details className="group mt-4 border-t border-ink-100 pt-3">
                    <summary className="cursor-pointer text-sm font-semibold text-brand-700 hover:underline">Edit rule</summary>
                    <div className="mt-4">
                      <RuleForm rule={r} />
                    </div>
                  </details>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Card>
        <CardHeader title="Add a rule" icon={Plus} subtitle="New rules apply to future check-ins, or now if you re-evaluate." />
        <RuleForm />
      </Card>
    </div>
  );
}
