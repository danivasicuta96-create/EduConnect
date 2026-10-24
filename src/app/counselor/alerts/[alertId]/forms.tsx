"use client";

import { ActionForm, Field, Input, Select, SubmitButton, Textarea } from "@/components/forms";
import { addFollowupAction, offerSessionAction, resolveAlertAction } from "./actions";

const FOLLOWUP_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "note", label: "Note" },
  { value: "conversation_offered", label: "Conversation offered (outside the app)" },
  { value: "conversation_held", label: "Conversation held" },
  { value: "referred", label: "Referred (per school policy)" },
  { value: "monitoring", label: "Monitoring" },
];

export function FollowupForm({ alertId }: { alertId: string }) {
  return (
    <ActionForm action={addFollowupAction} resetOnSuccess className="space-y-3">
      {(state) => (
        <>
          <input type="hidden" name="alertId" value={alertId} />
          <Field label="Type" error={state.errors?.action}>
            {(id) => (
              <Select id={id} name="action" defaultValue="note" required>
                {FOLLOWUP_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
            )}
          </Field>
          <Field label="Note" hint="(required for notes)" error={state.errors?.note}>
            {(id) => (
              <Textarea
                id={id}
                name="note"
                maxLength={4000}
                rows={3}
                placeholder="Facts and actions only. Follow-ups can't be edited or deleted later."
                aria-invalid={state.errors?.note ? true : undefined}
              />
            )}
          </Field>
          <SubmitButton size="sm" pendingText="Saving…">Add follow-up</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function ResolveForm({ alertId }: { alertId: string }) {
  return (
    <ActionForm action={resolveAlertAction} className="space-y-3">
      {(state) => (
        <>
          <input type="hidden" name="alertId" value={alertId} />
          <Field label="Resolution note" error={state.errors?.resolution}>
            {(id) => (
              <Textarea
                id={id}
                name="resolution"
                required
                minLength={3}
                maxLength={2000}
                rows={3}
                placeholder="What was done and why no further follow-up is needed."
                aria-invalid={state.errors?.resolution ? true : undefined}
              />
            )}
          </Field>
          <SubmitButton size="sm" variant="secondary" pendingText="Resolving…">Resolve alert</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function OfferSessionForm({ alertId, defaultWhen, minWhen }: { alertId: string; defaultWhen: string; minWhen: string }) {
  return (
    <ActionForm action={offerSessionAction} className="space-y-3">
      {(state) => (
        <>
          <input type="hidden" name="alertId" value={alertId} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Proposed time" error={state.errors?.proposedAt}>
              {(id) => <Input id={id} name="proposedAt" type="datetime-local" required defaultValue={defaultWhen} min={minWhen} />}
            </Field>
            <Field label="Where" error={state.errors?.location}>
              {(id) => <Input id={id} name="location" required maxLength={120} defaultValue="Counselor's office" />}
            </Field>
          </div>
          <p className="text-xs text-ink-500">
            The student receives a neutral notification (&ldquo;Your school counselor would like to check in&rdquo;) and can accept,
            decline or reply. Nothing is sent to parents or teachers.
          </p>
          <SubmitButton size="sm" pendingText="Sending…">Send invitation</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
