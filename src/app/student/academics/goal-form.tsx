"use client";

import { ActionForm, Field, Input, Select, SubmitButton } from "@/components/forms";
import { addGoalAction } from "./actions";

export function GoalForm({ subjects }: { subjects: Array<{ id: string; name: string }> }) {
  return (
    <ActionForm action={addGoalAction} resetOnSuccess className="space-y-3 rounded-2xl bg-blush-50 p-4">
      {(state) => (
        <>
          <p className="font-bold">Add a goal</p>
          <Field label="Goal" error={state.errors?.title}>
            {(id) => <Input id={id} name="title" required maxLength={160} placeholder="Reach an 8 in Physics this term" />}
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Subject">
              {(id) => (
                <Select id={id} name="subjectId" defaultValue="">
                  <option value="">Any</option>
                  {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </Select>
              )}
            </Field>
            <Field label="Target average" error={state.errors?.targetAverage}>
              {(id) => <Input id={id} name="targetAverage" type="number" min={1} max={10} step={0.5} placeholder="8" />}
            </Field>
          </div>
          <SubmitButton size="sm" pendingText="Adding…">Add goal</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
