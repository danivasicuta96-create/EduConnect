"use client";

import { ActionForm, Field, Input, Select, SubmitButton, Textarea } from "@/components/forms";
import { createGroupAction } from "../connect/actions";

export function CreateGroupForm({ subjects, interests }: { subjects: Array<{ id: string; name: string }>; interests: Array<{ id: number; label: string }> }) {
  return (
    <ActionForm action={createGroupAction} resetOnSuccess className="space-y-3">
      {(state) => (
        <>
          <Field label="Name" error={state.errors?.name}>{(id) => <Input id={id} name="name" required maxLength={80} placeholder="Physics revision crew" />}</Field>
          <Field label="What's it about?">{(id) => <Textarea id={id} name="description" maxLength={500} rows={2} />}</Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Subject">
              {(id) => (
                <Select id={id} name="subjectId" defaultValue="">
                  <option value="">None</option>
                  {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </Select>
              )}
            </Field>
            <Field label="Max members">{(id) => <Input id={id} name="maxMembers" type="number" min={2} max={40} defaultValue={8} />}</Field>
          </div>
          <Field label="When & where" hint="(optional)">{(id) => <Input id={id} name="meetingInfo" maxLength={160} placeholder="Mondays 15:00, library" />}</Field>
          <Field label="Related interests" hint="(up to 5)">
            {(id) => (
              <Select id={id} name="interests" multiple className="h-28">
                {interests.map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}
              </Select>
            )}
          </Field>
          <p className="text-xs text-ink-500">Groups are visible to students at your school. Be kind — the school&apos;s code of conduct applies.</p>
          <SubmitButton pendingText="Creating…">Create group</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
