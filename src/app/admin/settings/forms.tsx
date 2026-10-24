"use client";

import { RefreshCw, Trash2 } from "lucide-react";
import { ActionForm, Field, Input, Select, SubmitButton } from "@/components/forms";
import { SEVERITY_LABELS } from "@/lib/constants";
import { regenerateJoinCodeAction, runCleanupAction, saveAlertRule, saveRetention, saveSchoolInfo } from "./actions";

export function SchoolInfoForm({ name, timezone, timezones }: { name: string; timezone: string; timezones: string[] }) {
  return (
    <ActionForm action={saveSchoolInfo}>
      {(state) => (
        <div className="space-y-4">
          <Field label="School name" error={state.errors?.name}>
            {(id) => <Input id={id} name="name" defaultValue={name} required minLength={2} maxLength={160} />}
          </Field>
          <Field label="Time zone" hint="(used for school-local dates)" error={state.errors?.timezone}>
            {(id) => (
              <Select id={id} name="timezone" defaultValue={timezone}>
                {timezones.map((tz) => <option key={tz} value={tz}>{tz.replaceAll("_", " ")}</option>)}
              </Select>
            )}
          </Field>
          <SubmitButton size="sm" pendingText="Saving…">Save details</SubmitButton>
        </div>
      )}
    </ActionForm>
  );
}

export function RegenerateCodeForm() {
  return (
    <ActionForm action={regenerateJoinCodeAction}>
      <SubmitButton
        variant="secondary"
        size="sm"
        pendingText="Generating…"
        onClick={(e) => {
          if (!window.confirm("Generate a new school code? The current code stops working immediately; invitation codes aren't affected.")) e.preventDefault();
        }}
      >
        <RefreshCw className="size-4" aria-hidden /> Regenerate code
      </SubmitButton>
    </ActionForm>
  );
}

export function RetentionForm({ wellbeingDays, auditDays }: { wellbeingDays: number; auditDays: number }) {
  return (
    <ActionForm action={saveRetention}>
      {(state) => (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Wellbeing check-ins & notes" hint="(days)" error={state.errors?.wellbeingRetentionDays}>
              {(id) => <Input id={id} name="wellbeingRetentionDays" type="number" min={30} max={3650} defaultValue={wellbeingDays} required />}
            </Field>
            <Field label="Audit log" hint="(days)" error={state.errors?.auditRetentionDays}>
              {(id) => <Input id={id} name="auditRetentionDays" type="number" min={180} max={3650} defaultValue={auditDays} required />}
            </Field>
          </div>
          <SubmitButton size="sm" pendingText="Saving…">Save retention</SubmitButton>
        </div>
      )}
    </ActionForm>
  );
}

export function CleanupForm() {
  return (
    <ActionForm action={runCleanupAction}>
      <SubmitButton
        variant="danger"
        size="sm"
        pendingText="Cleaning up…"
        onClick={(e) => {
          if (!window.confirm("Permanently delete check-ins, notes and audit events older than the retention windows? This can't be undone.")) e.preventDefault();
        }}
      >
        <Trash2 className="size-4" aria-hidden /> Run retention cleanup now
      </SubmitButton>
    </ActionForm>
  );
}

export interface RuleFormValues {
  id: string;
  name: string;
  kind: "window_average" | "consecutive_low";
  window_days: number;
  threshold: number;
  consecutive_count: number | null;
  min_checkins: number;
  severity: string;
  enabled: boolean;
}

export function AlertRuleForm({ rule }: { rule: RuleFormValues }) {
  return (
    <ActionForm action={saveAlertRule}>
      {(state) => (
        <div className="space-y-3">
          <input type="hidden" name="id" value={rule.id} />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold text-ink-900">{rule.name}</p>
            <label className="flex items-center gap-2 text-sm font-semibold text-ink-700">
              <input type="checkbox" name="enabled" defaultChecked={rule.enabled} className="size-4 accent-brand-600" /> Enabled
            </label>
          </div>
          <p className="text-xs text-ink-500">
            {rule.kind === "window_average"
              ? "Flags when the average check-in score over the window falls below the threshold."
              : "Flags when several consecutive check-ins are at or below the threshold."}
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="Threshold" hint="(1–10)" error={state.errors?.threshold}>
              {(id) => <Input id={id} name="threshold" type="number" step="0.1" min={1} max={10} defaultValue={rule.threshold} required />}
            </Field>
            <Field label="Window" hint="(days)" error={state.errors?.windowDays}>
              {(id) => <Input id={id} name="windowDays" type="number" min={3} max={60} defaultValue={rule.window_days} required />}
            </Field>
            {rule.kind === "consecutive_low" ? (
              <Field label="In a row" error={state.errors?.consecutiveCount}>
                {(id) => <Input id={id} name="consecutiveCount" type="number" min={2} max={20} defaultValue={rule.consecutive_count ?? 3} required />}
              </Field>
            ) : (
              <Field label="Min. check-ins" error={state.errors?.minCheckins}>
                {(id) => <Input id={id} name="minCheckins" type="number" min={1} max={60} defaultValue={rule.min_checkins} required />}
              </Field>
            )}
            <Field label="Severity" error={state.errors?.severity}>
              {(id) => (
                <Select id={id} name="severity" defaultValue={rule.severity}>
                  {Object.entries(SEVERITY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </Select>
              )}
            </Field>
          </div>
          {rule.kind === "consecutive_low" && <input type="hidden" name="minCheckins" value={rule.min_checkins} />}
          <SubmitButton variant="secondary" size="sm" pendingText="Saving…">Save rule</SubmitButton>
        </div>
      )}
    </ActionForm>
  );
}
