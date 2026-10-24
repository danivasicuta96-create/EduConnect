"use client";

import { ActionForm, Field, Input, Select, SubmitButton } from "@/components/forms";
import { changeSubscriptionAction } from "./actions";

type Plan = { id: string; name: string; max: number | null };

const FUNDING: Array<[string, string]> = [
  ["school_budget", "School budget"],
  ["grant", "Grant funding"],
  ["public_partnership", "Public partnership"],
  ["pilot", "Pilot programme"],
];

export function SubscriptionForm({ plans, current, minSeats }: { plans: Plan[]; current: { planId: string; billingCycle: string; fundingSource: string; seats: number }; minSeats: number }) {
  return (
    <ActionForm action={changeSubscriptionAction}>
      {(state) => (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Plan" error={state.errors?.planId}>
              {(id) => (
                <Select id={id} name="planId" defaultValue={current.planId}>
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}{p.max ? ` (up to ${p.max} students)` : " (unlimited students)"}</option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Funding source" error={state.errors?.fundingSource}>
              {(id) => (
                <Select id={id} name="fundingSource" defaultValue={current.fundingSource}>
                  {FUNDING.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </Select>
              )}
            </Field>
            <fieldset>
              <legend className="mb-1.5 block text-sm font-semibold text-ink-800">Billing cycle</legend>
              <div className="flex gap-2">
                {[["annual", "Annual"], ["monthly", "Monthly"]].map(([v, l]) => (
                  <label key={v} className="flex flex-1 cursor-pointer items-center gap-2 rounded-xl bg-white px-3 py-2.5 text-sm ring-1 ring-ink-200 has-[:checked]:ring-2 has-[:checked]:ring-brand-500">
                    <input type="radio" name="billingCycle" value={v} defaultChecked={current.billingCycle === v} className="accent-brand-600" />
                    <span className="font-semibold">{l}</span>
                  </label>
                ))}
              </div>
              {state.errors?.billingCycle && <p className="mt-1 text-sm text-red-700">{state.errors.billingCycle[0]}</p>}
            </fieldset>
            <Field label="Seats" hint={`(at least ${minSeats})`} error={state.errors?.seats}>
              {(id) => <Input id={id} name="seats" type="number" min={Math.max(1, minSeats)} max={100000} defaultValue={current.seats} required />}
            </Field>
          </div>
          <SubmitButton pendingText="Saving…">Save subscription</SubmitButton>
        </div>
      )}
    </ActionForm>
  );
}
