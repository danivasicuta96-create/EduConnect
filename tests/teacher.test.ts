import { describe, expect, it, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import type { Document, Filter } from "mongodb";
import path from "node:path";
import { col, COLLECTIONS } from "@/lib/db/mongo";
import { tenant } from "@/lib/db/tenant";
import { addDays, todayIn } from "@/lib/dates";
import {
  addGrade, deleteGrade, getAttendanceSheet, getClassRoster, getClassWellbeingSummary, getGradebook, getTeacherAnalytics,
  getTeacherDashboard, getTeacherWellbeing, saveAttendance, updateGrade, createAssessment, deleteAssessment, listTeacherAssessments,
} from "@/lib/services/teacher";
import { actorFor, DEMO } from "./helpers";

type Ids = {
  aurora: string; birch: string; class9A: string; class10B: string; classBirch: string;
  math: string; romanian: string; birchMath: string; maria: string; emil: string;
};
let ids: Ids;

beforeAll(async () => {
  const id = async (name: (typeof COLLECTIONS)[keyof typeof COLLECTIONS], filter: Filter<Document & { _id: string }>) => {
    const doc = await (await col(name)).findOne(filter);
    if (!doc) throw new Error(`Missing ${name} ${JSON.stringify(filter)}`);
    return String(doc._id);
  };
  const aurora = await id(COLLECTIONS.schools, { join_code: "AURORA-DEMO" });
  const birch = await id(COLLECTIONS.schools, { join_code: "BIRCH-DEMO" });
  const userId = (email: string) => id(COLLECTIONS.users, { email });
  ids = {
    aurora,
    birch,
    class9A: await id(COLLECTIONS.classes, { name: "9A", school_id: aurora }),
    class10B: await id(COLLECTIONS.classes, { name: "10B", school_id: aurora }),
    classBirch: await id(COLLECTIONS.classes, { name: "9X", school_id: birch }),
    math: await id(COLLECTIONS.subjects, { name: "Mathematics", school_id: aurora }),
    romanian: await id(COLLECTIONS.subjects, { name: "Romanian Language", school_id: aurora }),
    birchMath: await id(COLLECTIONS.subjects, { name: "Mathematics", school_id: birch }),
    maria: await userId(DEMO.maria),
    emil: await userId(DEMO.otherStudent),
  };
});

const today = () => todayIn("Europe/Bucharest");
const grades = () => col(COLLECTIONS.grades);
const notifications = () => col(COLLECTIONS.notifications);

describe("teacher grades", () => {
  it("lets a teacher add, edit and delete a grade for their own class & subject, and notifies the student neutrally", async () => {
    const teacher = await actorFor(DEMO.mathTeacher);
    const id = await addGrade(teacher, {
      classId: ids.class9A, subjectId: ids.math, studentId: ids.maria, score: 9, weight: 2, kind: "test",
      assessmentId: null, gradedOn: today(), comment: "Great work",
    });
    const stored = await (await grades()).findOne({ _id: id });
    expect(stored).toMatchObject({ school_id: ids.aurora, entered_by: teacher.id, score: 9, graded_on: today() });

    const book = await getGradebook(teacher, ids.class9A, ids.math);
    const maria = book.students.find((s) => s.id === ids.maria)!;
    expect(maria.grades.some((g) => g.id === id && g.score === 9 && g.weight === 2)).toBe(true);
    expect(maria.formula).toContain("÷");

    const note = await (await notifications()).findOne({ user_id: ids.maria, type: "grade_update" }, { sort: { created_at: -1 } });
    expect(note?.title).toBe("New grade in Mathematics");
    expect(note?.body).not.toMatch(/\d/); // no score leaks into the notification

    await updateGrade(teacher, { gradeId: id, score: 8.5, weight: 1, kind: "quiz", assessmentId: null, gradedOn: today(), comment: null });
    const after = await (await grades()).findOne({ _id: id });
    expect({ score: after?.score, kind: after?.kind }).toEqual({ score: 8.5, kind: "quiz" });

    const audits = await (await col(COLLECTIONS.auditLogs)).find({ resource_id: id }).toArray();
    expect(audits.map((a) => a.action).sort()).toEqual(["grade.created", "grade.updated"]);

    await deleteGrade(teacher, id);
    expect(await (await grades()).findOne({ _id: id })).toBeNull();
  });

  it("refuses a grade for a subject the teacher doesn't teach", async () => {
    const teacher = await actorFor(DEMO.mathTeacher);
    const before = await (await grades()).countDocuments({ class_id: ids.class9A, subject_id: ids.romanian, student_id: ids.maria });
    await expect(
      addGrade(teacher, {
        classId: ids.class9A, subjectId: ids.romanian, studentId: ids.maria, score: 7, weight: 1, kind: "oral",
        assessmentId: null, gradedOn: today(), comment: null,
      }),
    ).rejects.toMatchObject({ name: "AuthorizationError" });
    expect(await (await grades()).countDocuments({ class_id: ids.class9A, subject_id: ids.romanian, student_id: ids.maria })).toBe(before);
  });

  it("refuses edits and deletes of another teacher's subject grades", async () => {
    const math = await actorFor(DEMO.mathTeacher);
    const ro = await actorFor(DEMO.roTeacher);
    const id = await addGrade(math, {
      classId: ids.class9A, subjectId: ids.math, studentId: ids.maria, score: 6, weight: 1, kind: "oral", assessmentId: null, gradedOn: today(), comment: null,
    });
    await expect(
      updateGrade(ro, { gradeId: id, score: 10, weight: 1, kind: "oral", assessmentId: null, gradedOn: today(), comment: null }),
    ).rejects.toMatchObject({ name: "AuthorizationError" });
    await expect(deleteGrade(ro, id)).rejects.toMatchObject({ name: "AuthorizationError" });
    expect((await (await grades()).findOne({ _id: id }))?.score).toBe(6);
    await deleteGrade(math, id);
  });

  it("refuses grades in the future, for students outside the class, and assessments of another class", async () => {
    const teacher = await actorFor(DEMO.mathTeacher);
    await expect(
      addGrade(teacher, { classId: ids.class9A, subjectId: ids.math, studentId: ids.maria, score: 7, weight: 1, kind: "oral", assessmentId: null, gradedOn: addDays(today(), 3), comment: null }),
    ).rejects.toMatchObject({ name: "UserFacingError" });
    await expect(
      addGrade(teacher, { classId: ids.class10B, subjectId: ids.math, studentId: ids.maria, score: 7, weight: 1, kind: "oral", assessmentId: null, gradedOn: today(), comment: null }),
    ).rejects.toMatchObject({ name: "UserFacingError" });
    const other = await (await col(COLLECTIONS.assessments)).findOne({ class_id: ids.class10B, subject_id: ids.math });
    await expect(
      addGrade(teacher, { classId: ids.class9A, subjectId: ids.math, studentId: ids.maria, score: 7, weight: 1, kind: "test", assessmentId: String(other!._id), gradedOn: today(), comment: null }),
    ).rejects.toMatchObject({ name: "UserFacingError" });
  });

  it("denies the gradebook to non-teachers", async () => {
    const student = await actorFor(DEMO.maria);
    await expect(getGradebook(student, ids.class9A, ids.math)).rejects.toMatchObject({ name: "AuthorizationError" });
    const counselor = await actorFor(DEMO.counselor);
    await expect(getTeacherDashboard(counselor)).rejects.toMatchObject({ name: "AuthorizationError" });
  });
});

describe("tenant isolation for teachers", () => {
  it("does not let a teacher from another school read or write Aurora data, whatever ids are passed", async () => {
    const other = await actorFor(DEMO.otherTeacher);
    expect(other.schoolId).toBe(ids.birch);

    // Reads through the tenant API see nothing of Aurora...
    const t = tenant(other);
    expect(await t.grades.find({ class_id: ids.class9A })).toHaveLength(0);
    expect(await t.classes.findOne({ _id: ids.class9A })).toBeNull();
    expect(await t.profiles.findOne({ _id: ids.maria })).toBeNull();
    // ...while seeing their own school's grades.
    expect((await t.grades.find({ class_id: ids.classBirch })).length).toBeGreaterThan(0);

    // Service entry points refuse or return nothing.
    await expect(getGradebook(other, ids.class9A, ids.math)).rejects.toMatchObject({ name: "AuthorizationError" });
    await expect(getAttendanceSheet(other, ids.class9A, ids.math, today())).rejects.toMatchObject({ name: "AuthorizationError" });
    expect(await getClassRoster(other, ids.class9A)).toBeNull();
    await expect(
      getTeacherAnalytics(other, { classId: ids.class9A, subjectId: null, from: addDays(today(), -90), to: today() }),
    ).rejects.toMatchObject({ name: "AuthorizationError" });

    // Writes with Aurora ids are refused and leave no trace.
    const before = await (await grades()).countDocuments({ student_id: ids.maria });
    await expect(
      addGrade(other, { classId: ids.class9A, subjectId: ids.math, studentId: ids.maria, score: 1, weight: 1, kind: "test", assessmentId: null, gradedOn: today(), comment: null }),
    ).rejects.toMatchObject({ name: "AuthorizationError" });
    // Own class + subject, but an Aurora student: not enrolled in this tenant.
    await expect(
      addGrade(other, { classId: ids.classBirch, subjectId: ids.birchMath, studentId: ids.maria, score: 1, weight: 1, kind: "test", assessmentId: null, gradedOn: today(), comment: null }),
    ).rejects.toMatchObject({ name: "UserFacingError" });
    await expect(
      saveAttendance(other, { classId: ids.classBirch, subjectId: ids.birchMath, date: today(), entries: [{ studentId: ids.maria, status: "absent", note: null }] }),
    ).rejects.toMatchObject({ name: "UserFacingError" });
    expect(await (await grades()).countDocuments({ student_id: ids.maria })).toBe(before);

    // Editing or deleting an Aurora grade by id: invisible, so "no longer exists".
    const auroraGrade = await (await grades()).findOne({ school_id: ids.aurora });
    await expect(
      updateGrade(other, { gradeId: String(auroraGrade!._id), score: 1, weight: 1, kind: "test", assessmentId: null, gradedOn: today(), comment: null }),
    ).rejects.toMatchObject({ name: "UserFacingError" });
    await expect(deleteGrade(other, String(auroraGrade!._id))).rejects.toMatchObject({ name: "UserFacingError" });
    expect(await (await grades()).findOne({ _id: auroraGrade!._id })).toMatchObject({ score: auroraGrade!.score });

    // The tenant layer itself refuses to stamp another school's id.
    await expect(t.grades.insertOne({ school_id: ids.aurora, student_id: ids.maria, class_id: ids.class9A, subject_id: ids.math, score: 1 })).rejects.toMatchObject({ name: "AuthorizationError" });
    await expect(t.grades.updateMany({}, { $set: { school_id: ids.aurora } })).rejects.toMatchObject({ name: "AuthorizationError" });

    // The dashboard and assessment list only contain the teacher's own school.
    const dash = await getTeacherDashboard(other);
    expect(dash.classes.map((c) => c.id)).toEqual([ids.classBirch]);
    const list = await listTeacherAssessments(other);
    expect([...list.upcoming, ...list.recent].every((a) => a.class_id === ids.classBirch)).toBe(true);
  });
});

describe("teacher attendance & assessments", () => {
  it("upserts attendance on the unique key", async () => {
    const teacher = await actorFor(DEMO.mathTeacher);
    const date = addDays(today(), -1);
    await saveAttendance(teacher, { classId: ids.class9A, subjectId: ids.math, date, entries: [{ studentId: ids.maria, status: "late", note: null }] });
    await saveAttendance(teacher, { classId: ids.class9A, subjectId: ids.math, date, entries: [{ studentId: ids.maria, status: "excused", note: "Doctor" }] });
    const rows = await (await col(COLLECTIONS.attendance))
      .find({ student_id: ids.maria, class_id: ids.class9A, subject_id: ids.math, date }, { projection: { _id: 0, status: 1, note: 1, school_id: 1 } })
      .toArray();
    expect(rows).toEqual([{ status: "excused", note: "Doctor", school_id: ids.aurora }]);

    const sheet = await getAttendanceSheet(teacher, ids.class9A, ids.math, date);
    expect(sheet.students.find((s) => s.id === ids.maria)?.status).toBe("excused");

    await expect(
      saveAttendance(teacher, { classId: ids.class9A, subjectId: ids.romanian, date, entries: [{ studentId: ids.maria, status: "absent", note: null }] }),
    ).rejects.toMatchObject({ name: "AuthorizationError" });
  });

  it("creates an assessment, notifies enrolled students, and deletes it", async () => {
    const teacher = await actorFor(DEMO.mathTeacher);
    const id = await createAssessment(teacher, { classId: ids.class9A, subjectId: ids.math, title: "Fractions quiz", kind: "quiz", dueDate: addDays(today(), 5), description: null });
    expect(id).toBeTruthy();
    const n = await (await notifications()).countDocuments({ user_id: ids.maria, type: "academic_event", body: { $regex: "^Fractions quiz" } });
    expect(n).toBe(1);
    const list = await listTeacherAssessments(teacher);
    expect(list.upcoming.find((a) => a.id === id)).toMatchObject({ class_name: "9A", subject_name: "Mathematics", graded_count: 0 });

    await expect(
      createAssessment(teacher, { classId: ids.class9A, subjectId: ids.romanian, title: "Essay", kind: "project", dueDate: addDays(today(), 5), description: null }),
    ).rejects.toMatchObject({ name: "AuthorizationError" });

    const ro = await actorFor(DEMO.roTeacher);
    await expect(deleteAssessment(ro, id)).rejects.toMatchObject({ name: "AuthorizationError" });
    await deleteAssessment(teacher, id);
    expect(await (await col(COLLECTIONS.assessments)).findOne({ _id: id })).toBeNull();
  });

  it("builds a dashboard, roster and analytics limited to the teacher's assignments", async () => {
    const teacher = await actorFor(DEMO.mathTeacher);
    const dash = await getTeacherDashboard(teacher);
    expect(dash.classes.map((c) => c.name).sort()).toEqual(["10B", "11C", "9A"]);
    expect(dash.classes.find((c) => c.name === "9A")?.is_homeroom).toBe(true);
    expect(dash.stats.studentsTaught).toBeGreaterThan(10);
    expect(dash.stats.gradeCount).toBeGreaterThan(0);
    expect(dash.assignments.every((a) => ["Mathematics", "Physics"].includes(a.subject_name))).toBe(true);

    const roster = await getClassRoster(teacher, ids.class9A);
    expect(roster?.subjects.map((s) => s.name).sort()).toEqual(["Mathematics", "Physics"]);
    expect(roster?.students.some((s) => s.id === ids.maria)).toBe(true);
    expect(roster?.homeroom_teacher).toBe(teacher.displayName);

    const analytics = await getTeacherAnalytics(teacher, { classId: null, subjectId: null, from: addDays(today(), -90), to: today() });
    expect(analytics.subjectAverages.map((s) => s.label).sort()).toEqual(["Mathematics", "Physics"]);
    expect(analytics.gradeCount).toBeGreaterThan(0);
    await expect(
      getTeacherAnalytics(teacher, { classId: null, subjectId: ids.romanian, from: addDays(today(), -90), to: today() }),
    ).rejects.toMatchObject({ name: "AuthorizationError" });
  });
});

describe("teacher wellbeing access", () => {
  it("returns a k-anonymous summary for a taught class and suppresses small groups", async () => {
    const teacher = await actorFor(DEMO.mathTeacher);
    const from = addDays(today(), -29);
    const summary = await getClassWellbeingSummary(teacher, ids.class9A, from, today());
    expect(summary.suppressed).toBe(false);
    expect(summary.students_reporting).toBeGreaterThanOrEqual(5);
    expect(JSON.stringify(summary)).not.toContain(ids.maria); // no individual identifiers

    const other = await actorFor(DEMO.otherTeacher);
    const small = await getClassWellbeingSummary(other, ids.classBirch, from, today());
    expect(small.suppressed).toBe(true);
    expect(small.average).toBeUndefined();

    const page = await getTeacherWellbeing(teacher, 14);
    expect(page.classes).toHaveLength(3);
  });

  it("refuses class summaries for a class the teacher doesn't teach (including other schools)", async () => {
    const other = await actorFor(DEMO.otherTeacher);
    await expect(getClassWellbeingSummary(other, ids.class9A, addDays(today(), -13), today())).rejects.toMatchObject({ name: "AuthorizationError" });
  });

  it("never exposes individual check-ins or notes to teachers", async () => {
    const teacher = await actorFor(DEMO.mathTeacher);
    const page = await getTeacherWellbeing(teacher, 30);
    const json = JSON.stringify(page);
    const studentIds = (await (await col(COLLECTIONS.enrollments)).find({ school_id: ids.aurora }).toArray()).map((e) => String(e.student_id));
    for (const id of studentIds) expect(json).not.toContain(id);
    expect(json).not.toMatch(/note|mood|student_id/i);
    // The teacher service never reads the check-ins collection directly.
    const source = readFileSync(path.resolve(import.meta.dirname, "../src/lib/services/teacher.ts"), "utf8");
    expect(source).not.toMatch(/\.checkins\b|COLLECTIONS\.checkins|wb_checkins/);
  });
});
