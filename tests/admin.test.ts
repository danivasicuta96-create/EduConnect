import { afterAll, describe, expect, it } from "vitest";
import { closeMongo, col, COLLECTIONS as C } from "@/lib/db/mongo";
import { addDays, todayIn } from "@/lib/dates";
import { registerAccount } from "@/lib/services/auth";
import { AuthorizationError } from "@/lib/services/errors";
import {
  createInvitation, listUsers, recordConsent, recordConsentSchema, setStaffPermission, changeUserRole, setAccountSuspended, listStudentConsent,
  saveClass, classSchema, createSubject, listSubjects, addTeachingAssignment, enrollStudent, addTimetableEntry, timetableSchema, getClassDetail,
  deleteClass, removeTimetableEntry, removeTeachingAssignment, unenrollStudent, deleteSubject, listClasses, getSubscription, changeSubscription,
  regenerateJoinCode, getSchoolSettings, updateRetention, listAlertRules, updateAlertRule, alertRuleSchema, runRetentionCleanup, listAudit,
  auditFilterSchema, exportAuditCsv, safeMetadata, getDashboard, listInvitations,
} from "@/lib/services/admin";
import { getChildren, setGuardianConsent, guardianConsentSchema } from "@/lib/services/parent";
import { loadStudentAcademics } from "@/lib/services/academics";
import { getHistory } from "@/lib/services/wellbeing";
import { classSummary, schoolSummary } from "@/lib/services/wellbeing-aggregates";
import { actorFor, DEMO } from "./helpers";

afterAll(async () => {
  await closeMongo();
});

/** Serialised service output must never carry wellbeing content. */
function expectNoWellbeing(value: unknown) {
  const json = JSON.stringify(value);
  for (const key of ["mood", "note_enc", "experience", "factors", "resolution_enc", "message_enc"]) expect(json).not.toContain(`"${key}"`);
}

describe("administrator portal", () => {
  it("lists only users of the admin's own school", async () => {
    const admin = await actorFor(DEMO.admin);
    const users = await listUsers(admin, { role: "all", q: "" });
    expect(users.length).toBeGreaterThan(10);
    expect(users.some((u) => u.email === DEMO.maria)).toBe(true);
    expect(users.every((u) => !u.email?.endsWith("@birchwood.demo"))).toBe(true);
    // Search works by name and by email, within the school.
    expect((await listUsers(admin, { role: "all", q: "maria" })).map((u) => u.email)).toContain(DEMO.maria);
    expect((await listUsers(admin, { role: "student", q: "georgescu@aurora" })).map((u) => u.email)).toEqual([DEMO.maria]);

    const other = await actorFor(DEMO.otherAdmin);
    const theirs = await listUsers(other, { role: "all", q: "" });
    expect(theirs.length).toBeGreaterThan(0);
    expect(theirs.some((u) => u.email?.endsWith("@aurora.demo"))).toBe(false);
    // Searching for an Aurora email from Birchwood finds nothing.
    expect(await listUsers(other, { role: "all", q: "maria" })).toHaveLength(0);
    expect(await listUsers(other, { role: "all", q: "aurora.demo" })).toHaveLength(0);
  });

  it("does not let an admin read wellbeing check-ins or alerts", async () => {
    const admin = await actorFor(DEMO.admin);
    expect(admin.permissions).toEqual([]);
    const today = todayIn(admin.timezone);
    const cls = (await listClasses(admin))[0];
    await expect(getHistory(admin)).rejects.toBeInstanceOf(AuthorizationError);
    await expect(schoolSummary(admin, addDays(today, -30), today)).rejects.toBeInstanceOf(AuthorizationError);
    await expect(classSummary(admin, cls.id, addDays(today, -30), today)).rejects.toBeInstanceOf(AuthorizationError);
    // Admin service output carries no wellbeing content.
    expectNoWellbeing(await getDashboard(admin));
    expectNoWellbeing(await listUsers(admin));
    expectNoWellbeing(await listStudentConsent(admin));
    expectNoWellbeing(await getClassDetail(admin, cls.id));
    expectNoWellbeing(await listAudit(admin, auditFilterSchema.parse({})));
    // Sanity check: the data exists.
    expect(await (await col(C.checkins)).countDocuments({ school_id: admin.schoolId })).toBeGreaterThan(0);
    expect(await (await col(C.alerts)).countDocuments({ school_id: admin.schoolId })).toBeGreaterThan(0);
  });

  it("creates an invitation that can be used to register", async () => {
    const admin = await actorFor(DEMO.admin);
    const { code } = await createInvitation(admin, { email: "new.teacher@aurora.demo", role: "teacher", classId: null, studentId: null });
    expect(code).toMatch(/^[A-Z2-9]{10}$/);
    const stored = await (await col(C.invitations)).findOne({ email: "new.teacher@aurora.demo" });
    expect(stored!.school_id).toBe(admin.schoolId);
    expect(stored!.token_hash).not.toContain(code);
    expect((await listInvitations(admin)).find((i) => i.email === "new.teacher@aurora.demo")?.status).toBe("pending");
    // Another school's admin can't reference Aurora's classes or students in an invitation.
    const other = await actorFor(DEMO.otherAdmin);
    const maria = await actorFor(DEMO.maria);
    await expect(createInvitation(other, { email: "x.parent@birchwood.demo", role: "parent", classId: null, studentId: maria.id })).rejects.toThrow(/school/i);

    const result = await registerAccount({
      displayName: "New Teacher", email: "new.teacher@aurora.demo", password: "Correct-Horse-Battery-9", code: code.toLowerCase(), acceptTerms: "on",
    });
    expect(result.role).toBe("teacher");
    const profile = await (await col(C.profiles)).findOne({ _id: result.userId });
    expect({ school_id: profile!.school_id, role: profile!.role }).toEqual({ school_id: admin.schoolId, role: "teacher" });
    // The code can't be reused.
    await expect(
      registerAccount({ displayName: "Again", email: "new.teacher@aurora.demo", password: "Correct-Horse-Battery-9", code, acceptTerms: "on" }),
    ).rejects.toThrow();
  });

  it("lets an admin grant permissions, but not a teacher", async () => {
    const admin = await actorFor(DEMO.admin);
    const teacher = await actorFor(DEMO.mathTeacher);
    const perms = async () => (await (await col(C.staffPermissions)).find({ user_id: teacher.id }).toArray()).map((p) => p.permission);
    await setStaffPermission(admin, teacher.id, "safeguarding.reports", true);
    expect(await perms()).toContain("safeguarding.reports");

    await expect(setStaffPermission(teacher, teacher.id, "wellbeing.alerts", true)).rejects.toBeInstanceOf(AuthorizationError);
    await expect(changeUserRole(teacher, teacher.id, "admin")).rejects.toBeInstanceOf(AuthorizationError);
    // An admin of another school can't grant permissions to Aurora staff.
    const other = await actorFor(DEMO.otherAdmin);
    await expect(setStaffPermission(other, teacher.id, "wellbeing.alerts", true)).rejects.toThrow(/school/i);
    // A forged admin actor (role claimed, not held in the database) is rejected.
    await expect(setStaffPermission({ ...teacher, role: "admin" }, teacher.id, "wellbeing.alerts", true)).rejects.toBeInstanceOf(AuthorizationError);
    expect(await perms()).not.toContain("wellbeing.alerts");

    await setStaffPermission(admin, teacher.id, "safeguarding.reports", false);
    expect(await perms()).not.toContain("safeguarding.reports");
    const log = await (await col(C.auditLogs)).countDocuments({ action: { $regex: "^permission\\." }, resource_id: teacher.id });
    expect(log).toBe(2);
  });

  it("restricts role changes and suspension to staff of the same school", async () => {
    const admin = await actorFor(DEMO.admin);
    const other = await actorFor(DEMO.otherAdmin);
    const maria = await actorFor(DEMO.maria);
    const teacher = await actorFor(DEMO.roTeacher);
    await expect(changeUserRole(admin, maria.id, "teacher")).rejects.toThrow(/staff/i);
    await expect(changeUserRole(other, teacher.id, "counselor")).rejects.toThrow(/school/i);
    await expect(setAccountSuspended(other, teacher.id, true)).rejects.toThrow(/school/i);

    const state = async () => {
      const p = await (await col(C.profiles)).findOne({ _id: teacher.id });
      const u = await (await col(C.users)).findOne({ _id: teacher.id });
      return { account_state: p!.account_state, status: u!.status };
    };
    const sessions = await col(C.sessions);
    await sessions.insertOne({ _id: "test-session-ro", user_id: teacher.id, expires_at: new Date(Date.now() + 3600_000), created_at: new Date() });
    await setAccountSuspended(admin, teacher.id, true);
    expect(await state()).toEqual({ account_state: "suspended", status: "disabled" });
    expect(await sessions.countDocuments({ user_id: teacher.id })).toBe(0);
    await setAccountSuspended(admin, teacher.id, false);
    expect(await state()).toEqual({ account_state: "active", status: "active" });
  });

  it("activates Sara once platform consent is recorded from a paper form", async () => {
    const admin = await actorFor(DEMO.admin);
    const sara = await actorFor(DEMO.sara);
    expect(sara.accountState).toBe("pending_guardian_consent");
    const before = (await listStudentConsent(admin)).find((s) => s.user_id === sara.id)!;
    expect(before.account_state).toBe("pending_guardian_consent");

    // Another school's admin can't record consent for her.
    const other = await actorFor(DEMO.otherAdmin);
    const input = recordConsentSchema.parse({
      studentId: sara.id, method: "paper_form", confirm: "on",
      platform: "grant", wellbeing_checkins: "grant", matchmaking: "withhold", ai_features: "grant", guardian_access: "",
    });
    await expect(recordConsent(other, input)).rejects.toThrow(/school/i);

    const result = await recordConsent(admin, input);
    expect(result).toEqual({ recorded: 4, accountChange: "activated" });
    const after = (await listStudentConsent(admin)).find((s) => s.user_id === sara.id)!;
    expect(after.account_state).toBe("active");
    expect(after.consents.wellbeing_checkins.granted).toBe(true);
    expect(after.consents.matchmaking.granted).toBe(false);
    expect(after.consents.platform.method).toBe("paper_form");
  });
});

describe("administrator school management", () => {
  it("manages classes, subjects, assignments, enrolments and the timetable", async () => {
    const admin = await actorFor(DEMO.admin);
    const teacher = await actorFor(DEMO.mathTeacher);
    const alex = await actorFor(DEMO.alex);
    const classId = await saveClass(admin, classSchema.parse({ name: "12Z", gradeLevel: "12", academicYear: "2026-2027", homeroomTeacherId: teacher.id }));
    await expect(saveClass(admin, classSchema.parse({ name: "12Z", gradeLevel: "12", academicYear: "2026-2027" }))).rejects.toThrow(/already exists/);
    await createSubject(admin, { name: "Astronomy", color: "violet" });
    const subject = (await listSubjects(admin)).find((s) => s.name === "Astronomy")!;
    await addTeachingAssignment(admin, { classId, subjectId: subject.id, teacherId: teacher.id });
    await expect(addTeachingAssignment(admin, { classId, subjectId: subject.id, teacherId: teacher.id })).rejects.toThrow(/already/);
    await enrollStudent(admin, classId, alex.id);
    await addTimetableEntry(admin, timetableSchema.parse({ classId, subjectId: subject.id, teacherId: teacher.id, weekday: "2", startTime: "09:00", endTime: "09:50", room: "Lab" }));
    await expect(
      addTimetableEntry(admin, timetableSchema.parse({ classId, subjectId: subject.id, weekday: "2", startTime: "09:30", endTime: "10:20" })),
    ).rejects.toThrow(/overlaps/);

    // Ids from another school are refused before anything is linked.
    const other = await actorFor(DEMO.otherAdmin);
    const otherTeacher = await actorFor(DEMO.otherTeacher);
    const otherStudent = await actorFor(DEMO.otherStudent);
    await expect(enrollStudent(admin, classId, otherStudent.id)).rejects.toThrow(/school/i);
    await expect(addTeachingAssignment(admin, { classId, subjectId: subject.id, teacherId: otherTeacher.id })).rejects.toThrow(/school/i);
    await expect(saveClass(admin, classSchema.parse({ name: "12Y", gradeLevel: "12", homeroomTeacherId: otherTeacher.id }))).rejects.toThrow(/school/i);
    const otherClass = (await listClasses(other))[0];
    await expect(enrollStudent(other, otherClass.id, alex.id)).rejects.toThrow(/school/i);
    await expect(addTeachingAssignment(other, { classId: otherClass.id, subjectId: subject.id, teacherId: otherTeacher.id })).rejects.toThrow(/school/i);

    const detail = (await getClassDetail(admin, classId))!;
    expect(detail.cls.homeroom_name).toBe(teacher.displayName);
    expect(detail.students.map((s) => s.user_id)).toEqual([alex.id]);
    expect(detail.assignments).toHaveLength(1);
    expect(detail.timetable).toHaveLength(1);

    // Another school's admin can't see or touch it.
    expect(await getClassDetail(other, classId)).toBeNull();
    expect((await listClasses(other)).some((c) => c.id === classId)).toBe(false);
    await expect(deleteClass(other, classId)).rejects.toThrow();
    await expect(removeTimetableEntry(other, detail.timetable[0].id)).rejects.toThrow();
    await expect(deleteSubject(other, subject.id)).rejects.toThrow();

    await removeTimetableEntry(admin, detail.timetable[0].id);
    await removeTeachingAssignment(admin, detail.assignments[0].id);
    await unenrollStudent(admin, classId, alex.id);
    await deleteClass(admin, classId);
    await deleteSubject(admin, subject.id);
    expect((await listClasses(admin)).some((c) => c.id === classId)).toBe(false);
  });

  it("changes the subscription with a draft billing record and never takes payment", async () => {
    const admin = await actorFor(DEMO.admin);
    const before = await getSubscription(admin);
    expect(before.current?.plan_id).toBe("school");
    await expect(changeSubscription(admin, { planId: "pilot", billingCycle: "annual", fundingSource: "grant", seats: 400 })).rejects.toThrow(/up to 150/);
    const { draftId } = await changeSubscription(admin, { planId: "school_plus", billingCycle: "monthly", fundingSource: "school_budget", seats: 400 });
    expect(draftId).toBeTruthy();
    const after = await getSubscription(admin);
    expect(after.current).toMatchObject({ plan_id: "school_plus", billing_cycle: "monthly", funding_source: "school_budget" });
    expect(after.billing.find((b) => b.id === draftId)?.status).toBe("draft");
    // Birchwood's subscription is untouched.
    const other = await getSubscription(await actorFor(DEMO.otherAdmin));
    expect(other.current?.plan_id).toBe("pilot");
    expect(other.billing.some((b) => b.id === draftId)).toBe(false);
  });

  it("updates settings, alert rules, retention and exports the audit log", async () => {
    const admin = await actorFor(DEMO.admin);
    const code = await regenerateJoinCode(admin);
    expect((await getSchoolSettings(admin))!.join_code).toBe(code);
    await updateRetention(admin, { wellbeingRetentionDays: 30, auditRetentionDays: 365 });
    const settings = (await getSchoolSettings(admin))!.settings;
    expect(settings.wellbeing_retention_days).toBe(30);
    expect(settings.checkin_reminder_time).toBe("15:00"); // other settings are kept

    const rule = (await listAlertRules(admin))[0];
    await updateAlertRule(admin, alertRuleSchema.parse({ id: rule.id, threshold: "4.5", windowDays: "10", minCheckins: "3", consecutiveCount: "3", severity: "attention" }));
    expect((await listAlertRules(admin)).find((r) => r.id === rule.id)).toMatchObject({ threshold: 4.5, window_days: 10, enabled: false });
    // Another school's admin can't edit Aurora's rules.
    const other = await actorFor(DEMO.otherAdmin);
    await expect(updateAlertRule(other, alertRuleSchema.parse({ id: rule.id, threshold: "2", windowDays: "10", minCheckins: "3", severity: "info" }))).rejects.toThrow(/wasn't found/);

    const checkins = await col(C.checkins);
    const cutoff = addDays(todayIn("Europe/Bucharest"), -30);
    const old = await checkins.countDocuments({ school_id: admin.schoolId, date: { $lt: cutoff } });
    const otherSchoolBefore = await checkins.countDocuments({ school_id: other.schoolId });
    const result = await runRetentionCleanup(admin);
    expect(result.checkins).toBe(old);
    expect(await checkins.countDocuments({ school_id: admin.schoolId, date: { $lt: cutoff } })).toBe(0);
    expect(await checkins.countDocuments({ school_id: admin.schoolId })).toBeGreaterThan(0);
    expect(await checkins.countDocuments({ school_id: other.schoolId })).toBe(otherSchoolBefore);

    const rows = await listAudit(admin, auditFilterSchema.parse({ action: "retention" }));
    expect(rows[0].action).toBe("retention.cleanup");
    const csv = await exportAuditCsv(admin, auditFilterSchema.parse({ action: "" }));
    expect(csv.split("\r\n")[0]).toBe("id,created_at,action,actor_id,actor_name,resource_type,resource_id,metadata");
    expect(csv).toContain("retention.cleanup");
    expect(await listAudit(other, auditFilterSchema.parse({ action: "retention" }))).toHaveLength(0);
    expect(safeMetadata({ count: 3, note: "free text with spaces", id: "abc-123" })).toEqual([["count", "3"], ["note", "[redacted]"], ["id", "abc-123"]]);

    const teacher = await actorFor(DEMO.mathTeacher);
    await expect(exportAuditCsv(teacher, { action: "" })).rejects.toBeInstanceOf(AuthorizationError);
    await expect(runRetentionCleanup(teacher)).rejects.toBeInstanceOf(AuthorizationError);
  });
});

describe("parent portal", () => {
  it("shows the linked child's grades but nothing else", async () => {
    const parent = await actorFor(DEMO.parent);
    const maria = await actorFor(DEMO.maria);
    const alex = await actorFor(DEMO.alex);

    const children = await getChildren(parent);
    expect(children.map((c) => c.id)).toEqual([maria.id]);
    expect(children[0].academics).not.toBeNull();
    expect(children[0].academics!.grades.length).toBeGreaterThan(0);
    expectNoWellbeing(children);

    await expect(loadStudentAcademics(parent, alex.id, "2026-01-01")).rejects.toBeInstanceOf(AuthorizationError);
    const otherStudent = await actorFor(DEMO.otherStudent);
    await expect(loadStudentAcademics(parent, otherStudent.id, "2026-01-01")).rejects.toBeInstanceOf(AuthorizationError);

    // No path to wellbeing data.
    const today = todayIn(parent.timezone);
    await expect(getHistory(parent)).rejects.toBeInstanceOf(AuthorizationError);
    await expect(schoolSummary(parent, addDays(today, -30), today)).rejects.toBeInstanceOf(AuthorizationError);
    await expect(classSummary(parent, children[0].academics!.classIds[0], addDays(today, -30), today)).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("can record in-app guardian consent only for a linked child", async () => {
    const parent = await actorFor(DEMO.parent);
    const maria = await actorFor(DEMO.maria);
    const alex = await actorFor(DEMO.alex);
    const res = await setGuardianConsent(parent, guardianConsentSchema.parse({ studentId: maria.id, ai_features: "no" }));
    expect(res.recorded).toBe(1);
    const latest = await (await col(C.consents)).findOne({ subject_id: maria.id, consent_type: "ai_features" }, { sort: { recorded_at: -1 } });
    expect({ granted: latest!.granted, given_by_role: latest!.given_by_role, method: latest!.method }).toEqual({ granted: false, given_by_role: "guardian", method: "in_app" });
    // Unchanged choices aren't recorded again.
    expect((await setGuardianConsent(parent, guardianConsentSchema.parse({ studentId: maria.id, ai_features: "no" }))).recorded).toBe(0);
    await expect(setGuardianConsent(parent, guardianConsentSchema.parse({ studentId: alex.id, platform: "yes" }))).rejects.toThrow(/linked/);
    // Only parents may use this.
    const admin = await actorFor(DEMO.admin);
    await expect(setGuardianConsent(admin, guardianConsentSchema.parse({ studentId: maria.id, platform: "yes" }))).rejects.toBeInstanceOf(AuthorizationError);
  });
});
