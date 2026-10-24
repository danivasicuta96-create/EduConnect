"use client";

import { Trash2 } from "lucide-react";
import { ActionButton, ActionForm, Field, Input, Select, SubmitButton, Textarea } from "@/components/forms";
import { createAssessmentAction, deleteAssessmentAction } from "./actions";

const KINDS: Array<[string, string]> = [
  ["test", "Test"], ["quiz", "Quiz"], ["homework", "Homework"], ["project", "Project"], ["oral", "Oral"], ["exam", "Exam"],
];

export function CreateAssessmentForm({ assignments, defaultAssignment, today }: {
  assignments: Array<{ value: string; label: string }>; defaultAssignment?: string; today: string;
}) {
  return (
    <ActionForm action={createAssessmentAction} resetOnSuccess>
      {(state) => (
        <div className="space-y-4">
          <Field label="Class and subject" error={state.errors?.assignment}>
            {(id) => (
              <Select id={id} name="assignment" required defaultValue={defaultAssignment ?? ""}>
                <option value="" disabled>Choose…</option>
                {assignments.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
              </Select>
            )}
          </Field>
          <Field label="Title" error={state.errors?.title}>
            {(id) => <Input id={id} name="title" required maxLength={120} placeholder="e.g. Unit 3 test — fractions" />}
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Type" error={state.errors?.kind}>
              {(id) => (
                <Select id={id} name="kind" defaultValue="test">
                  {KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </Select>
              )}
            </Field>
            <Field label="Due date" error={state.errors?.dueDate}>
              {(id) => <Input id={id} name="dueDate" type="date" min={today} required />}
            </Field>
          </div>
          <Field label="Description" hint="(optional, shown to students)" error={state.errors?.description}>
            {(id) => <Textarea id={id} name="description" maxLength={2000} rows={3} placeholder="What to revise, what to bring…" />}
          </Field>
          <p className="text-xs text-ink-500">Students enrolled in the class get a notification about the new assessment.</p>
          <SubmitButton pendingText="Scheduling…">Schedule assessment</SubmitButton>
        </div>
      )}
    </ActionForm>
  );
}

export function DeleteAssessmentButton({ id, title }: { id: string; title: string }) {
  return (
    <ActionButton action={deleteAssessmentAction} hidden={{ assessmentId: id }} variant="ghost" title={`Remove ${title}`} confirm={`Remove "${title}"? Students will no longer see it.`}>
      <Trash2 className="size-4" aria-hidden />
      <span className="sr-only">Remove {title}</span>
    </ActionButton>
  );
}
