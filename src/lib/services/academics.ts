import { z } from "zod";
import { tenant } from "@/lib/db/tenant";
import { canReadAcademics } from "@/lib/authz";
import { AuthorizationError } from "./errors";
import { addDays, isoWeekday, todayIn } from "@/lib/dates";
import { attendanceRate, overallAverage, practiceRecommendations, subjectAverage, type PracticeRecommendation } from "@/lib/engines/grades";
import type { Actor } from "./actor";
import { assertRole } from "./actor";

export interface GradeRow {
  id: string;
  subject_id: string;
  subject_name: string;
  subject_color: string;
  score: number;
  weight: number;
  kind: string;
  graded_on: string;
  comment: string | null;
  assessment_title: string | null;
  is_demo: boolean;
}

export interface SubjectSummary {
  subjectId: string;
  name: string;
  color: string;
  average: number | null;
  grades: GradeRow[];
  attendance: { total: number; absent: number; late: number; excused: number; rate: number | null };
}

export interface AssessmentRow {
  id: string;
  title: string;
  kind: string;
  due_date: string;
  description: string | null;
  subject_name: string;
  subject_color: string;
}

export interface TimetableRow {
  id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  room: string | null;
  subject_name: string;
  subject_color: string;
  teacher_name: string | null;
}

/** Load the academic picture for a student the actor may read (self, teacher, admin, or guardian with consent). */
export async function loadStudentAcademics(actor: Actor, studentId: string, today: string) {
  const t = tenant(actor);
  if (!(await canReadAcademics(t, actor, studentId))) throw new AuthorizationError();
  const enrollments = await t.enrollments.find({ student_id: studentId });
  const classIds = enrollments.map((e) => String(e.class_id));
  const [classDocs, subjectDocs, assignmentDocs, gradeDocs, attendanceDocs, upcomingDocs] = await Promise.all([
    t.classes.find({ _id: { $in: classIds } }),
    t.subjects.find({}),
    t.teachingAssignments.find({ class_id: { $in: classIds } }),
    t.grades.find({ student_id: studentId }, { sort: { graded_on: -1, created_at: -1 } }),
    t.attendance.find({ student_id: studentId }, { sort: { date: -1 } }),
    t.assessments.find({ class_id: { $in: classIds }, due_date: { $gte: today, $lte: addDays(today, 30) } }, { sort: { due_date: 1 } }),
  ]);
  const subjectById = new Map(subjectDocs.map((x) => [String(x._id), x]));
  const assessmentTitles = new Map(
    (await t.assessments.find({ _id: { $in: gradeDocs.map((g) => g.assessment_id).filter(Boolean) } }, { projection: { title: 1 } })).map((a) => [String(a._id), String(a.title)]),
  );
  const grades: GradeRow[] = gradeDocs.map((g) => ({
    id: String(g._id), subject_id: String(g.subject_id), subject_name: subjectById.get(String(g.subject_id))?.name ?? "?",
    subject_color: subjectById.get(String(g.subject_id))?.color ?? "coral", score: Number(g.score), weight: Number(g.weight ?? 1), kind: g.kind,
    graded_on: String(g.graded_on), comment: g.comment ?? null, assessment_title: g.assessment_id ? assessmentTitles.get(String(g.assessment_id)) ?? null : null, is_demo: Boolean(g.is_demo),
  }));
  const attendance = attendanceDocs.map((a) => ({ subject_id: String(a.subject_id), status: String(a.status), date: String(a.date), subject_name: subjectById.get(String(a.subject_id))?.name ?? "?" }));
  const classes = classDocs.map((c) => ({ class_id: String(c._id), name: String(c.name) }));
  const subjects = [...new Set(assignmentDocs.map((a) => String(a.subject_id)))]
    .map((id) => subjectById.get(id))
    .filter((x): x is NonNullable<typeof x> => Boolean(x))
    .map((x) => ({ id: String(x._id), name: String(x.name), color: String(x.color) }))
    .sort((x, y) => x.name.localeCompare(y.name));
  const upcoming: AssessmentRow[] = upcomingDocs.map((a) => ({
    id: String(a._id), title: a.title, kind: a.kind, due_date: String(a.due_date), description: a.description ?? null,
    subject_name: subjectById.get(String(a.subject_id))?.name ?? "?", subject_color: subjectById.get(String(a.subject_id))?.color ?? "coral",
  }));

  const summaries: SubjectSummary[] = subjects.map((s) => {
    const g = grades.filter((x) => x.subject_id === s.id);
    const att = attendance.filter((a) => a.subject_id === s.id);
    return {
      subjectId: s.id,
      name: s.name,
      color: s.color,
      average: subjectAverage(g),
      grades: g,
      attendance: {
        total: att.length,
        absent: att.filter((a) => a.status === "absent").length,
        late: att.filter((a) => a.status === "late").length,
        excused: att.filter((a) => a.status === "excused").length,
        rate: attendanceRate(att),
      },
    };
  });
  const recommendations: PracticeRecommendation[] = practiceRecommendations(
    summaries.map((s) => ({ subjectId: s.subjectId, subjectName: s.name, grades: s.grades.map((g) => ({ score: g.score, weight: g.weight, gradedOn: g.graded_on })) })),
  );
  return {
    className: classes.map((c) => c.name).join(", ") || null,
    classIds,
    subjects: summaries,
    grades,
    attendance,
    overall: overallAverage(summaries.map((s) => s.average)),
    attendanceRate: attendanceRate(attendance),
    upcoming,
    recommendations,
  };
}

export type StudentAcademics = Awaited<ReturnType<typeof loadStudentAcademics>>;

export async function getStudentAcademics(actor: Actor): Promise<StudentAcademics> {
  assertRole(actor, "student");
  return loadStudentAcademics(actor, actor.id, todayIn(actor.timezone));
}

export async function getTimetable(actor: Actor, studentId = actor.id): Promise<TimetableRow[]> {
  const t = tenant(actor);
  if (!(await canReadAcademics(t, actor, studentId))) throw new AuthorizationError();
  const classIds = (await t.enrollments.find({ student_id: studentId })).map((e) => String(e.class_id));
  const [entries, subjects, teachers] = await Promise.all([
    t.timetable.find({ class_id: { $in: classIds } }, { sort: { weekday: 1, start_time: 1 } }),
    t.subjects.find({}),
    t.profiles.find({ role: "teacher" }, { projection: { display_name: 1 } }),
  ]);
  const subjectById = new Map(subjects.map((x) => [String(x._id), x]));
  const teacherById = new Map(teachers.map((x) => [String(x._id), String(x.display_name)]));
  return entries.map((e) => ({
    id: String(e._id), weekday: Number(e.weekday), start_time: String(e.start_time), end_time: String(e.end_time), room: e.room ?? null,
    subject_name: subjectById.get(String(e.subject_id))?.name ?? "?", subject_color: subjectById.get(String(e.subject_id))?.color ?? "coral",
    teacher_name: e.teacher_id ? teacherById.get(String(e.teacher_id)) ?? null : null,
  }));
}

export function todaysLessons(timetable: TimetableRow[], today: string): TimetableRow[] {
  const wd = isoWeekday(today);
  return timetable.filter((t) => t.weekday === wd);
}

export interface Goal {
  id: string;
  title: string;
  subject_id: string | null;
  subject_name: string | null;
  target_average: number | null;
  done: boolean;
}

export async function listGoals(actor: Actor): Promise<Goal[]> {
  assertRole(actor, "student");
  const t = tenant(actor);
  const [goals, subjects] = await Promise.all([t.goals.find({ student_id: actor.id }, { sort: { done: 1, created_at: -1 } }), t.subjects.find({})]);
  const names = new Map(subjects.map((x) => [String(x._id), String(x.name)]));
  return goals.map((g) => ({
    id: String(g._id), title: g.title, subject_id: g.subject_id ?? null, subject_name: g.subject_id ? names.get(String(g.subject_id)) ?? null : null,
    target_average: g.target_average ?? null, done: Boolean(g.done),
  }));
}

export const goalSchema = z.object({
  title: z.string().trim().min(2, "Describe your goal.").max(160),
  subjectId: z.string().uuid().nullable(),
  targetAverage: z.coerce.number().min(1).max(10).nullable(),
});

export async function addGoal(actor: Actor, input: z.infer<typeof goalSchema>): Promise<void> {
  assertRole(actor, "student");
  const t = tenant(actor);
  if (input.subjectId && !(await t.subjects.count({ _id: input.subjectId }))) throw new AuthorizationError();
  await t.goals.insertOne({ student_id: actor.id, title: input.title, subject_id: input.subjectId, target_average: input.targetAverage, done: false });
}

export async function toggleGoal(actor: Actor, goalId: string): Promise<void> {
  const t = tenant(actor);
  const g = await t.goals.findOne({ _id: goalId, student_id: actor.id });
  if (g) await t.goals.updateOne({ _id: goalId, student_id: actor.id }, { $set: { done: !g.done } });
}

export async function deleteGoal(actor: Actor, goalId: string): Promise<void> {
  await tenant(actor).goals.deleteOne({ _id: goalId, student_id: actor.id });
}
