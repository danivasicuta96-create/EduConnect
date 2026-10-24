"use client";

import { ActionForm, Field, Input, Select, SubmitButton } from "@/components/forms";
import { WEEKDAYS } from "@/lib/constants";
import { addAssignmentAction, addTimetableAction, createSubjectAction, enrollAction, saveClassAction } from "./actions";

type Option = { id: string; label: string };
const COLORS = ["coral", "pink", "rose", "amber", "teal", "sky", "violet", "slate"];

export function ClassForm({ teachers, initial }: { teachers: Option[]; initial?: { id: string; name: string; gradeLevel: number; academicYear: string; homeroomTeacherId: string | null } }) {
  return (
    <ActionForm action={saveClassAction} resetOnSuccess={!initial}>
      {(state) => (
        <div className="space-y-3">
          {initial && <input type="hidden" name="id" value={initial.id} />}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Class name" error={state.errors?.name}>
              {(id) => <Input id={id} name="name" required maxLength={40} placeholder="e.g. 9A" defaultValue={initial?.name} />}
            </Field>
            <Field label="Grade" error={state.errors?.gradeLevel}>
              {(id) => (
                <Select id={id} name="gradeLevel" defaultValue={String(initial?.gradeLevel ?? 9)}>
                  {Array.from({ length: 13 }, (_, i) => i + 1).map((g) => <option key={g} value={g}>Grade {g}</option>)}
                </Select>
              )}
            </Field>
            <Field label="Academic year" error={state.errors?.academicYear}>
              {(id) => <Input id={id} name="academicYear" required pattern="\d{4}-\d{4}" defaultValue={initial?.academicYear ?? "2026-2027"} />}
            </Field>
            <Field label="Homeroom teacher" error={state.errors?.homeroomTeacherId}>
              {(id) => (
                <Select id={id} name="homeroomTeacherId" defaultValue={initial?.homeroomTeacherId ?? ""}>
                  <option value="">None</option>
                  {teachers.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                </Select>
              )}
            </Field>
          </div>
          <SubmitButton size="sm" pendingText="Saving…">{initial ? "Save changes" : "Create class"}</SubmitButton>
        </div>
      )}
    </ActionForm>
  );
}

export function AssignmentForm({ classId, subjects, teachers }: { classId: string; subjects: Option[]; teachers: Option[] }) {
  if (subjects.length === 0 || teachers.length === 0) {
    return <p className="text-sm text-ink-500">Add subjects and staff accounts first to assign teachers.</p>;
  }
  return (
    <ActionForm action={addAssignmentAction}>
      {(state) => (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <input type="hidden" name="classId" value={classId} />
          <div className="flex-1">
            <Field label="Subject" error={state.errors?.subjectId}>
              {(id) => (
                <Select id={id} name="subjectId" required defaultValue="">
                  <option value="" disabled>Choose…</option>
                  {subjects.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </Select>
              )}
            </Field>
          </div>
          <div className="flex-1">
            <Field label="Teacher" error={state.errors?.teacherId}>
              {(id) => (
                <Select id={id} name="teacherId" required defaultValue="">
                  <option value="" disabled>Choose…</option>
                  {teachers.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                </Select>
              )}
            </Field>
          </div>
          <SubmitButton variant="secondary" pendingText="Adding…">Assign</SubmitButton>
        </div>
      )}
    </ActionForm>
  );
}

export function EnrollForm({ classId, students }: { classId: string; students: Option[] }) {
  if (students.length === 0) return <p className="text-sm text-ink-500">Every student account is already in this class.</p>;
  return (
    <ActionForm action={enrollAction}>
      {(state) => (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <input type="hidden" name="classId" value={classId} />
          <div className="flex-1">
            <Field label="Add a student" error={state.errors?.studentId}>
              {(id) => (
                <Select id={id} name="studentId" required defaultValue="">
                  <option value="" disabled>Choose a student…</option>
                  {students.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </Select>
              )}
            </Field>
          </div>
          <SubmitButton variant="secondary" pendingText="Adding…">Add</SubmitButton>
        </div>
      )}
    </ActionForm>
  );
}

export function TimetableForm({ classId, subjects, teachers }: { classId: string; subjects: Option[]; teachers: Option[] }) {
  if (subjects.length === 0) return <p className="text-sm text-ink-500">Add a subject first.</p>;
  return (
    <ActionForm action={addTimetableAction}>
      {(state) => (
        <div className="space-y-3">
          <input type="hidden" name="classId" value={classId} />
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Day" error={state.errors?.weekday}>
              {(id) => (
                <Select id={id} name="weekday" defaultValue="1">
                  {[1, 2, 3, 4, 5, 6, 7].map((d) => <option key={d} value={d}>{WEEKDAYS[d]}</option>)}
                </Select>
              )}
            </Field>
            <Field label="Starts" error={state.errors?.startTime}>
              {(id) => <Input id={id} name="startTime" type="time" required defaultValue="08:00" />}
            </Field>
            <Field label="Ends" error={state.errors?.endTime}>
              {(id) => <Input id={id} name="endTime" type="time" required defaultValue="08:50" />}
            </Field>
            <Field label="Subject" error={state.errors?.subjectId}>
              {(id) => (
                <Select id={id} name="subjectId" required defaultValue="">
                  <option value="" disabled>Choose…</option>
                  {subjects.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </Select>
              )}
            </Field>
            <Field label="Teacher" hint="(optional)" error={state.errors?.teacherId}>
              {(id) => (
                <Select id={id} name="teacherId" defaultValue="">
                  <option value="">None</option>
                  {teachers.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                </Select>
              )}
            </Field>
            <Field label="Room" hint="(optional)" error={state.errors?.room}>
              {(id) => <Input id={id} name="room" maxLength={20} placeholder="e.g. 901" />}
            </Field>
          </div>
          <SubmitButton variant="secondary" size="sm" pendingText="Adding…">Add lesson</SubmitButton>
        </div>
      )}
    </ActionForm>
  );
}

export function SubjectForm() {
  return (
    <ActionForm action={createSubjectAction} resetOnSuccess>
      {(state) => (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Field label="New subject" error={state.errors?.name}>
              {(id) => <Input id={id} name="name" required maxLength={60} placeholder="e.g. Biology" />}
            </Field>
          </div>
          <div className="sm:w-40">
            <Field label="Colour" error={state.errors?.color}>
              {(id) => (
                <Select id={id} name="color" defaultValue="coral">
                  {COLORS.map((c) => <option key={c} value={c}>{c[0].toUpperCase() + c.slice(1)}</option>)}
                </Select>
              )}
            </Field>
          </div>
          <SubmitButton variant="secondary" pendingText="Adding…">Add subject</SubmitButton>
        </div>
      )}
    </ActionForm>
  );
}
