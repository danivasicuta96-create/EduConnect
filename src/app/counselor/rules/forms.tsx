"use client";

import { RefreshCw } from "lucide-react";
import { ActionForm, Checkbox, Field, Input, Select, SubmitButton } from "@/components/forms";
import { SEVERITY_LABELS } from "@/lib/constants";
import type { RuleItem } from "@/lib/services/counselor";
import { reevaluateAction, saveRuleAction } from "./actions";

export function RuleForm({ rule }: { rule?: RuleItem }) {
  return (
    <ActionForm action={saveRuleAction} resetOnSuccess={!rule} className="space-y-4">
      {(state) => (
        <>
          {rule && <input type="hidden" name="id" value={rule.id} />}
          <Field label="Name" error={state.errors?.name}>
            {(id) => <Input id={id} name="name" required minLength={2} maxLength={80} defaultValue={rule?.name ?? ""} placeholder="e.g. 10-day average below 4 (school policy)" />}
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Rule type" error={state.errors?.kind}>
              {(id) => (
                <Select id={id} name="kind" defaultValue={rule?.kind ?? "window_average"} required>
                  <option value="window_average">Average over a window is below the level</option>
                  <option value="consecutive_low">Several consecutive check-ins at or below the level</option>
                </Select>
              )}
            </Field>
            <Field label="Severity" error={state.errors?.severity}>
              {(id) => (
                <Select id={id} name="severity" defaultValue={rule?.severity ?? "info"} required>
                  {Object.entries(SEVERITY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </Select>
              )}
            </Field>
            <Field label="Window" hint="(days, 3–60)" error={state.errors?.windowDays}>
              {(id) => <Input id={id} name="windowDays" type="number" inputMode="numeric" min={3} max={60} step={1} required defaultValue={rule?.windowDays ?? 7} />}
            </Field>
            <Field label="Level" hint="(1–10, self-reported mood)" error={state.errors?.threshold}>
              {(id) => <Input id={id} name="threshold" type="number" inputMode="decimal" min={1} max={10} step={0.1} required defaultValue={rule?.threshold ?? 5} />}
            </Field>
            <Field label="Consecutive check-ins" hint="(consecutive rules only, 2–20)" error={state.errors?.consecutiveCount}>
              {(id) => <Input id={id} name="consecutiveCount" type="number" inputMode="numeric" min={2} max={20} step={1} defaultValue={rule?.consecutiveCount ?? ""} />}
            </Field>
            <Field label="Minimum check-ins" hint="(in the window)" error={state.errors?.minCheckins}>
              {(id) => <Input id={id} name="minCheckins" type="number" inputMode="numeric" min={1} max={60} step={1} required defaultValue={rule?.minCheckins ?? 3} />}
            </Field>
          </div>
          <Checkbox name="enabled" defaultChecked={rule?.enabled ?? true} label="Enabled" description="Disabled rules are kept but never create alerts." />
          <SubmitButton size="sm" pendingText="Saving…">{rule ? "Save changes" : "Create rule"}</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function ReevaluateForm() {
  return (
    <ActionForm
      action={reevaluateAction}
      className="flex flex-col items-start gap-2"
    >
      <SubmitButton variant="secondary" pendingText="Evaluating…">
        <RefreshCw className="size-4" aria-hidden /> Re-evaluate all students now
      </SubmitButton>
    </ActionForm>
  );
}
