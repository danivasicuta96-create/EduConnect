// Relationship-based authorization rules. These mirror the policies the
// platform enforces for every sensitive resource; services must call them
// before reading or writing on behalf of a user. School isolation itself is
// guaranteed separately by `tenant()` (every query is scoped to one school).
//
// Each helper answers a yes/no question about the *current actor*.

import type { Tenant } from "@/lib/db/tenant";
import type { Actor } from "@/lib/services/actor";
import { AuthorizationError } from "@/lib/services/errors";

export type ConsentType = "platform" | "wellbeing_checkins" | "matchmaking" | "ai_features" | "guardian_access";

export const isStaff = (a: Actor) => a.role === "teacher" || a.role === "counselor" || a.role === "admin";
export const hasPerm = (a: Actor, p: string) => a.permissions.includes(p);

/** Profile exists in the actor's school (tenant-scoped lookup). */
export async function inMySchool(t: Tenant, userId: string): Promise<boolean> {
  return (await t.profiles.count({ _id: userId })) > 0;
}

export async function classInMySchool(t: Tenant, classId: string): Promise<boolean> {
  return (await t.classes.count({ _id: classId })) > 0;
}

export async function isHomeroom(t: Tenant, a: Actor, classId: string): Promise<boolean> {
  return (await t.classes.count({ _id: classId, homeroom_teacher_id: a.id })) > 0;
}

export async function teachesClass(t: Tenant, a: Actor, classId: string): Promise<boolean> {
  if (a.role !== "teacher") return false;
  return (await t.teachingAssignments.count({ class_id: classId, teacher_id: a.id })) > 0 || (await isHomeroom(t, a, classId));
}

export async function canTeach(t: Tenant, a: Actor, classId: string, subjectId: string): Promise<boolean> {
  if (a.role !== "teacher") return false;
  return (await t.teachingAssignments.count({ class_id: classId, subject_id: subjectId, teacher_id: a.id })) > 0;
}

export async function isEnrolled(t: Tenant, studentId: string, classId: string): Promise<boolean> {
  return (await t.enrollments.count({ student_id: studentId, class_id: classId })) > 0;
}

/** Latest consent record wins. */
export async function hasConsent(t: Tenant, studentId: string, type: ConsentType): Promise<boolean> {
  const latest = await t.consents.findOne({ subject_id: studentId, consent_type: type }, { sort: { recorded_at: -1 } });
  return Boolean(latest?.granted);
}

export async function isLinkedGuardian(t: Tenant, a: Actor, studentId: string): Promise<boolean> {
  if (a.role !== "parent") return false;
  return (await t.guardianLinks.count({ guardian_id: a.id, student_id: studentId, status: "active" })) > 0;
}

/** Guardians see academic data only with an active link AND recorded consent. */
export async function isGuardianOf(t: Tenant, a: Actor, studentId: string): Promise<boolean> {
  return (await isLinkedGuardian(t, a, studentId)) && (await hasConsent(t, studentId, "guardian_access"));
}

export async function isConnected(t: Tenant, a: string, b: string): Promise<boolean> {
  return (await t.connections.count({ pair: pairKey(a, b), status: "accepted" })) > 0;
}

export async function isBlockedBetween(t: Tenant, a: string, b: string): Promise<boolean> {
  return (await t.blocks.count({ $or: [{ blocker_id: a, blocked_id: b }, { blocker_id: b, blocked_id: a }] })) > 0;
}

/** Students may only contact other active students in their school, never adults, never across a block. */
export async function canContact(t: Tenant, a: Actor, otherId: string): Promise<boolean> {
  if (a.role !== "student" || otherId === a.id) return false;
  const other = await t.profiles.findOne({ _id: otherId, role: "student", account_state: "active" });
  if (!other) return false;
  return !(await isBlockedBetween(t, a.id, otherId));
}

export function pairKey(a: string, b: string): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

/**
 * Staff with `wellbeing.alerts` may see a student's individual check-in scores
 * only while an alert (rule-generated or self-referral) exists for that
 * student — open, or resolved within the last 90 days.
 */
export async function hasAlertFor(t: Tenant, studentId: string): Promise<boolean> {
  const since = new Date(Date.now() - 90 * 86400_000);
  return (await t.alerts.count({ student_id: studentId, $or: [{ status: { $ne: "resolved" } }, { resolved_at: { $gt: since } }] })) > 0;
}

/** May the actor read this student's grades / attendance (optionally for one class+subject)? */
export async function canReadAcademics(t: Tenant, a: Actor, studentId: string, scope?: { classId: string; subjectId: string }): Promise<boolean> {
  if (a.role === "student") return a.id === studentId;
  if (a.role === "admin") return inMySchool(t, studentId);
  if (a.role === "parent") return isGuardianOf(t, a, studentId);
  if (a.role === "teacher") {
    if (scope) return (await canTeach(t, a, scope.classId, scope.subjectId)) || (await isHomeroom(t, a, scope.classId));
    const classes = (await t.enrollments.find({ student_id: studentId })).map((e) => String(e.class_id));
    for (const c of classes) if (await teachesClass(t, a, c)) return true;
    return false;
  }
  return false;
}

export function ensure(condition: boolean, message?: string): asserts condition {
  if (!condition) throw new AuthorizationError(message);
}
