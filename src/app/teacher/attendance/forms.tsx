"use client";

import { useState } from "react";
import clsx from "clsx";
import { CheckCheck } from "lucide-react";
import { ActionForm, SubmitButton, inputClass } from "@/components/forms";
import { Avatar } from "@/components/ui";
import { saveAttendanceAction } from "./actions";

type Status = "present" | "late" | "absent" | "excused";

const OPTIONS: Array<{ value: Status; label: string; active: string }> = [
  { value: "present", label: "Present", active: "bg-emerald-600 text-white ring-emerald-600" },
  { value: "late", label: "Late", active: "bg-amber-500 text-white ring-amber-500" },
  { value: "absent", label: "Absent", active: "bg-red-600 text-white ring-red-600" },
  { value: "excused", label: "Excused", active: "bg-sky-600 text-white ring-sky-600" },
];

export interface SheetStudent {
  id: string;
  name: string;
  avatarColor: string;
  avatarEmoji: string | null;
  status: Status | null;
  note: string | null;
  recentRate: number | null;
}

export function AttendanceForm({ classId, subjectId, date, students, alreadyRecorded }: {
  classId: string; subjectId: string; date: string; students: SheetStudent[]; alreadyRecorded: boolean;
}) {
  const [statuses, setStatuses] = useState<Record<string, Status>>(() => Object.fromEntries(students.map((s) => [s.id, s.status ?? "present"])));
  const counts = OPTIONS.map((o) => ({ ...o, n: Object.values(statuses).filter((s) => s === o.value).length }));

  return (
    <ActionForm action={saveAttendanceAction}>
      <input type="hidden" name="classId" value={classId} />
      <input type="hidden" name="subjectId" value={subjectId} />
      <input type="hidden" name="date" value={date} />

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-600" aria-live="polite">
          {counts.map((c, i) => (
            <span key={c.value}>{i > 0 && " · "}{c.label}: <strong className="text-ink-900">{c.n}</strong></span>
          ))}
        </p>
        <button
          type="button"
          onClick={() => setStatuses(Object.fromEntries(students.map((s) => [s.id, "present" as Status])))}
          className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-white px-3 text-sm font-semibold text-ink-800 ring-1 ring-inset ring-ink-200 hover:bg-ink-50"
        >
          <CheckCheck className="size-4" aria-hidden /> Mark all present
        </button>
      </div>

      <ul className="divide-y divide-ink-50">
        {students.map((s) => (
          <li key={s.id} className="flex flex-col gap-2 py-3 md:flex-row md:items-center md:gap-4">
            <div className="flex min-w-0 items-center gap-2.5 md:w-56 md:shrink-0">
              <Avatar name={s.name} color={s.avatarColor} emoji={s.avatarEmoji} size="sm" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-ink-900">{s.name}</span>
                <span className="block text-xs text-ink-500">Last 30 days: {s.recentRate === null ? "no records" : `${s.recentRate}%`}</span>
              </span>
            </div>
            <fieldset className="min-w-0">
              <legend className="sr-only">Attendance for {s.name}</legend>
              <div className="flex flex-wrap gap-1.5">
                {OPTIONS.map((o) => (
                  <label key={o.value} className="cursor-pointer">
                    <input
                      type="radio"
                      name={`status:${s.id}`}
                      value={o.value}
                      checked={statuses[s.id] === o.value}
                      onChange={() => setStatuses((prev) => ({ ...prev, [s.id]: o.value }))}
                      className="peer sr-only"
                    />
                    <span
                      className={clsx(
                        "inline-flex h-8 items-center rounded-lg px-3 text-sm font-semibold ring-1 transition peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-brand-500",
                        statuses[s.id] === o.value ? o.active : "bg-white text-ink-700 ring-ink-200 hover:ring-ink-300",
                      )}
                    >
                      {o.label}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="min-w-0 flex-1">
              <span className="sr-only">Note for {s.name} (optional)</span>
              <input name={`note:${s.id}`} defaultValue={s.note ?? ""} maxLength={300} placeholder="Note (optional)" className={clsx(inputClass, "py-1.5")} />
            </label>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex justify-end">
        <SubmitButton pendingText="Saving…">{alreadyRecorded ? "Update attendance" : "Save attendance"}</SubmitButton>
      </div>
    </ActionForm>
  );
}
