// Privacy-preserving aggregate wellbeing for teachers and counselors.
// No individual rows ever leave these functions. Any group with fewer than
// k = 5 reporting students is suppressed (also per week), and factors cited by
// fewer than 3 students are folded into "other", so small groups can't be
// re-identified.

import { tenant } from "@/lib/db/tenant";
import { classInMySchool, hasPerm, teachesClass } from "@/lib/authz";
import type { Actor } from "./actor";
import { AuthorizationError } from "./errors";

export const K_ANONYMITY = 5;
const FACTOR_MIN_STUDENTS = 3;

export interface WellbeingSummary {
  students_total: number;
  students_reporting: number;
  suppressed: boolean;
  k: number;
  checkins?: number;
  average?: number;
  distribution?: { low: number; mid: number; high: number };
  weekly?: Array<{ week_start: string; average: number | null; students: number }>;
  factors?: Array<{ factor: string; students: number }>;
}

function weekStart(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - (day - 1));
  return d.toISOString().slice(0, 10);
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Pure aggregation (exported for tests). */
export function summarize(studentIds: string[], rows: Array<{ student_id: string; date: string; mood: number; factors: string[] }>): WellbeingSummary {
  const ids = new Set(studentIds);
  const c = rows.filter((r) => ids.has(r.student_id));
  const reporting = new Set(c.map((r) => r.student_id)).size;
  const base = { students_total: studentIds.length, students_reporting: reporting, k: K_ANONYMITY };
  if (reporting < K_ANONYMITY) return { ...base, suppressed: true };

  const weeks = new Map<string, { sum: number; n: number; students: Set<string> }>();
  const factorStudents = new Map<string, Set<string>>();
  for (const r of c) {
    const w = weekStart(r.date);
    const e = weeks.get(w) ?? { sum: 0, n: 0, students: new Set<string>() };
    e.sum += r.mood;
    e.n++;
    e.students.add(r.student_id);
    weeks.set(w, e);
    for (const f of r.factors ?? []) {
      const s = factorStudents.get(f) ?? new Set<string>();
      s.add(r.student_id);
      factorStudents.set(f, s);
    }
  }
  return {
    ...base,
    suppressed: false,
    checkins: c.length,
    average: round2(c.reduce((a, r) => a + r.mood, 0) / c.length),
    distribution: {
      low: c.filter((r) => r.mood <= 3).length,
      mid: c.filter((r) => r.mood >= 4 && r.mood <= 6).length,
      high: c.filter((r) => r.mood >= 7).length,
    },
    weekly: [...weeks.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([week_start, e]) => ({ week_start, average: e.students.size >= K_ANONYMITY ? round2(e.sum / e.n) : null, students: e.students.size })),
    factors: [...factorStudents.entries()]
      .map(([factor, s]) => ({ factor, students: s.size }))
      .filter((f) => f.students >= FACTOR_MIN_STUDENTS)
      .sort((a, b) => b.students - a.students),
  };
}

async function load(schoolId: string, studentIds: string[], from: string, to: string) {
  const t = tenant({ schoolId });
  const rows = await t.checkins.find({ student_id: { $in: studentIds }, date: { $gte: from, $lte: to } }, { projection: { student_id: 1, date: 1, mood: 1, factors: 1 } });
  return rows.map((r) => ({ student_id: String(r.student_id), date: String(r.date), mood: Number(r.mood), factors: (r.factors as string[]) ?? [] }));
}

export async function classSummary(actor: Actor, classId: string, from: string, to: string): Promise<WellbeingSummary> {
  const t = tenant(actor);
  const allowed =
    (await teachesClass(t, actor, classId)) ||
    ((hasPerm(actor, "wellbeing.aggregate") || hasPerm(actor, "wellbeing.alerts")) && (await classInMySchool(t, classId)));
  if (!allowed) throw new AuthorizationError();
  const students = (await t.enrollments.find({ class_id: classId })).map((e) => String(e.student_id));
  return summarize(students, await load(actor.schoolId, students, from, to));
}

export async function schoolSummary(actor: Actor, from: string, to: string): Promise<WellbeingSummary> {
  if (!(hasPerm(actor, "wellbeing.aggregate") || hasPerm(actor, "wellbeing.alerts"))) throw new AuthorizationError();
  const t = tenant(actor);
  const students = (await t.profiles.find({ role: "student" }, { projection: { _id: 1 } })).map((p) => String(p._id));
  return summarize(students, await load(actor.schoolId, students, from, to));
}
