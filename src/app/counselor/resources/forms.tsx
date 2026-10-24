"use client";

import { ActionForm, Field, Input, Select, SubmitButton, Textarea } from "@/components/forms";
import type { ResourceItem } from "@/lib/services/counselor";
import { saveResourceAction } from "./actions";

const CATEGORIES: Array<{ value: string; label: string }> = [
  { value: "school", label: "School support" },
  { value: "helpline", label: "Helpline" },
  { value: "emergency", label: "Emergency" },
  { value: "selfcare", label: "Self-care" },
];

export function ResourceForm({ resource, today }: { resource?: ResourceItem; today: string }) {
  return (
    <ActionForm action={saveResourceAction} resetOnSuccess={!resource} className="space-y-4">
      {(state) => (
        <>
          {resource && <input type="hidden" name="id" value={resource.id} />}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" error={state.errors?.name}>
              {(id) => <Input id={id} name="name" required minLength={2} maxLength={120} defaultValue={resource?.name ?? ""} placeholder="e.g. Counselor's office (Room 12)" />}
            </Field>
            <Field label="Category" error={state.errors?.category}>
              {(id) => (
                <Select id={id} name="category" defaultValue={resource?.category ?? "school"} required>
                  {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </Select>
              )}
            </Field>
            <Field label="Phone" hint="(optional)" error={state.errors?.phone}>
              {(id) => <Input id={id} name="phone" type="tel" maxLength={40} defaultValue={resource?.phone ?? ""} />}
            </Field>
            <Field label="Link" hint="(https://… or an in-app path)" error={state.errors?.url}>
              {(id) => <Input id={id} name="url" maxLength={300} defaultValue={resource?.url ?? ""} placeholder="https://" />}
            </Field>
            <Field label="Hours" hint="(optional)" error={state.errors?.hours}>
              {(id) => <Input id={id} name="hours" maxLength={120} defaultValue={resource?.hours ?? ""} placeholder="Mon–Fri 9:00–15:00" />}
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Last verified" error={state.errors?.lastVerified}>
                {(id) => <Input id={id} name="lastVerified" type="date" max={today} defaultValue={resource?.lastVerified ?? ""} />}
              </Field>
              <Field label="Order" hint="(lower first)" error={state.errors?.sortOrder}>
                {(id) => <Input id={id} name="sortOrder" type="number" min={0} max={1000} step={1} defaultValue={resource?.sortOrder ?? 50} />}
              </Field>
            </div>
          </div>
          <Field label="Description" error={state.errors?.description}>
            {(id) => <Textarea id={id} name="description" required minLength={5} maxLength={500} rows={2} defaultValue={resource?.description ?? ""} placeholder="What it is and who it's for, in a friendly sentence." />}
          </Field>
          <SubmitButton size="sm" pendingText="Saving…">{resource ? "Save changes" : "Add resource"}</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
