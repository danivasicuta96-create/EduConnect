// Shared helpers for teacher pages that work on one class + subject.
import Link from "next/link";
import clsx from "clsx";
import type { Assignment } from "@/lib/services/teacher";

export type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export function param(sp: Record<string, string | string[] | undefined>, key: string): string | undefined {
  const v = sp[key];
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

/**
 * Resolve the selected class/subject from searchParams. Only the teacher's own
 * assignments can be selected; anything else falls back to a sensible default.
 */
export function resolveAssignment(assignments: Assignment[], classId?: string, subjectId?: string): { selected: Assignment | null; invalid: boolean } {
  if (assignments.length === 0) return { selected: null, invalid: false };
  const exact = assignments.find((a) => a.class_id === classId && a.subject_id === subjectId);
  if (exact) return { selected: exact, invalid: false };
  const sameClass = classId ? assignments.find((a) => a.class_id === classId) : undefined;
  return { selected: sameClass ?? assignments[0], invalid: Boolean(classId || subjectId) && !sameClass };
}

/** Chip navigation between the teacher's class/subject assignments. */
export function AssignmentPicker({ assignments, selected, basePath, extra = {}, label = "Choose class and subject" }: {
  assignments: Assignment[]; selected: Assignment | null; basePath: string; extra?: Record<string, string>; label?: string;
}) {
  const classes = [...new Map(assignments.map((a) => [a.class_id, a.class_name])).entries()];
  return (
    <nav aria-label={label} className="mb-5">
      <p className="mb-2 text-sm font-semibold text-ink-700">{label}</p>
      <div className="flex flex-wrap gap-x-5 gap-y-3">
        {classes.map(([classId, className]) => (
          <div key={classId} className="flex flex-wrap items-center gap-1.5">
            <span className="mr-0.5 text-xs font-bold uppercase tracking-wide text-ink-500">{className}</span>
            {assignments.filter((a) => a.class_id === classId).map((a) => {
              const active = selected?.class_id === a.class_id && selected?.subject_id === a.subject_id;
              const qs = new URLSearchParams({ class: a.class_id, subject: a.subject_id, ...extra });
              return (
                <Link
                  key={a.subject_id}
                  href={`${basePath}?${qs.toString()}`}
                  aria-current={active ? "page" : undefined}
                  className={clsx(
                    "rounded-full px-3 py-1.5 text-sm font-semibold ring-1 transition-colors",
                    active ? "bg-brand-600 text-white ring-brand-600" : "bg-white text-ink-700 ring-ink-200 hover:ring-brand-300",
                  )}
                >
                  {a.subject_name}
                </Link>
              );
            })}
          </div>
        ))}
      </div>
    </nav>
  );
}

export function fmt(n: number | null | undefined, suffix = ""): string {
  return n === null || n === undefined ? "—" : `${n}${suffix}`;
}
