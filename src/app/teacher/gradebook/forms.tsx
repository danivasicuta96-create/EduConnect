"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { X, Trash2 } from "lucide-react";
import clsx from "clsx";
import { ActionButton, ActionForm, Field, Input, Select, SubmitButton, Textarea } from "@/components/forms";
import type { ActionState } from "@/lib/action-state";
import { addGradeAction, deleteGradeAction, updateGradeAction } from "./actions";

const KINDS: Array<[string, string]> = [
  ["test", "Test"], ["quiz", "Quiz"], ["homework", "Homework"], ["project", "Project"], ["oral", "Oral"], ["exam", "Exam"],
];

export interface DialogGrade {
  id: string;
  score: number;
  weight: number;
  kind: string;
  assessment_id: string | null;
  graded_on: string;
  comment: string | null;
}

interface Common {
  classId: string;
  subjectId: string;
  today: string;
  assessments: Array<{ id: string; title: string; due_date: string }>;
}

function CloseOnSuccess({ state, onDone }: { state: ActionState; onDone: () => void }) {
  useEffect(() => {
    if (!state.ok) return;
    const t = setTimeout(onDone, 700);
    return () => clearTimeout(t);
  }, [state, onDone]);
  return null;
}

function Modal({ trigger, triggerClass, triggerLabel, title, children }: {
  trigger: ReactNode; triggerClass: string; triggerLabel: string; title: string; children: (close: () => void) => ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [open, setOpen] = useState(false);
  // Each opening gets a fresh form (no stale success/error message).
  const [session, setSession] = useState(0);
  const close = useCallback(() => setOpen(false), []);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <>
      <button
        type="button"
        className={triggerClass}
        aria-label={triggerLabel}
        title={triggerLabel}
        onClick={() => {
          setSession((s) => s + 1);
          setOpen(true);
        }}
      >
        {trigger}
      </button>
      <dialog
        ref={ref}
        onClose={() => setOpen(false)}
        aria-labelledby={titleId}
        className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-2xl bg-white p-0 text-ink-900 shadow-[var(--shadow-pop)] backdrop:bg-ink-900/40"
      >
        <div className="flex items-center justify-between gap-3 border-b border-ink-100 px-5 py-3">
          <h2 id={titleId} className="text-base font-bold">{title}</h2>
          <button type="button" onClick={close} className="grid size-8 place-items-center rounded-lg text-ink-500 hover:bg-ink-50" aria-label="Close">
            <X className="size-4" aria-hidden />
          </button>
        </div>
        <div className="max-h-[75vh] overflow-y-auto px-5 py-4" key={session}>
          {session > 0 && children(close)}
        </div>
      </dialog>
    </>
  );
}

function GradeFields({ state, defaults, common }: { state: ActionState; defaults?: DialogGrade; common: Common }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Score" hint="(1–10)" error={state.errors?.score}>
        {(id) => <Input id={id} name="score" type="number" inputMode="decimal" min={1} max={10} step={0.01} required defaultValue={defaults?.score} autoFocus />}
      </Field>
      <Field label="Weight" hint="(0.5–5)" error={state.errors?.weight}>
        {(id) => <Input id={id} name="weight" type="number" inputMode="decimal" min={0.5} max={5} step={0.5} required defaultValue={defaults?.weight ?? 1} />}
      </Field>
      <Field label="Type" error={state.errors?.kind}>
        {(id) => (
          <Select id={id} name="kind" defaultValue={defaults?.kind ?? "test"}>
            {KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
        )}
      </Field>
      <Field label="Date" error={state.errors?.gradedOn}>
        {(id) => <Input id={id} name="gradedOn" type="date" max={common.today} required defaultValue={defaults?.graded_on ?? common.today} />}
      </Field>
      <div className="sm:col-span-2">
        <Field label="Assessment" hint="(optional)" error={state.errors?.assessmentId}>
          {(id) => (
            <Select id={id} name="assessmentId" defaultValue={defaults?.assessment_id ?? ""}>
              <option value="">Not linked to an assessment</option>
              {common.assessments.map((a) => <option key={a.id} value={a.id}>{a.title} ({a.due_date})</option>)}
            </Select>
          )}
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field label="Comment" hint="(optional, visible to the student)" error={state.errors?.comment}>
          {(id) => <Textarea id={id} name="comment" maxLength={500} rows={2} defaultValue={defaults?.comment ?? ""} />}
        </Field>
      </div>
    </div>
  );
}

/** "Add grade" dialog. Without a fixed student it shows a student picker. */
export function AddGradeDialog({ student, students, common, variant = "row" }: {
  student?: { id: string; name: string }; students?: Array<{ id: string; name: string }>; common: Common; variant?: "row" | "primary";
}) {
  return (
    <Modal
      title={student ? `Add a grade for ${student.name}` : "Add a grade"}
      triggerLabel={student ? `Add a grade for ${student.name}` : "Add a grade"}
      triggerClass={
        variant === "primary"
          ? "inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
          : "grid size-7 place-items-center rounded-full bg-brand-50 text-base font-bold text-brand-700 ring-1 ring-brand-200 hover:bg-brand-100"
      }
      trigger={variant === "primary" ? "+ Add grade" : <span aria-hidden>+</span>}
    >
      {(close) => (
        <ActionForm action={addGradeAction}>
          {(state) => (
            <div className="space-y-4">
              <CloseOnSuccess state={state} onDone={close} />
              <input type="hidden" name="classId" value={common.classId} />
              <input type="hidden" name="subjectId" value={common.subjectId} />
              {student ? (
                <input type="hidden" name="studentId" value={student.id} />
              ) : (
                <Field label="Student" error={state.errors?.studentId}>
                  {(id) => (
                    <Select id={id} name="studentId" required defaultValue="">
                      <option value="" disabled>Choose a student…</option>
                      {(students ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </Select>
                  )}
                </Field>
              )}
              <GradeFields state={state} common={common} />
              <p className="text-xs text-ink-500">The student gets a notification that a new grade was added (without the score).</p>
              <div className="flex justify-end">
                <SubmitButton pendingText="Saving…">Add grade</SubmitButton>
              </div>
            </div>
          )}
        </ActionForm>
      )}
    </Modal>
  );
}

const chipTone = (score: number) =>
  score >= 9 ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
    : score >= 7 ? "bg-sky-50 text-sky-800 ring-sky-200"
    : score >= 5 ? "bg-amber-50 text-amber-900 ring-amber-200"
    : "bg-red-50 text-red-800 ring-red-200";

/** A grade chip; clicking opens the edit / delete dialog. */
export function GradeChip({ grade, studentName, kindLabel, common }: { grade: DialogGrade; studentName: string; kindLabel: string; common: Common }) {
  const label = `${studentName}: ${grade.score}, ${kindLabel}, weight ${grade.weight}, ${grade.graded_on}. Edit grade`;
  return (
    <Modal
      title={`Edit grade — ${studentName}`}
      triggerLabel={label}
      triggerClass={clsx("inline-flex h-7 min-w-9 items-center justify-center gap-0.5 rounded-lg px-1.5 text-sm font-bold ring-1 transition hover:brightness-95", chipTone(grade.score))}
      trigger={
        <>
          {grade.score}
          {grade.weight !== 1 && <sup className="text-[10px] font-semibold opacity-80">×{grade.weight}</sup>}
        </>
      }
    >
      {(close) => (
        <div className="space-y-4">
          <ActionForm action={updateGradeAction}>
            {(state) => (
              <div className="space-y-4">
                <CloseOnSuccess state={state} onDone={close} />
                <input type="hidden" name="gradeId" value={grade.id} />
                <GradeFields state={state} defaults={grade} common={common} />
                <div className="flex justify-end">
                  <SubmitButton pendingText="Saving…">Save changes</SubmitButton>
                </div>
              </div>
            )}
          </ActionForm>
          <div className="flex items-center justify-between gap-3 border-t border-ink-100 pt-3">
            <p className="text-xs text-ink-500">Deleting removes the grade from the student&apos;s record.</p>
            <ActionButton action={deleteGradeAction} hidden={{ gradeId: grade.id }} variant="danger" confirm="Delete this grade? This can't be undone.">
              <Trash2 className="size-4" aria-hidden /> Delete
            </ActionButton>
          </div>
        </div>
      )}
    </Modal>
  );
}
