"use client";

import { ActionForm, Field, Select, SubmitButton } from "@/components/forms";
import { CONSENT_LABELS } from "@/lib/constants";
import { recordConsentAction } from "./actions";

const TYPES = ["platform", "wellbeing_checkins", "matchmaking", "ai_features", "guardian_access"] as const;

export function RecordConsentForm({ studentId, current }: { studentId: string; current: Record<string, boolean | null> }) {
  return (
    <ActionForm action={recordConsentAction} resetOnSuccess>
      {(state) => (
        <div className="space-y-4">
          <input type="hidden" name="studentId" value={studentId} />
          <Field label="How was consent given?" error={state.errors?.method}>
            {(id) => (
              <Select id={id} name="method" defaultValue="paper_form">
                <option value="paper_form">Signed paper form from a parent / guardian</option>
                <option value="school_policy">School policy decision</option>
              </Select>
            )}
          </Field>
          <fieldset>
            <legend className="mb-2 text-sm font-semibold text-ink-800">Decisions to record</legend>
            <div className="space-y-2">
              {TYPES.map((t) => {
                const now = current[t];
                return (
                  <div key={t} className="flex flex-col gap-2 rounded-xl bg-white p-3 ring-1 ring-ink-100 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-sm">
                      <span className="block font-semibold text-ink-800">{CONSENT_LABELS[t]}</span>
                      <span className="text-xs text-ink-500">Currently: {now === null ? "not recorded" : now ? "granted" : "not granted"}</span>
                    </span>
                    <span role="radiogroup" aria-label={CONSENT_LABELS[t]} className="flex shrink-0 gap-1 rounded-xl bg-ink-50 p-1 text-sm">
                      {([["", "No change"], ["grant", "Granted"], ["withhold", "Refused"]] as const).map(([v, label]) => (
                        <label key={v} className="cursor-pointer">
                          <input type="radio" name={t} value={v} defaultChecked={v === ""} className="peer sr-only" />
                          <span className="block rounded-lg px-2.5 py-1 font-semibold text-ink-600 peer-checked:bg-white peer-checked:text-ink-900 peer-checked:shadow-sm peer-focus-visible:outline-2 peer-focus-visible:outline-brand-500">
                            {label}
                          </span>
                        </label>
                      ))}
                    </span>
                  </div>
                );
              })}
            </div>
            {state.errors?.platform && <p className="mt-1 text-sm text-red-700">{state.errors.platform[0]}</p>}
          </fieldset>
          <label className="flex items-start gap-3 rounded-xl bg-blush-50 p-3 text-sm">
            <input type="checkbox" name="confirm" className="mt-0.5 size-4 accent-brand-600" required />
            <span>
              <span className="font-semibold">I confirm the signed form or policy decision is on file.</span>
              <span className="block text-ink-600">Your name and the time are recorded with each decision.</span>
            </span>
          </label>
          {state.errors?.confirm && <p className="text-sm text-red-700">{state.errors.confirm[0]}</p>}
          <SubmitButton pendingText="Recording…">Record consent</SubmitButton>
        </div>
      )}
    </ActionForm>
  );
}
