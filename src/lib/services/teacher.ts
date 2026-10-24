// Teacher portal: classes, rosters, gradebook, attendance, assessments,
// academic analytics and k-anonymous class wellbeing.
//
// Security model (MongoDB has no row-level security):
// - every query goes through `tenant(actor)`, so it is always scoped to the
//   teacher's own school, whatever ids are passed in;
// - the former RLS policies are explicit checks here, using src/lib/authz.ts:
//     grades      insert/update: canTeach(class, subject) AND isEnrolled(student, class)
//                 delete:        canTeach(class, subject)
//     attendance  write:         canTeach(class, subject) AND isEnrolled(student, class)
//     assessments write:         canTeach(class, subject)
//     reads:      only (class, subject) pairs the teacher teaches, plus
//                 homeroom/taught classes for rosters;
// - teachers never see individual wellbeing check-ins — only `classSummary()`
//   (services/wellbeing-aggregates.ts), which suppresses groups of fewer than
//   5 reporting students. This file never touches the check-ins collection.

import { z } from "zod";
import type { Filter, WithId } from "mongodb";
import { newId } from "@/lib/db/mongo";
import { tenant, type AppDoc, type Tenant } from "@/lib/db/tenant";
import { canTeach, isEnrolled, teachesClass } from "@/lib/authz";
import { addDays, formatDate, isoWeekday, todayIn } from "@/lib/dates";
import { attendanceRate, overallAverage, subjectAverage } from "@/lib/engines/grades";
import { UserFacingError } from "@/lib/action-state";
import { AuthorizationError } from "./errors";
import type { Actor } from "./actor";
import { assertRole } from "./actor";
import { audit } from "./audit";
import { notify } from "./notify";
import { classSummary, type WellbeingSummary } from "./wellbeing-aggregates";

export type { WellbeingSummary };

// ───────────── Constants ─────────────

export const GRADE_KINDS = ["test", "quiz", "homework", "project", "oral", "exam"] as const;
export type GradeKind = (typeof GRADE_KINDS)[number];
export const GRADE_KIND_LABELS: Record<GradeKind, string> = {
  test: "Test",
  quiz: "Quiz",
  homework: "Homework",
  project: "Project",
  oral: "Oral",
  exam: "Exam",
};

export const ATTENDANCE_STATUSES = ["present", "late", "absent", "excused"] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];
export const ATTENDANCE_LABELS: Record<AttendanceStatus, string> = {
  present: "Present",
  late: "Late",
  absent: "Absent",
  excused: "Excused",
};

export const WELLBEING_WINDOWS = [7, 14, 30] as const;
export type WellbeingWindow = (typeof WELLBEING_WINDOWS)[number];

/** Average below this (on the 1–10 scale) is flagged for academic support. */
export const SUPPORT_THRESHOLD = 5;
/** Drop (recent two grades vs earlier ones) that counts as "falling". */
export const FALLING_DROP = 1;

const uuid = z.string().uuid();
export function isUuid(v: unknown): v is string {
  return uuid.safeParse(v).success;
}
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a valid date.");
export function isIsoDate(v: unknown): v is string {
  return isoDate.safeParse(v).success && !Number.isNaN(new Date(`${v}T00:00:00Z`).getTime());
}
const round2 = (n: number) => Math.round(n * 100) / 100;
const emptyToNull = (v: unknown) => (v === "" || v === undefined ? null : v);
const byText = (a: string, b: string) => a.localeCompare(b);
const uniq = <T,>(xs: T[]) => [...new Set(xs)];
const iso = (v: unknown): string | null => (v == null ? null : v instanceof Date ? v.toISOString() : String(v));

/** Monday (YYYY-MM-DD) of the ISO week containing `date`. */
export function weekStart(date: string): string {
  return addDays(date, 1 - isoWeekday(date));
}

// ───────────── Types ─────────────

export interface Assignment {
  class_id: string;
  class_name: string;
  grade_level: number;
  subject_id: string;
  subject_name: string;
  subject_color: string;
}

export interface SubjectRef {
  id: string;
  name: string;
  color: string;
}

export interface TeacherClass {
  id: string;
  name: string;
  grade_level: number;
  is_homeroom: boolean;
  student_count: number;
  subjects: SubjectRef[];
}

export interface StudentRef {
  id: string;
  display_name: string;
  avatar_color: string;
  avatar_emoji: string | null;
  account_state: string;
}

// ───────────── Internal helpers ─────────────

/** The (class, subject) pairs the actor teaches, with display names. */
async function myAssignments(t: Tenant, actor: Actor): Promise<Assignment[]> {
  const rows = await t.teachingAssignments.find({ teacher_id: actor.id });
  if (rows.length === 0) return [];
  const [classes, subjects] = await Promise.all([
    t.classes.find({ _id: { $in: uniq(rows.map((r) => String(r.class_id))) } }),
    t.subjects.find({ _id: { $in: uniq(rows.map((r) => String(r.subject_id))) } }),
  ]);
  const classById = new Map(classes.map((c) => [String(c._id), c]));
  const subjectById = new Map(subjects.map((s) => [String(s._id), s]));
  const out: Assignment[] = [];
  for (const r of rows) {
    const c = classById.get(String(r.class_id));
    const s = subjectById.get(String(r.subject_id));
    if (!c || !s) continue;
    out.push({
      class_id: String(c._id), class_name: String(c.name), grade_level: Number(c.grade_level),
      subject_id: String(s._id), subject_name: String(s.name), subject_color: String(s.color),
    });
  }
  return out.sort((a, b) => a.grade_level - b.grade_level || byText(a.class_name, b.class_name) || byText(a.subject_name, b.subject_name));
}

/** Filter matching only the (class, subject) pairs in `assignments`. Null when there are none. */
function pairFilter(assignments: Array<Pick<Assignment, "class_id" | "subject_id">>): Filter<AppDoc> | null {
  if (assignments.length === 0) return null;
  return { $or: assignments.map((a) => ({ class_id: a.class_id, subject_id: a.subject_id })) };
}

async function enrollmentCounts(t: Tenant, classIds: string[]): Promise<Map<string, number>> {
  if (classIds.length === 0) return new Map();
  const rows = await t.enrollments.aggregate<{ _id: string; n: number }>([
    { $match: { class_id: { $in: classIds } } },
    { $group: { _id: "$class_id", n: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.n]));
}

/** Classes the actor teaches a subject in or is homeroom teacher for. */
async function myClasses(t: Tenant, actor: Actor, assignments?: Assignment[]): Promise<TeacherClass[]> {
  const a = assignments ?? (await myAssignments(t, actor));
  const rows = await t.classes.find({ $or: [{ homeroom_teacher_id: actor.id }, { _id: { $in: uniq(a.map((x) => x.class_id)) } }] });
  const counts = await enrollmentCounts(t, rows.map((r) => String(r._id)));
  return rows
    .map((r) => {
      const id = String(r._id);
      return {
        id,
        name: String(r.name),
        grade_level: Number(r.grade_level),
        is_homeroom: r.homeroom_teacher_id === actor.id,
        student_count: counts.get(id) ?? 0,
        subjects: a.filter((x) => x.class_id === id).map((x) => ({ id: x.subject_id, name: x.subject_name, color: x.subject_color })),
      };
    })
    .sort((x, y) => x.grade_level - y.grade_level || byText(x.name, y.name));
}

async function requireAssignment(t: Tenant, actor: Actor, classId: string, subjectId: string): Promise<void> {
  if (!isUuid(classId) || !isUuid(subjectId) || !(await canTeach(t, actor, classId, subjectId))) {
    throw new AuthorizationError("You don't teach this subject in this class.");
  }
}

const toStudentRef = (p: WithId<AppDoc>): StudentRef => ({
  id: String(p._id),
  display_name: String(p.display_name),
  avatar_color: String(p.avatar_color),
  avatar_emoji: p.avatar_emoji ?? null,
  account_state: String(p.account_state),
});

/** Students enrolled in the given classes (callers must have authorised access to them). */
async function studentsOf(t: Tenant, classIds: string[]): Promise<Array<StudentRef & { class_id: string }>> {
  if (classIds.length === 0) return [];
  const enrollments = await t.enrollments.find({ class_id: { $in: classIds } }, { projection: { class_id: 1, student_id: 1 } });
  const profiles = await t.profiles.find(
    { _id: { $in: uniq(enrollments.map((e) => String(e.student_id))) }, role: "student" },
    { projection: { display_name: 1, avatar_color: 1, avatar_emoji: 1, account_state: 1 } },
  );
  const byId = new Map(profiles.map((p) => [String(p._id), toStudentRef(p)]));
  return enrollments
    .filter((e) => byId.has(String(e.student_id)))
    .map((e) => ({ ...byId.get(String(e.student_id))!, class_id: String(e.class_id) }))
    .sort((a, b) => byText(a.display_name, b.display_name));
}

async function classStudents(t: Tenant, classId: string): Promise<StudentRef[]> {
  return (await studentsOf(t, [classId])).map((s) => ({
    id: s.id, display_name: s.display_name, avatar_color: s.avatar_color, avatar_emoji: s.avatar_emoji, account_state: s.account_state,
  }));
}

async function names(t: Tenant, classId: string, subjectId: string) {
  const [c, s] = await Promise.all([t.classes.findOne({ _id: classId }), t.subjects.findOne({ _id: subjectId })]);
  if (!c || !s) throw new UserFacingError("That class or subject no longer exists.");
  return { class_name: String(c.name), subject_name: String(s.name) };
}

/** Explain a weighted average: "(8×2 + 7×1) ÷ 3 = 7.67". */
export function averageFormula(grades: Array<{ score: number; weight: number }>): string | null {
  if (grades.length === 0) return null;
  const terms = grades.map((g) => `${g.score}×${g.weight}`).join(" + ");
  const w = grades.reduce((a, g) => a + g.weight, 0);
  return `(${terms}) ÷ ${round2(w)} = ${subjectAverage(grades)}`;
}

// ───────────── Shared reads ─────────────

export async function getAssignments(actor: Actor): Promise<Assignment[]> {
  assertRole(actor, "teacher");
  return myAssignments(tenant(actor), actor);
}

export async function getTeacherClasses(actor: Actor): Promise<TeacherClass[]> {
  assertRole(actor, "teacher");
  return myClasses(tenant(actor), actor);
}

// ───────────── Dashboard ─────────────

export interface Lesson {
  id: string;
  class_id: string;
  class_name: string;
  subject_id: string;
  subject_name: string;
  subject_color: string;
  start_time: string;
  end_time: string;
  room: string | null;
  attendance_taken: boolean;
}

export interface TeacherAssessment {
  id: string;
  class_id: string;
  class_name: string;
  subject_id: string;
  subject_name: string;
  subject_color: string;
  title: string;
  kind: GradeKind;
  due_date: string;
  description: string | null;
  graded_count: number;
  student_count: number;
}

export interface FollowUpTask {
  kind: "grades_missing" | "attendance_missing";
  title: string;
  detail: string;
  href: string;
}

export interface NotificationRow {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

/**
 * Assessments for (class, subject) pairs the teacher teaches, due in [from, to],
 * sorted by due date, class and subject name.
 */
async function teacherAssessments(t: Tenant, assignments: Assignment[], from: string, to?: string): Promise<TeacherAssessment[]> {
  const pairs = pairFilter(assignments);
  if (!pairs) return [];
  const due: Record<string, string> = { $gte: from };
  if (to) due.$lte = to;
  const rows = await t.assessments.find({ ...pairs, due_date: due });
  if (rows.length === 0) return [];
  const ids = rows.map((r) => String(r._id));
  const [graded, counts] = await Promise.all([
    t.grades.aggregate<{ _id: string; students: string[] }>([
      { $match: { assessment_id: { $in: ids } } },
      { $group: { _id: "$assessment_id", students: { $addToSet: "$student_id" } } },
    ]),
    enrollmentCounts(t, uniq(rows.map((r) => String(r.class_id)))),
  ]);
  const gradedCount = new Map(graded.map((g) => [String(g._id), g.students.length]));
  const pair = new Map(assignments.map((a) => [`${a.class_id}:${a.subject_id}`, a]));
  return rows
    .map((r) => {
      const a = pair.get(`${r.class_id}:${r.subject_id}`)!;
      return {
        id: String(r._id), class_id: a.class_id, class_name: a.class_name, subject_id: a.subject_id, subject_name: a.subject_name,
        subject_color: a.subject_color, title: String(r.title), kind: r.kind as GradeKind, due_date: String(r.due_date),
        description: r.description ?? null, graded_count: gradedCount.get(String(r._id)) ?? 0, student_count: counts.get(a.class_id) ?? 0,
      };
    })
    .sort((x, y) => byText(x.due_date, y.due_date) || byText(x.class_name, y.class_name) || byText(x.subject_name, y.subject_name));
}

export async function getTeacherDashboard(actor: Actor) {
  assertRole(actor, "teacher");
  const today = todayIn(actor.timezone);
  const t = tenant(actor);
  const assignments = await myAssignments(t, actor);
  const pairs = pairFilter(assignments);
  const taughtClassIds = uniq(assignments.map((a) => a.class_id));

  const [classes, timetable, assessments, enrolledStudents, grades, attendance, notificationDocs] = await Promise.all([
    myClasses(t, actor, assignments),
    t.timetable.find({ teacher_id: actor.id, weekday: isoWeekday(today) }, { sort: { start_time: 1 } }),
    teacherAssessments(t, assignments, addDays(today, -30), addDays(today, 14)),
    taughtClassIds.length ? t.enrollments.distinct("student_id", { class_id: { $in: taughtClassIds } }) : Promise.resolve([]),
    pairs ? t.grades.find(pairs, { projection: { score: 1, weight: 1 } }) : Promise.resolve([]),
    pairs ? t.attendance.find({ ...pairs, date: { $gte: addDays(today, -13), $lte: today } }, { projection: { status: 1 } }) : Promise.resolve([]),
    t.notifications.find({ user_id: actor.id }, { sort: { created_at: -1 }, limit: 5 }),
  ]);

  // Lessons today, with names and whether attendance was already taken.
  const lessonClassIds = uniq(timetable.map((l) => String(l.class_id)));
  const [lessonClasses, lessonSubjects, takenToday] = await Promise.all([
    t.classes.find({ _id: { $in: lessonClassIds } }, { projection: { name: 1 } }),
    t.subjects.find({ _id: { $in: uniq(timetable.map((l) => String(l.subject_id))) } }, { projection: { name: 1, color: 1 } }),
    lessonClassIds.length ? t.attendance.find({ class_id: { $in: lessonClassIds }, date: today }, { projection: { class_id: 1, subject_id: 1 } }) : Promise.resolve([]),
  ]);
  const className = new Map(lessonClasses.map((c) => [String(c._id), String(c.name)]));
  const subjectById = new Map(lessonSubjects.map((s) => [String(s._id), s]));
  const taken = new Set(takenToday.map((a) => `${a.class_id}:${a.subject_id}`));
  const lessons: Lesson[] = timetable
    .filter((l) => className.has(String(l.class_id)) && subjectById.has(String(l.subject_id)))
    .map((l) => {
      const s = subjectById.get(String(l.subject_id))!;
      return {
        id: String(l._id), class_id: String(l.class_id), class_name: className.get(String(l.class_id))!,
        subject_id: String(l.subject_id), subject_name: String(s.name), subject_color: String(s.color),
        start_time: String(l.start_time), end_time: String(l.end_time), room: l.room ?? null,
        attendance_taken: taken.has(`${l.class_id}:${l.subject_id}`),
      };
    });

  const upcoming = assessments.filter((a) => a.due_date >= today).slice(0, 8);
  const ungraded = assessments.filter((a) => a.due_date <= today && a.graded_count === 0);
  const gradeRows = grades.map((g) => ({ score: Number(g.score), weight: Number(g.weight ?? 1) }));
  const attendanceRows = attendance.map((a) => ({ status: String(a.status) }));
  const notifications: NotificationRow[] = notificationDocs.map((n) => ({
    id: String(n._id), type: String(n.type), title: String(n.title), body: n.body ?? null, link: n.link ?? null,
    read_at: iso(n.read_at), created_at: iso(n.created_at) ?? "",
  }));

  const tasks: FollowUpTask[] = [];
  // A class/subject can have two periods on the same day; list it once.
  const seen = new Set<string>();
  for (const l of lessons) {
    const key = `${l.class_id}:${l.subject_id}`;
    if (l.attendance_taken || seen.has(key)) continue;
    seen.add(key);
    tasks.push({
      kind: "attendance_missing",
      title: `Take attendance — ${l.class_name} ${l.subject_name}`,
      detail: `Lesson at ${l.start_time} today has no attendance recorded yet.`,
      href: `/teacher/attendance?class=${l.class_id}&subject=${l.subject_id}&date=${today}`,
    });
  }
  for (const a of ungraded) {
    tasks.push({
      kind: "grades_missing",
      title: `Enter grades — ${a.title}`,
      detail: `${a.class_name} · ${a.subject_name}, due ${formatDate(a.due_date)}. No grades entered yet.`,
      href: `/teacher/gradebook?class=${a.class_id}&subject=${a.subject_id}`,
    });
  }

  return {
    today,
    classes,
    assignments,
    lessons,
    upcoming,
    tasks,
    notifications,
    stats: {
      studentsTaught: enrolledStudents.length,
      averageGrade: subjectAverage(gradeRows),
      gradeCount: gradeRows.length,
      attendanceRate: attendanceRate(attendanceRows),
      attendanceRecords: attendanceRows.length,
    },
  };
}

// ───────────── Rosters ─────────────

export interface RosterStudent extends StudentRef {
  subjectAverages: Record<string, number | null>;
  average: number | null;
  gradeCount: number;
  attendanceRate: number | null;
  attendanceRecords: number;
  absences: number;
}

export interface ClassRoster {
  id: string;
  name: string;
  grade_level: number;
  is_homeroom: boolean;
  homeroom_teacher: string | null;
  subjects: SubjectRef[];
  students: RosterStudent[];
}

/** Null when the class doesn't exist or the teacher neither teaches it nor is its homeroom teacher. */
export async function getClassRoster(actor: Actor, classId: string): Promise<ClassRoster | null> {
  assertRole(actor, "teacher");
  if (!isUuid(classId)) return null;
  const t = tenant(actor);
  const cls = await t.classes.findOne({ _id: classId });
  if (!cls || !(await teachesClass(t, actor, classId))) return null;
  const homeroom = cls.homeroom_teacher_id ? await t.profiles.findOne({ _id: String(cls.homeroom_teacher_id) }, { projection: { display_name: 1 } }) : null;
  const subjects = (await myAssignments(t, actor))
    .filter((a) => a.class_id === classId)
    .map((a) => ({ id: a.subject_id, name: a.subject_name, color: a.subject_color }));
  const subjectIds = subjects.map((s) => s.id);
  const [students, grades, attendance] = await Promise.all([
    classStudents(t, classId),
    // Grades only for subjects the teacher teaches here.
    subjectIds.length ? t.grades.find({ class_id: classId, subject_id: { $in: subjectIds } }, { projection: { student_id: 1, subject_id: 1, score: 1, weight: 1 } }) : Promise.resolve([]),
    // Homeroom-only teachers see attendance across the class's subjects.
    t.attendance.find(subjectIds.length ? { class_id: classId, subject_id: { $in: subjectIds } } : { class_id: classId }, { projection: { student_id: 1, status: 1 } }),
  ]);
  return {
    id: String(cls._id),
    name: String(cls.name),
    grade_level: Number(cls.grade_level),
    is_homeroom: cls.homeroom_teacher_id === actor.id,
    homeroom_teacher: homeroom ? String(homeroom.display_name) : null,
    subjects,
    students: students.map((s) => {
      const mine = grades.filter((g) => g.student_id === s.id).map((g) => ({ subject_id: String(g.subject_id), score: Number(g.score), weight: Number(g.weight ?? 1) }));
      const subjectAverages: Record<string, number | null> = {};
      for (const sub of subjects) subjectAverages[sub.id] = subjectAverage(mine.filter((g) => g.subject_id === sub.id));
      const att = attendance.filter((a) => a.student_id === s.id).map((a) => ({ status: String(a.status) }));
      return {
        ...s,
        subjectAverages,
        average: overallAverage(Object.values(subjectAverages)),
        gradeCount: mine.length,
        attendanceRate: attendanceRate(att),
        attendanceRecords: att.length,
        absences: att.filter((a) => a.status === "absent").length,
      };
    }),
  };
}

// ───────────── Gradebook ─────────────

export interface GradeEntry {
  id: string;
  student_id: string;
  score: number;
  weight: number;
  kind: GradeKind;
  assessment_id: string | null;
  graded_on: string;
  comment: string | null;
}

export interface GradebookStudent extends StudentRef {
  grades: GradeEntry[];
  average: number | null;
  formula: string | null;
}

export interface Gradebook {
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  assessments: Array<{ id: string; title: string; kind: GradeKind; due_date: string }>;
  /** Assessments shown as gradebook columns: already due, or already graded. */
  columns: Array<{ id: string; title: string; kind: GradeKind; due_date: string }>;
  students: GradebookStudent[];
  classAverage: number | null;
  gradeCount: number;
}

export async function getGradebook(actor: Actor, classId: string, subjectId: string): Promise<Gradebook> {
  assertRole(actor, "teacher");
  const today = todayIn(actor.timezone);
  const t = tenant(actor);
  await requireAssignment(t, actor, classId, subjectId);
  const [n, students, gradeDocs, assessmentDocs] = await Promise.all([
    names(t, classId, subjectId),
    classStudents(t, classId),
    t.grades.find({ class_id: classId, subject_id: subjectId }, { sort: { graded_on: 1, created_at: 1 } }),
    t.assessments.find({ class_id: classId, subject_id: subjectId }, { sort: { due_date: 1, title: 1 } }),
  ]);
  const grades: GradeEntry[] = gradeDocs.map((g) => ({
    id: String(g._id), student_id: String(g.student_id), score: Number(g.score), weight: Number(g.weight ?? 1), kind: g.kind as GradeKind,
    assessment_id: g.assessment_id ? String(g.assessment_id) : null, graded_on: String(g.graded_on), comment: g.comment ?? null,
  }));
  const assessments = assessmentDocs.map((a) => ({ id: String(a._id), title: String(a.title), kind: a.kind as GradeKind, due_date: String(a.due_date) }));
  const graded = new Set(grades.map((g) => g.assessment_id).filter(Boolean));
  const enrolled = new Set(students.map((s) => s.id));
  return {
    classId,
    className: n.class_name,
    subjectId,
    subjectName: n.subject_name,
    assessments,
    columns: assessments.filter((a) => a.due_date <= today || graded.has(a.id)),
    students: students.map((s) => {
      const g = grades.filter((x) => x.student_id === s.id);
      return { ...s, grades: g, average: subjectAverage(g), formula: averageFormula(g) };
    }),
    classAverage: subjectAverage(grades.filter((g) => enrolled.has(g.student_id))),
    gradeCount: grades.length,
  };
}

const gradeFields = {
  score: z.coerce
    .number({ message: "Enter a score between 1 and 10." })
    .min(1, "Scores go from 1 to 10.")
    .max(10, "Scores go from 1 to 10.")
    .transform(round2),
  weight: z.coerce
    .number({ message: "Enter a weight between 0.5 and 5." })
    .min(0.5, "Weight must be between 0.5 and 5.")
    .max(5, "Weight must be between 0.5 and 5.")
    .transform((v) => Math.round(v * 10) / 10),
  kind: z.enum(GRADE_KINDS, { message: "Choose a grade type." }),
  assessmentId: z.preprocess(emptyToNull, uuid.nullable()),
  gradedOn: isoDate,
  comment: z.preprocess((v) => (typeof v === "string" ? v : ""), z.string().trim().max(500, "Keep the comment under 500 characters.")).transform((v) => v || null),
};

export const gradeInputSchema = z.object({
  classId: uuid,
  subjectId: uuid,
  studentId: z.string({ message: "Choose a student." }).uuid("Choose a student."),
  ...gradeFields,
});
export type GradeInput = z.infer<typeof gradeInputSchema>;

export const gradeUpdateSchema = z.object({ gradeId: uuid, ...gradeFields });
export type GradeUpdate = z.infer<typeof gradeUpdateSchema>;

function assertNotFuture(actor: Actor, date: string, what: string) {
  if (!isIsoDate(date)) throw new UserFacingError("Choose a valid date.");
  if (date > todayIn(actor.timezone)) throw new UserFacingError(`The ${what} date can't be in the future.`);
}

async function assertAssessmentMatches(t: Tenant, assessmentId: string | null, classId: string, subjectId: string) {
  if (!assessmentId) return;
  if (!(await t.assessments.count({ _id: assessmentId, class_id: classId, subject_id: subjectId }))) {
    throw new UserFacingError("That assessment belongs to a different class or subject.");
  }
}

export async function addGrade(actor: Actor, input: GradeInput): Promise<string> {
  assertRole(actor, "teacher");
  assertNotFuture(actor, input.gradedOn, "grade");
  const t = tenant(actor);
  // Former RLS `grades_insert`: can_teach(class, subject) AND is_enrolled(student, class).
  await requireAssignment(t, actor, input.classId, input.subjectId);
  if (!isUuid(input.studentId) || !(await isEnrolled(t, input.studentId, input.classId))) throw new UserFacingError("This student isn't enrolled in the class.");
  await assertAssessmentMatches(t, input.assessmentId, input.classId, input.subjectId);
  const { subject_name } = await names(t, input.classId, input.subjectId);
  const id = await t.grades.insertOne({
    student_id: input.studentId, class_id: input.classId, subject_id: input.subjectId, assessment_id: input.assessmentId,
    score: input.score, weight: input.weight, kind: input.kind, comment: input.comment, graded_on: input.gradedOn,
    entered_by: actor.id, is_demo: false, updated_at: new Date(),
  });
  await audit({
    schoolId: actor.schoolId, actorId: actor.id, action: "grade.created", resourceType: "grade", resourceId: id,
    metadata: { classId: input.classId, subjectId: input.subjectId, studentId: input.studentId },
  });
  // Neutral wording: no score in the notification, so previews leak nothing.
  await notify(actor.schoolId, [input.studentId], {
    type: "grade_update",
    title: `New grade in ${subject_name}`,
    body: "Your teacher added a new grade. Open Grades to see it.",
    link: "/student/academics/grades",
  });
  return id;
}

async function loadEditableGrade(t: Tenant, actor: Actor, gradeId: string) {
  const g = isUuid(gradeId) ? await t.grades.findOne({ _id: gradeId }, { projection: { class_id: 1, subject_id: 1, student_id: 1 } }) : null;
  if (!g) throw new UserFacingError("That grade no longer exists.");
  const row = { id: String(g._id), class_id: String(g.class_id), subject_id: String(g.subject_id), student_id: String(g.student_id) };
  if (!(await canTeach(t, actor, row.class_id, row.subject_id))) throw new AuthorizationError("Only the subject teacher can change this grade.");
  return row;
}

export async function updateGrade(actor: Actor, input: GradeUpdate): Promise<void> {
  assertRole(actor, "teacher");
  assertNotFuture(actor, input.gradedOn, "grade");
  const t = tenant(actor);
  // Former RLS `grades_update`: can_teach(class, subject) AND is_enrolled(student, class).
  const g = await loadEditableGrade(t, actor, input.gradeId);
  if (!(await isEnrolled(t, g.student_id, g.class_id))) throw new UserFacingError("This student is no longer enrolled in the class.");
  await assertAssessmentMatches(t, input.assessmentId, g.class_id, g.subject_id);
  const r = await t.grades.updateOne(
    { _id: g.id, class_id: g.class_id, subject_id: g.subject_id },
    { $set: { score: input.score, weight: input.weight, kind: input.kind, assessment_id: input.assessmentId, comment: input.comment, graded_on: input.gradedOn, updated_at: new Date() } },
  );
  if (r.matched === 0) throw new UserFacingError("That grade no longer exists.");
  await audit({
    schoolId: actor.schoolId, actorId: actor.id, action: "grade.updated", resourceType: "grade", resourceId: g.id,
    metadata: { classId: g.class_id, subjectId: g.subject_id, studentId: g.student_id },
  });
}

export async function deleteGrade(actor: Actor, gradeId: string): Promise<void> {
  assertRole(actor, "teacher");
  if (!isUuid(gradeId)) throw new UserFacingError("That grade no longer exists.");
  const t = tenant(actor);
  // Former RLS `grades_delete`: can_teach(class, subject).
  const g = await loadEditableGrade(t, actor, gradeId);
  const n = await t.grades.deleteOne({ _id: g.id, class_id: g.class_id, subject_id: g.subject_id });
  if (n === 0) throw new UserFacingError("That grade no longer exists.");
  await audit({
    schoolId: actor.schoolId, actorId: actor.id, action: "grade.deleted", resourceType: "grade", resourceId: g.id,
    metadata: { classId: g.class_id, subjectId: g.subject_id, studentId: g.student_id },
  });
}

// ───────────── Attendance ─────────────

export interface AttendanceSheetRow extends StudentRef {
  status: AttendanceStatus | null;
  note: string | null;
  recentRate: number | null;
  recentRecords: number;
}

export interface AttendanceDaySummary {
  date: string;
  present: number;
  late: number;
  absent: number;
  excused: number;
  total: number;
  rate: number | null;
}

export async function getAttendanceSheet(actor: Actor, classId: string, subjectId: string, date: string) {
  assertRole(actor, "teacher");
  if (!isIsoDate(date)) throw new UserFacingError("Choose a valid date.");
  const t = tenant(actor);
  await requireAssignment(t, actor, classId, subjectId);
  const [n, students, existingDocs, lessonDocs, recentDocs] = await Promise.all([
    names(t, classId, subjectId),
    classStudents(t, classId),
    t.attendance.find({ class_id: classId, subject_id: subjectId, date }, { projection: { student_id: 1, status: 1, note: 1 } }),
    t.timetable.find({ class_id: classId, subject_id: subjectId, weekday: isoWeekday(date) }, { sort: { start_time: 1 } }),
    t.attendance.find({ class_id: classId, subject_id: subjectId, date: { $gte: addDays(date, -29), $lte: date } }, { projection: { student_id: 1, status: 1, date: 1 } }),
  ]);
  const existing = existingDocs.map((e) => ({ student_id: String(e.student_id), status: e.status as AttendanceStatus, note: e.note ?? null }));
  const lessons = lessonDocs.map((l) => ({ start_time: String(l.start_time), end_time: String(l.end_time), room: l.room ?? null }));
  const recent = recentDocs.map((r) => ({ student_id: String(r.student_id), status: String(r.status), date: String(r.date) }));
  const byStudent = new Map(existing.map((e) => [e.student_id, e]));
  const days = new Map<string, AttendanceDaySummary>();
  for (const r of recent) {
    const d = days.get(r.date) ?? { date: r.date, present: 0, late: 0, absent: 0, excused: 0, total: 0, rate: null };
    if (r.status in d) d[r.status as AttendanceStatus]++;
    d.total++;
    days.set(r.date, d);
  }
  const summary = [...days.values()]
    .map((d) => ({ ...d, rate: d.total ? Math.round(((d.present + d.late) / d.total) * 1000) / 10 : null }))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 10);
  return {
    classId,
    className: n.class_name,
    subjectId,
    subjectName: n.subject_name,
    date,
    lessons,
    recorded: existing.length,
    overallRate: attendanceRate(recent),
    summary,
    students: students.map<AttendanceSheetRow>((s) => {
      const mine = recent.filter((r) => r.student_id === s.id);
      return {
        ...s,
        status: byStudent.get(s.id)?.status ?? null,
        note: byStudent.get(s.id)?.note ?? null,
        recentRate: attendanceRate(mine),
        recentRecords: mine.length,
      };
    }),
  };
}

export const attendanceSaveSchema = z.object({
  classId: uuid,
  subjectId: uuid,
  date: isoDate,
  entries: z
    .array(
      z.object({
        studentId: uuid,
        status: z.enum(ATTENDANCE_STATUSES, { message: "Choose a status for every student." }),
        note: z.string().trim().max(300, "Keep notes under 300 characters.").transform((v) => v || null),
      }),
    )
    .min(1, "There are no students to mark."),
});
export type AttendanceSave = z.infer<typeof attendanceSaveSchema>;

export async function saveAttendance(actor: Actor, input: AttendanceSave): Promise<number> {
  assertRole(actor, "teacher");
  assertNotFuture(actor, input.date, "attendance");
  const t = tenant(actor);
  // Former RLS `attendance_insert/update`: can_teach(class, subject) AND is_enrolled(student, class).
  await requireAssignment(t, actor, input.classId, input.subjectId);
  const enrolled = new Set((await t.enrollments.find({ class_id: input.classId }, { projection: { student_id: 1 } })).map((e) => String(e.student_id)));
  if (input.entries.some((e) => !enrolled.has(e.studentId))) throw new UserFacingError("Some students are no longer in this class. Reload and try again.");
  // Upsert on the unique key (student, class, subject, date). Sequential to avoid duplicate-key races.
  for (const e of input.entries) {
    await t.attendance.updateOne(
      { student_id: e.studentId, class_id: input.classId, subject_id: input.subjectId, date: input.date },
      { $set: { status: e.status, note: e.note, entered_by: actor.id, updated_at: new Date() }, $setOnInsert: { _id: newId(), created_at: new Date() } },
      { upsert: true },
    );
  }
  await audit({
    schoolId: actor.schoolId, actorId: actor.id, action: "attendance.recorded", resourceType: "class", resourceId: input.classId,
    metadata: { subjectId: input.subjectId, date: input.date, students: input.entries.length },
  });
  return input.entries.length;
}

// ───────────── Assessments ─────────────

export async function listTeacherAssessments(actor: Actor): Promise<{ upcoming: TeacherAssessment[]; recent: TeacherAssessment[] }> {
  assertRole(actor, "teacher");
  const today = todayIn(actor.timezone);
  const t = tenant(actor);
  const rows = await teacherAssessments(t, await myAssignments(t, actor), addDays(today, -30));
  return {
    upcoming: rows.filter((r) => r.due_date >= today),
    recent: rows.filter((r) => r.due_date < today).reverse(),
  };
}

export const assessmentSchema = z.object({
  classId: z.string({ message: "Choose a class and subject." }).uuid("Choose a class and subject."),
  subjectId: z.string({ message: "Choose a class and subject." }).uuid("Choose a class and subject."),
  title: z.string().trim().min(1, "Give the assessment a title.").max(120, "Keep the title under 120 characters."),
  kind: z.enum(GRADE_KINDS, { message: "Choose a type." }),
  dueDate: isoDate,
  description: z.preprocess((v) => (typeof v === "string" ? v : ""), z.string().trim().max(2000, "Keep the description under 2000 characters.")).transform((v) => v || null),
});
export type AssessmentInput = z.infer<typeof assessmentSchema>;

export async function createAssessment(actor: Actor, input: AssessmentInput): Promise<string> {
  assertRole(actor, "teacher");
  const today = todayIn(actor.timezone);
  if (!isIsoDate(input.dueDate)) throw new UserFacingError("Choose a valid date.");
  if (input.dueDate < today) throw new UserFacingError("Choose today or a later date for an upcoming assessment.");
  if (input.dueDate > addDays(today, 366)) throw new UserFacingError("Choose a date within the next year.");
  const t = tenant(actor);
  // Former RLS `assessments_write`: can_teach(class, subject).
  await requireAssignment(t, actor, input.classId, input.subjectId);
  const { subject_name } = await names(t, input.classId, input.subjectId);
  const id = await t.assessments.insertOne({
    class_id: input.classId, subject_id: input.subjectId, title: input.title, kind: input.kind, due_date: input.dueDate,
    description: input.description, created_by: actor.id,
  });
  await audit({
    schoolId: actor.schoolId, actorId: actor.id, action: "assessment.created", resourceType: "assessment", resourceId: id,
    metadata: { classId: input.classId, subjectId: input.subjectId },
  });
  const studentIds = (await classStudents(t, input.classId)).filter((s) => s.account_state === "active").map((s) => s.id);
  await notify(actor.schoolId, studentIds, {
    type: "academic_event",
    title: `New ${GRADE_KIND_LABELS[input.kind].toLowerCase()} in ${subject_name}`,
    body: `${input.title} — ${formatDate(input.dueDate, { weekday: "short", day: "numeric", month: "short" })}`,
    link: "/student/academics",
  });
  return id;
}

export async function deleteAssessment(actor: Actor, assessmentId: string): Promise<void> {
  assertRole(actor, "teacher");
  if (!isUuid(assessmentId)) throw new UserFacingError("That assessment no longer exists.");
  const t = tenant(actor);
  const a = await t.assessments.findOne({ _id: assessmentId }, { projection: { class_id: 1, subject_id: 1 } });
  if (!a) throw new UserFacingError("That assessment no longer exists.");
  const classId = String(a.class_id);
  const subjectId = String(a.subject_id);
  if (!(await canTeach(t, actor, classId, subjectId))) throw new AuthorizationError();
  if ((await t.grades.count({ assessment_id: assessmentId })) > 0) throw new UserFacingError("This assessment already has grades, so it can't be removed.");
  await t.assessments.deleteOne({ _id: assessmentId, class_id: classId, subject_id: subjectId });
  await audit({
    schoolId: actor.schoolId, actorId: actor.id, action: "assessment.deleted", resourceType: "assessment", resourceId: assessmentId,
    metadata: { classId, subjectId },
  });
}

// ───────────── Analytics (academic only) ─────────────

export interface AnalyticsFilters {
  classId: string | null;
  subjectId: string | null;
  from: string;
  to: string;
}

export interface SupportFlag {
  studentId: string;
  displayName: string;
  avatarColor: string;
  avatarEmoji: string | null;
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  average: number;
  gradeCount: number;
  reasons: string[];
}

export async function getTeacherAnalytics(actor: Actor, filters: AnalyticsFilters) {
  assertRole(actor, "teacher");
  if (!isIsoDate(filters.from) || !isIsoDate(filters.to) || filters.from > filters.to) throw new UserFacingError("Choose a valid date range.");
  const t = tenant(actor);
  const assignments = await myAssignments(t, actor);
  if (filters.classId && !assignments.some((a) => a.class_id === filters.classId)) throw new AuthorizationError("You don't teach this class.");
  if (filters.subjectId && !assignments.some((a) => a.subject_id === filters.subjectId)) throw new AuthorizationError("You don't teach this subject.");
  const scope = assignments.filter(
    (a) => (!filters.classId || a.class_id === filters.classId) && (!filters.subjectId || a.subject_id === filters.subjectId),
  );
  const pairs = pairFilter(scope);
  const classIds = uniq(scope.map((a) => a.class_id));
  const [students, gradeDocs, attendanceDocs] = await Promise.all([
    studentsOf(t, classIds),
    pairs ? t.grades.find({ ...pairs, graded_on: { $gte: filters.from, $lte: filters.to } }, { sort: { graded_on: 1, created_at: 1 } }) : Promise.resolve([]),
    pairs ? t.attendance.find({ ...pairs, date: { $gte: filters.from, $lte: filters.to } }, { projection: { class_id: 1, status: 1 } }) : Promise.resolve([]),
  ]);
  // Only grades of students currently enrolled in the class.
  const enrolled = new Set(students.map((s) => `${s.class_id}:${s.id}`));
  const grades = gradeDocs
    .map((g) => ({
      student_id: String(g.student_id), class_id: String(g.class_id), subject_id: String(g.subject_id),
      score: Number(g.score), weight: Number(g.weight ?? 1), graded_on: String(g.graded_on),
    }))
    .filter((g) => enrolled.has(`${g.class_id}:${g.student_id}`));
  const attendance = attendanceDocs.map((a) => ({ class_id: String(a.class_id), status: String(a.status) }));

  const subjects = [...new Map(scope.map((a) => [a.subject_id, a.subject_name])).entries()];
  const classes = [...new Map(scope.map((a) => [a.class_id, a.class_name])).entries()];

  const subjectAverages = subjects.map(([id, name]) => ({ label: name, value: subjectAverage(grades.filter((g) => g.subject_id === id)) }));
  const classAverages = classes.map(([id, name]) => ({ label: name, value: subjectAverage(grades.filter((g) => g.class_id === id)) }));
  const histogram = Array.from({ length: 10 }, (_, i) => ({
    label: String(i + 1),
    value: grades.filter((g) => Math.min(10, Math.max(1, Math.round(g.score))) === i + 1).length,
  }));
  const distribution = [
    { label: "Below 5", value: grades.filter((g) => g.score < 5).length },
    { label: "5 – 7.99", value: grades.filter((g) => g.score >= 5 && g.score < 8).length },
    { label: "8 – 10", value: grades.filter((g) => g.score >= 8).length },
  ];
  const weeks = new Map<string, Array<{ score: number; weight: number }>>();
  for (const g of grades) {
    const w = weekStart(g.graded_on);
    weeks.set(w, [...(weeks.get(w) ?? []), g]);
  }
  const weekly = [...weeks.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([w, gs]) => ({ label: formatDate(w), week: w, value: subjectAverage(gs), count: gs.length }));
  const attendanceByClass = classes.map(([id, name]) => ({ label: name, value: attendanceRate(attendance.filter((a) => a.class_id === id)) }));

  // Students who may need academic support, per class & subject in scope.
  const flags: SupportFlag[] = [];
  const subjectName = new Map(subjects);
  const className = new Map(classes);
  for (const s of students) {
    for (const a of scope.filter((x) => x.class_id === s.class_id)) {
      const gs = grades.filter((g) => g.student_id === s.id && g.class_id === a.class_id && g.subject_id === a.subject_id);
      const avg = subjectAverage(gs);
      if (avg === null) continue;
      const reasons: string[] = [];
      if (avg < SUPPORT_THRESHOLD) reasons.push(`Average ${avg} is below ${SUPPORT_THRESHOLD}`);
      if (gs.length >= 4) {
        const recent = subjectAverage(gs.slice(-2))!;
        const earlier = subjectAverage(gs.slice(0, -2))!;
        if (earlier - recent >= FALLING_DROP) reasons.push(`Falling: last two grades average ${recent} vs ${earlier} before`);
      }
      if (reasons.length) {
        flags.push({
          studentId: s.id, displayName: s.display_name, avatarColor: s.avatar_color, avatarEmoji: s.avatar_emoji,
          classId: a.class_id, className: className.get(a.class_id) ?? "",
          subjectId: a.subject_id, subjectName: subjectName.get(a.subject_id) ?? "",
          average: avg, gradeCount: gs.length, reasons,
        });
      }
    }
  }
  flags.sort((a, b) => a.average - b.average);

  return {
    assignments,
    scopeCount: scope.length,
    studentCount: new Set(students.map((s) => s.id)).size,
    gradeCount: grades.length,
    average: subjectAverage(grades),
    attendanceRate: attendanceRate(attendance),
    attendanceRecords: attendance.length,
    subjectAverages,
    classAverages,
    histogram,
    distribution,
    weekly,
    attendanceByClass,
    flags,
  };
}

// ───────────── Class wellbeing (aggregate only) ─────────────

/** Aggregate wellbeing for one class the teacher teaches (or is homeroom for). */
export async function getClassWellbeingSummary(actor: Actor, classId: string, from: string, to: string): Promise<WellbeingSummary> {
  assertRole(actor, "teacher");
  if (!isUuid(classId) || !isIsoDate(from) || !isIsoDate(to)) throw new UserFacingError("Choose a valid class and date range.");
  if (!(await teachesClass(tenant(actor), actor, classId))) throw new AuthorizationError("You can only view aggregates for classes you teach.");
  return classSummary(actor, classId, from, to);
}

export async function getTeacherWellbeing(actor: Actor, days: WellbeingWindow) {
  assertRole(actor, "teacher");
  if (!WELLBEING_WINDOWS.includes(days)) throw new UserFacingError("Choose 7, 14 or 30 days.");
  const to = todayIn(actor.timezone);
  const from = addDays(to, -(days - 1));
  const classes = await myClasses(tenant(actor), actor);
  const out: Array<{ class: TeacherClass; summary: WellbeingSummary }> = [];
  for (const c of classes) out.push({ class: c, summary: await classSummary(actor, c.id, from, to) });
  await audit({
    schoolId: actor.schoolId, actorId: actor.id, action: "wellbeing.class_summary.viewed", resourceType: "class",
    metadata: { classes: classes.length, days },
  });
  return { from, to, days, classes: out };
}
