// School administration (MongoDB).
//
// Security model (no row-level security any more):
//   1. Every function asserts the admin role first.
//   2. School data is read and written only through `tenant(actor)`, so every
//      query is structurally limited to the admin's own school.
//   3. Every id an admin links to something (student, teacher, class, subject,
//      rule, invitation) is verified to exist in the admin's school first.
//   4. The privileged handle `col()` is used only for the credential store
//      (`auth_users`, `auth_sessions`) and global uniqueness checks — always
//      after `verifyAdmin()` re-reads the admin's profile from the database —
//      and every such write is audited.
//
// Administrators never see wellbeing content here: no check-ins, notes,
// scores or alerts are read by this module. Retention cleanup only counts and
// deletes check-ins by date. Alert *rule settings* are configuration, not
// wellbeing content, and are editable by admins.

import { z } from "zod";
import type { Document } from "mongodb";
import { col, COLLECTIONS as C, newId } from "@/lib/db/mongo";
import { tenant, type Tenant } from "@/lib/db/tenant";
import { humanCode, sha256 } from "@/lib/auth/crypto";
import { appUrl, sendEmail } from "@/lib/email";
import { addDays, todayIn } from "@/lib/dates";
import { PERMISSION_LABELS, ROLE_LABELS, type Role } from "@/lib/constants";
import { UserFacingError } from "@/lib/action-state";
import type { Actor } from "./actor";
import { assertRole } from "./actor";
import { audit } from "./audit";
import { grantCounselorDefaults } from "./auth";
import { consentMap, type ConsentType } from "./consent";
import { AuthorizationError } from "./errors";
import { notify } from "./notify";

export const STAFF_ROLES = ["teacher", "counselor", "admin"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];
export const INVITE_ROLES = ["student", "teacher", "counselor", "admin", "parent"] as const;
export const PERMISSIONS = Object.keys(PERMISSION_LABELS) as [string, ...string[]];
export const ALL_CONSENTS: ConsentType[] = ["platform", "wellbeing_checkins", "matchmaking", "ai_features", "guardian_access"];
export const FUNDING_SOURCES = ["school_budget", "grant", "public_partnership", "pilot"] as const;
export const FUNDING_LABELS: Record<(typeof FUNDING_SOURCES)[number], string> = {
  school_budget: "School budget",
  grant: "Grant funding",
  public_partnership: "Public partnership",
  pilot: "Pilot programme",
};
export const SUBJECT_COLORS = ["coral", "pink", "rose", "amber", "teal", "sky", "violet", "slate"] as const;
const INVITE_DAYS = 14;
const ROLE_ORDER: Role[] = ["admin", "counselor", "teacher", "student", "parent"];

const uuid = z.string().uuid("Invalid selection.");
const optionalUuid = z
  .string()
  .optional()
  .transform((v) => (v ? v : null))
  .pipe(z.string().uuid("Invalid selection.").nullable());

// ───────────────────────────── Helpers ─────────────────────────────

function assertAdmin(actor: Actor) {
  assertRole(actor, "admin");
}

/** ISO string for a stored Date (or pass-through for already-string values). */
function iso(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  return v instanceof Date ? v.toISOString() : String(v);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const isDuplicateKey = (err: unknown) => (err as { code?: number })?.code === 11000;

/**
 * Re-verify against the database that the actor really is an active admin of
 * their school. Required before any use of the privileged handle.
 */
async function verifyAdmin(actor: Actor): Promise<void> {
  assertAdmin(actor);
  const me = await (await col(C.profiles)).findOne({ _id: actor.id }, { projection: { role: 1, school_id: 1, account_state: 1 } });
  if (!me || me.role !== "admin" || String(me.school_id) !== actor.schoolId || me.account_state === "suspended") {
    throw new AuthorizationError();
  }
}

async function targetInSchool(t: Tenant, userId: string) {
  const p = await t.profiles.findOne({ _id: userId }, { projection: { role: 1, account_state: 1, display_name: 1 } });
  if (!p) throw new UserFacingError("That user isn't part of your school.");
  return { role: p.role as Role, account_state: String(p.account_state), display_name: String(p.display_name) };
}

/** Ids of every profile in the actor's school (for scoping credential-store queries). */
async function schoolUserIds(t: Tenant): Promise<string[]> {
  return (await t.profiles.find({}, { projection: { _id: 1 } })).map((p) => String(p._id));
}

async function nameMap(t: Tenant, ids: Array<unknown>): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter(Boolean).map(String))];
  if (unique.length === 0) return new Map();
  const rows = await t.profiles.find({ _id: { $in: unique } }, { projection: { display_name: 1 } });
  return new Map(rows.map((p) => [String(p._id), String(p.display_name)]));
}

async function assertStaffInSchool(t: Tenant, userId: string | null) {
  if (!userId) return;
  if (!(await t.profiles.count({ _id: userId, role: { $in: [...STAFF_ROLES] } }))) throw new UserFacingError("Choose a teacher from your school.");
}

async function assertClassInSchool(t: Tenant, classId: string) {
  if (!(await t.classes.count({ _id: classId }))) throw new UserFacingError("That class wasn't found.");
}

async function assertSubjectInSchool(t: Tenant, subjectId: string) {
  if (!(await t.subjects.count({ _id: subjectId }))) throw new UserFacingError("Choose a subject from your school.");
}

async function assertStudentInSchool(t: Tenant, studentId: string, message = "Choose a student from your school.") {
  if (!(await t.profiles.count({ _id: studentId, role: "student" }))) throw new UserFacingError(message);
}

// ───────────────────────────── Dashboard ─────────────────────────────

export interface AuditRow {
  id: string;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  actor_id: string | null;
  actor_name: string | null;
}

export async function getDashboard(actor: Actor) {
  assertAdmin(actor);
  const t = tenant(actor);
  const now = new Date();
  const [profiles, classes, pendingInvitations, sub, plans, recent] = await Promise.all([
    t.profiles.find({}, { projection: { role: 1, account_state: 1 } }),
    t.classes.count({}),
    t.invitations.count({ accepted_at: null, expires_at: { $gt: now } }),
    t.subscriptions.findOne({}),
    t.plans(),
    recentAudit(t, { limit: 8 }),
  ]);
  const counts = { students: 0, staff: 0, parents: 0, pending_consent: 0, suspended: 0 };
  for (const p of profiles) {
    if (p.role === "student") counts.students++;
    if ((STAFF_ROLES as readonly string[]).includes(p.role)) counts.staff++;
    if (p.role === "parent") counts.parents++;
    if (p.role === "student" && p.account_state === "pending_guardian_consent") counts.pending_consent++;
    if (p.account_state === "suspended") counts.suspended++;
  }
  const plan = sub ? plans.find((p) => String(p._id) === String(sub.plan_id)) : undefined;
  const subscription =
    sub && plan
      ? {
          plan_name: String(plan.name), status: String(sub.status), seats: Number(sub.seats), billing_cycle: String(sub.billing_cycle),
          funding_source: String(sub.funding_source), current_period_end: iso(sub.current_period_end) ?? "", max_students: (plan.max_students as number | null) ?? null,
        }
      : null;
  return { counts, classes, pendingInvitations, subscription, recent };
}

// ───────────────────────────── Users ─────────────────────────────

export interface UserRow {
  user_id: string;
  display_name: string;
  role: Role;
  account_state: "active" | "pending_guardian_consent" | "suspended";
  avatar_color: string;
  avatar_emoji: string | null;
  grade_level: number | null;
  created_at: string;
  class_names: string | null;
  permissions: string[];
  children: string | null;
  email: string | null;
  last_login_at: string | null;
}

export const userFilterSchema = z.object({
  role: z.enum(["all", ...INVITE_ROLES]).catch("all"),
  q: z.string().trim().max(80).catch(""),
});

export async function listUsers(actor: Actor, filter: z.infer<typeof userFilterSchema> = { role: "all", q: "" }): Promise<UserRow[]> {
  assertAdmin(actor);
  const t = tenant(actor);
  const q = filter.q.trim();
  const users = await col(C.users);

  const where: Document = filter.role === "all" ? {} : { role: filter.role };
  if (q) {
    // Email lives in the credential store. Resolve matches for *this school's users only*,
    // with the privileged handle, after the explicit admin check.
    await verifyAdmin(actor);
    const ids = await schoolUserIds(t);
    const emailMatches = (
      await users.find({ _id: { $in: ids }, email: { $regex: escapeRegex(q), $options: "i" } }, { projection: { _id: 1 }, limit: 200 }).toArray()
    ).map((u) => String(u._id));
    where.$or = [{ display_name: { $regex: escapeRegex(q), $options: "i" } }, { _id: { $in: emailMatches } }];
  }
  const profiles = (await t.profiles.find(where))
    .sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) || String(a.display_name).localeCompare(String(b.display_name)))
    .slice(0, 300);
  if (profiles.length === 0) return [];
  const ids = profiles.map((p) => String(p._id));

  const [enrollments, perms, links] = await Promise.all([
    t.enrollments.find({ student_id: { $in: ids } }, { projection: { student_id: 1, class_id: 1 } }),
    t.staffPermissions.find({ user_id: { $in: ids } }, { projection: { user_id: 1, permission: 1 } }),
    t.guardianLinks.find({ guardian_id: { $in: ids }, status: "active" }, { projection: { guardian_id: 1, student_id: 1 } }),
  ]);
  const classNames = new Map((await t.classes.find({ _id: { $in: [...new Set(enrollments.map((e) => String(e.class_id)))] } }, { projection: { name: 1 } })).map((c) => [String(c._id), String(c.name)]));
  const childNames = await nameMap(t, links.map((l) => l.student_id));
  const group = <T,>(rows: T[], key: (r: T) => string, val: (r: T) => string | undefined) => {
    const m = new Map<string, string[]>();
    for (const r of rows) {
      const v = val(r);
      if (v !== undefined) (m.get(key(r)) ?? m.set(key(r), []).get(key(r))!).push(v);
    }
    for (const list of m.values()) list.sort((a, b) => a.localeCompare(b));
    return m;
  };
  const classesBy = group(enrollments, (e) => String(e.student_id), (e) => classNames.get(String(e.class_id)));
  const permsBy = group(perms, (p) => String(p.user_id), (p) => String(p.permission));
  const childrenBy = group(links, (l) => String(l.guardian_id), (l) => childNames.get(String(l.student_id)));

  // Credentials (email, last sign-in) for exactly these users of this school.
  await verifyAdmin(actor);
  const creds = new Map(
    (await users.find({ _id: { $in: ids } }, { projection: { email: 1, last_login_at: 1 } }).toArray()).map((u) => [String(u._id), u]),
  );

  return profiles.map((p) => {
    const id = String(p._id);
    const cred = creds.get(id);
    return {
      user_id: id,
      display_name: String(p.display_name),
      role: p.role as Role,
      account_state: p.account_state,
      avatar_color: String(p.avatar_color),
      avatar_emoji: p.avatar_emoji ?? null,
      grade_level: p.grade_level ?? null,
      created_at: iso(p.created_at) ?? "",
      class_names: classesBy.get(id)?.join(", ") ?? null,
      permissions: permsBy.get(id) ?? [],
      children: childrenBy.get(id)?.join(", ") ?? null,
      email: cred ? String(cred.email) : null,
      last_login_at: cred ? iso(cred.last_login_at) : null,
    };
  });
}

/** Lightweight pickers for forms (teachers, students, classes, subjects). */
export async function getSchoolDirectory(actor: Actor) {
  assertAdmin(actor);
  const t = tenant(actor);
  const [people, classes, subjects] = await Promise.all([
    t.profiles.find({ role: { $in: ["student", ...STAFF_ROLES] } }, { projection: { display_name: 1, role: 1, grade_level: 1 }, sort: { display_name: 1 } }),
    t.classes.find({}, { projection: { name: 1, grade_level: 1 }, sort: { grade_level: 1, name: 1 } }),
    t.subjects.find({}, { projection: { name: 1, color: 1 }, sort: { name: 1 } }),
  ]);
  const ppl = people.map((p) => ({ user_id: String(p._id), display_name: String(p.display_name), role: p.role as Role, grade_level: (p.grade_level as number | null) ?? null }));
  return {
    students: ppl.filter((p) => p.role === "student"),
    teachers: ppl.filter((p) => p.role === "teacher" || p.role === "counselor" || p.role === "admin"),
    classes: classes.map((c) => ({ id: String(c._id), name: String(c.name), grade_level: Number(c.grade_level) })),
    subjects: subjects.map((s) => ({ id: String(s._id), name: String(s.name), color: String(s.color) })),
  };
}

// ───────────────────────────── Invitations ─────────────────────────────

export const inviteSchema = z
  .object({
    email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(200),
    role: z.enum(INVITE_ROLES, { message: "Choose a role." }),
    classId: optionalUuid,
    studentId: optionalUuid,
  })
  .transform((v) => ({
    ...v,
    classId: v.role === "student" ? v.classId : null,
    studentId: v.role === "parent" ? v.studentId : null,
  }));
export type InviteInput = z.infer<typeof inviteSchema>;

export interface InvitationRow {
  id: string;
  email: string;
  role: Role;
  class_name: string | null;
  student_name: string | null;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
  status: "pending" | "accepted" | "expired";
}

export async function listInvitations(actor: Actor, limit = 30): Promise<InvitationRow[]> {
  assertAdmin(actor);
  const t = tenant(actor);
  const now = new Date();
  const rows = await t.invitations.find({}, { projection: { token_hash: 0 }, sort: { created_at: -1 } });
  const status = (i: Document): InvitationRow["status"] => (i.accepted_at ? "accepted" : new Date(i.expires_at) <= now ? "expired" : "pending");
  const ordered = rows
    .map((i) => ({ i, s: status(i) }))
    .sort((a, b) => Number(b.s === "pending") - Number(a.s === "pending"))
    .slice(0, limit);
  const classNames = new Map(
    (await t.classes.find({ _id: { $in: ordered.map((o) => o.i.class_id).filter(Boolean) } }, { projection: { name: 1 } })).map((c) => [String(c._id), String(c.name)]),
  );
  const students = await nameMap(t, ordered.map((o) => o.i.student_id));
  return ordered.map(({ i, s }) => ({
    id: String(i._id),
    email: String(i.email),
    role: i.role as Role,
    class_name: i.class_id ? classNames.get(String(i.class_id)) ?? null : null,
    student_name: i.student_id ? students.get(String(i.student_id)) ?? null : null,
    created_at: iso(i.created_at) ?? "",
    expires_at: iso(i.expires_at) ?? "",
    accepted_at: iso(i.accepted_at),
    status: s,
  }));
}

/**
 * Create an invitation. The plain code is returned once (to show the admin) and
 * emailed; only its SHA-256 is stored.
 */
export async function createInvitation(actor: Actor, input: InviteInput): Promise<{ id: string; code: string; registerUrl: string }> {
  await verifyAdmin(actor);
  const t = tenant(actor);
  // Email uniqueness is global (credential store): existence check only.
  if (await (await col(C.users)).countDocuments({ email: input.email }, { limit: 1 })) {
    throw new UserFacingError("An account with this email already exists.");
  }
  if (input.classId) await assertClassInSchool(t, input.classId);
  if (input.studentId) await assertStudentInSchool(t, input.studentId, "That student wasn't found in your school.");
  if (await t.invitations.count({ email: input.email, accepted_at: null, expires_at: { $gt: new Date() } })) {
    throw new UserFacingError("There is already a pending invitation for this email. Revoke it first to issue a new code.");
  }

  const code = humanCode(10);
  const id = await t.invitations.insertOne({
    email: input.email, role: input.role, class_id: input.classId, student_id: input.studentId, token_hash: sha256(code.toUpperCase()),
    created_by: actor.id, expires_at: new Date(Date.now() + INVITE_DAYS * 86400_000), accepted_at: null,
  });
  await audit({
    schoolId: actor.schoolId, actorId: actor.id, action: "invitation.created", resourceType: "invitation", resourceId: id,
    metadata: { role: input.role, class_id: input.classId, student_id: input.studentId },
  });
  const schoolName = String((await t.schools.get())?.name ?? "your school");

  const registerUrl = appUrl(`/register?code=${code}`);
  await sendEmail({
    to: input.email,
    subject: `Your invitation to ${schoolName} on EduConnect AI`,
    text: [
      `Hello,`,
      ``,
      `${schoolName} has invited you to join EduConnect AI as: ${ROLE_LABELS[input.role]}.`,
      ``,
      `Create your account here: ${registerUrl}`,
      `Your invitation code: ${code}`,
      ``,
      `The invitation is valid for ${INVITE_DAYS} days and only for this email address.`,
      `If you weren't expecting this, you can ignore this email.`,
    ].join("\n"),
  });
  return { id, code, registerUrl };
}

export async function revokeInvitation(actor: Actor, invitationId: string): Promise<void> {
  assertAdmin(actor);
  const now = new Date();
  const r = await tenant(actor).invitations.updateOne({ _id: invitationId, accepted_at: null, expires_at: { $gt: now } }, { $set: { expires_at: now } });
  if (r.matched === 0) throw new UserFacingError("That invitation is no longer pending.");
  await audit({ schoolId: actor.schoolId, actorId: actor.id, action: "invitation.revoked", resourceType: "invitation", resourceId: invitationId });
}

// ───────────────────────────── Permissions, roles, suspension ─────────────────────────────

export const permissionSchema = z.object({
  userId: uuid,
  permission: z.enum(PERMISSIONS, { message: "Unknown permission." }),
  grant: z.enum(["true", "false"]).transform((v) => v === "true"),
});

/** Grant or revoke a fine-grained staff permission (admins of the same school only). */
export async function setStaffPermission(actor: Actor, userId: string, permission: string, grant: boolean): Promise<void> {
  await verifyAdmin(actor);
  if (!PERMISSIONS.includes(permission)) throw new UserFacingError("Unknown permission.");
  const t = tenant(actor);
  const target = await targetInSchool(t, userId);
  if (!(STAFF_ROLES as readonly string[]).includes(target.role)) {
    throw new UserFacingError("Permissions can only be granted to school staff.");
  }
  if (grant) {
    await t.staffPermissions.updateOne(
      { user_id: userId, permission },
      { $setOnInsert: { _id: newId(), granted_by: actor.id, granted_at: new Date(), created_at: new Date() } },
      { upsert: true },
    );
  } else {
    await t.staffPermissions.deleteOne({ user_id: userId, permission });
  }
  await audit({
    schoolId: actor.schoolId, actorId: actor.id, action: grant ? "permission.granted" : "permission.revoked",
    resourceType: "user", resourceId: userId, metadata: { permission },
  });
}

export const roleChangeSchema = z.object({ userId: uuid, role: z.enum(STAFF_ROLES, { message: "Choose a staff role." }) });

/**
 * Change a staff member's role (teacher ⇄ counselor ⇄ admin). Students and
 * parents can't be converted. Existing fine-grained permissions are reset;
 * counselors receive the counselor defaults.
 */
export async function changeUserRole(actor: Actor, userId: string, role: StaffRole): Promise<void> {
  assertAdmin(actor);
  if (!(STAFF_ROLES as readonly string[]).includes(role)) throw new UserFacingError("Only staff roles can be assigned here.");
  if (userId === actor.id) throw new UserFacingError("You can't change your own role. Ask another administrator.");
  await verifyAdmin(actor);
  const t = tenant(actor);
  const target = await targetInSchool(t, userId);
  if (!(STAFF_ROLES as readonly string[]).includes(target.role)) {
    throw new UserFacingError("Only staff accounts can change role. Student and parent accounts can't be converted.");
  }
  if (target.role === role) throw new UserFacingError("The user already has that role.");
  const removed = await t.staffPermissions.deleteMany({ user_id: userId });
  await t.profiles.updateOne({ _id: userId, role: target.role }, { $set: { role } });
  if (role === "counselor") await grantCounselorDefaults(actor.schoolId, userId);
  await audit({
    schoolId: actor.schoolId, actorId: actor.id, action: "user.role_changed", resourceType: "user", resourceId: userId,
    metadata: { from: target.role, to: role, permissions_reset: removed },
  });
  await notify(actor.schoolId, [userId], { type: "account", title: "Your role was updated", body: `Your school changed your role to ${ROLE_LABELS[role]}.` });
}

export const suspendSchema = z.object({ userId: uuid, suspend: z.enum(["true", "false"]).transform((v) => v === "true") });

/** Suspend (blocks sign-in, revokes all sessions) or reactivate an account. */
export async function setAccountSuspended(actor: Actor, userId: string, suspend: boolean): Promise<{ state: string }> {
  assertAdmin(actor);
  if (userId === actor.id) throw new UserFacingError("You can't suspend your own account.");
  await verifyAdmin(actor);
  const t = tenant(actor);
  // Same-school check before touching the credential store.
  const target = await targetInSchool(t, userId);
  const users = await col(C.users);
  let state: string;
  let sessions = 0;
  if (suspend) {
    if (target.account_state === "suspended") throw new UserFacingError("This account is already suspended.");
    state = "suspended";
    await t.profiles.updateOne({ _id: userId }, { $set: { account_state: "suspended" } });
    await users.updateOne({ _id: userId, status: "active" }, { $set: { status: "disabled" } });
    sessions = (await (await col(C.sessions)).deleteMany({ user_id: userId })).deletedCount;
  } else {
    if (target.account_state !== "suspended") throw new UserFacingError("This account isn't suspended.");
    state = "active";
    if (target.role === "student") {
      const consents = await consentMap(t, userId);
      if (!consents.platform.granted) state = "pending_guardian_consent";
    }
    await t.profiles.updateOne({ _id: userId }, { $set: { account_state: state } });
    await users.updateOne({ _id: userId, status: "disabled" }, { $set: { status: "active" } });
  }
  await audit({
    schoolId: actor.schoolId, actorId: actor.id, action: suspend ? "user.suspended" : "user.reactivated",
    resourceType: "user", resourceId: userId, metadata: { role: target.role, sessions_revoked: sessions },
  });
  return { state };
}

// ───────────────────────────── Classes & structure ─────────────────────────────

export interface ClassRow {
  id: string;
  name: string;
  grade_level: number;
  academic_year: string;
  homeroom_teacher_id: string | null;
  homeroom_name: string | null;
  students: number;
  assignments: number;
}

async function classRows(t: Tenant, filter: Document): Promise<ClassRow[]> {
  const classes = await t.classes.find(filter, { sort: { grade_level: 1, name: 1 } });
  if (classes.length === 0) return [];
  const ids = classes.map((c) => String(c._id));
  const [enrollments, assignments, homerooms] = await Promise.all([
    t.enrollments.find({ class_id: { $in: ids } }, { projection: { class_id: 1 } }),
    t.teachingAssignments.find({ class_id: { $in: ids } }, { projection: { class_id: 1 } }),
    nameMap(t, classes.map((c) => c.homeroom_teacher_id)),
  ]);
  const count = (rows: Document[], id: string) => rows.filter((r) => String(r.class_id) === id).length;
  return classes.map((c) => {
    const id = String(c._id);
    return {
      id, name: String(c.name), grade_level: Number(c.grade_level), academic_year: String(c.academic_year),
      homeroom_teacher_id: c.homeroom_teacher_id ?? null, homeroom_name: c.homeroom_teacher_id ? homerooms.get(String(c.homeroom_teacher_id)) ?? null : null,
      students: count(enrollments, id), assignments: count(assignments, id),
    };
  });
}

export async function listClasses(actor: Actor): Promise<ClassRow[]> {
  assertAdmin(actor);
  return classRows(tenant(actor), {});
}

export async function getClassDetail(actor: Actor, classId: string) {
  assertAdmin(actor);
  const t = tenant(actor);
  const [cls] = await classRows(t, { _id: classId });
  if (!cls) return null;
  const [enrollments, assignmentDocs, timetableDocs, subjectDocs] = await Promise.all([
    t.enrollments.find({ class_id: classId }, { projection: { student_id: 1 } }),
    t.teachingAssignments.find({ class_id: classId }),
    t.timetable.find({ class_id: classId }, { sort: { weekday: 1, start_time: 1 } }),
    t.subjects.find({}, { projection: { name: 1, color: 1 } }),
  ]);
  const subjects = new Map(subjectDocs.map((s) => [String(s._id), s]));
  const studentDocs = await t.profiles.find(
    { _id: { $in: enrollments.map((e) => String(e.student_id)) } },
    { projection: { display_name: 1, account_state: 1, avatar_color: 1 }, sort: { display_name: 1 } },
  );
  const students = studentDocs.map((p) => ({ user_id: String(p._id), display_name: String(p.display_name), account_state: String(p.account_state), avatar_color: String(p.avatar_color) }));
  const people = await nameMap(t, [...assignmentDocs.map((a) => a.teacher_id), ...timetableDocs.map((e) => e.teacher_id)]);
  const assignments = assignmentDocs
    .filter((a) => subjects.has(String(a.subject_id)) && people.has(String(a.teacher_id)))
    .map((a) => ({
      id: String(a._id), subject_id: String(a.subject_id), subject_name: String(subjects.get(String(a.subject_id))!.name),
      subject_color: String(subjects.get(String(a.subject_id))!.color), teacher_id: String(a.teacher_id), teacher_name: people.get(String(a.teacher_id))!,
    }))
    .sort((a, b) => a.subject_name.localeCompare(b.subject_name) || a.teacher_name.localeCompare(b.teacher_name));
  const timetable = timetableDocs
    .filter((e) => subjects.has(String(e.subject_id)))
    .map((e) => ({
      id: String(e._id), weekday: Number(e.weekday), start_time: String(e.start_time), end_time: String(e.end_time), room: (e.room as string | null) ?? null,
      subject_name: String(subjects.get(String(e.subject_id))!.name), subject_color: String(subjects.get(String(e.subject_id))!.color),
      teacher_name: e.teacher_id ? people.get(String(e.teacher_id)) ?? null : null,
    }));
  return { cls, students, assignments, timetable };
}

export const classSchema = z.object({
  id: optionalUuid,
  name: z.string().trim().min(1, "Enter a class name.").max(40),
  gradeLevel: z.coerce.number({ message: "Choose a grade." }).int().min(1, "Grade must be 1–13.").max(13, "Grade must be 1–13."),
  academicYear: z.string().trim().regex(/^\d{4}-\d{4}$/, "Use the format 2026-2027.").default("2026-2027"),
  homeroomTeacherId: optionalUuid,
});
export type ClassInput = z.infer<typeof classSchema>;

export async function saveClass(actor: Actor, input: ClassInput): Promise<string> {
  assertAdmin(actor);
  const t = tenant(actor);
  await assertStaffInSchool(t, input.homeroomTeacherId);
  const fields = { name: input.name, grade_level: input.gradeLevel, academic_year: input.academicYear, homeroom_teacher_id: input.homeroomTeacherId };
  let id: string;
  try {
    if (input.id) {
      const r = await t.classes.updateOne({ _id: input.id }, { $set: fields });
      if (r.matched === 0) throw new UserFacingError("That class wasn't found.");
      id = input.id;
    } else {
      id = await t.classes.insertOne(fields);
    }
  } catch (err) {
    if (isDuplicateKey(err)) throw new UserFacingError("A class with this name already exists for that academic year.");
    throw err;
  }
  await audit({ schoolId: actor.schoolId, actorId: actor.id, action: input.id ? "class.updated" : "class.created", resourceType: "class", resourceId: id });
  return id;
}

export async function deleteClass(actor: Actor, classId: string): Promise<void> {
  assertAdmin(actor);
  const t = tenant(actor);
  await assertClassInSchool(t, classId);
  if (await t.grades.count({ class_id: classId })) {
    throw new UserFacingError("This class has recorded grades and can't be deleted. Archive it by renaming instead.");
  }
  const students = await t.enrollments.count({ class_id: classId });
  if ((await t.classes.deleteOne({ _id: classId })) === 0) throw new UserFacingError("That class wasn't found.");
  // Former foreign-key cascades.
  await Promise.all([
    t.enrollments.deleteMany({ class_id: classId }),
    t.teachingAssignments.deleteMany({ class_id: classId }),
    t.timetable.deleteMany({ class_id: classId }),
    t.assessments.deleteMany({ class_id: classId }),
    t.attendance.deleteMany({ class_id: classId }),
    t.invitations.updateMany({ class_id: classId }, { $set: { class_id: null } }),
  ]);
  await audit({ schoolId: actor.schoolId, actorId: actor.id, action: "class.deleted", resourceType: "class", resourceId: classId, metadata: { students } });
}

export const subjectSchema = z.object({
  name: z.string().trim().min(1, "Enter a subject name.").max(60),
  color: z.enum(SUBJECT_COLORS).catch("coral"),
});

export async function createSubject(actor: Actor, input: z.infer<typeof subjectSchema>): Promise<void> {
  assertAdmin(actor);
  let id: string;
  try {
    id = await tenant(actor).subjects.insertOne({ name: input.name, color: input.color });
  } catch (err) {
    if (isDuplicateKey(err)) throw new UserFacingError("A subject with this name already exists.");
    throw err;
  }
  await audit({ schoolId: actor.schoolId, actorId: actor.id, action: "subject.created", resourceType: "subject", resourceId: id });
}

export async function listSubjects(actor: Actor) {
  assertAdmin(actor);
  const t = tenant(actor);
  const [subjects, assignments, grades] = await Promise.all([
    t.subjects.find({}, { sort: { name: 1 } }),
    t.teachingAssignments.find({}, { projection: { subject_id: 1, class_id: 1 } }),
    t.grades.aggregate<{ _id: string; n: number }>([{ $group: { _id: "$subject_id", n: { $sum: 1 } } }]),
  ]);
  const gradeCount = new Map(grades.map((g) => [String(g._id), g.n]));
  return subjects.map((s) => {
    const id = String(s._id);
    return {
      id, name: String(s.name), color: String(s.color),
      classes: new Set(assignments.filter((a) => String(a.subject_id) === id).map((a) => String(a.class_id))).size,
      grades: gradeCount.get(id) ?? 0,
    };
  });
}

export async function deleteSubject(actor: Actor, subjectId: string): Promise<void> {
  assertAdmin(actor);
  const t = tenant(actor);
  await assertSubjectInSchool(t, subjectId);
  if (await t.grades.count({ subject_id: subjectId })) throw new UserFacingError("This subject has recorded grades and can't be deleted.");
  if ((await t.subjects.deleteOne({ _id: subjectId })) === 0) throw new UserFacingError("That subject wasn't found.");
  // Former foreign-key cascades / set-null.
  await Promise.all([
    t.teachingAssignments.deleteMany({ subject_id: subjectId }),
    t.timetable.deleteMany({ subject_id: subjectId }),
    t.assessments.deleteMany({ subject_id: subjectId }),
    t.attendance.deleteMany({ subject_id: subjectId }),
    t.goals.updateMany({ subject_id: subjectId }, { $set: { subject_id: null } }),
    t.groups.updateMany({ subject_id: subjectId }, { $set: { subject_id: null } }),
  ]);
  await audit({ schoolId: actor.schoolId, actorId: actor.id, action: "subject.deleted", resourceType: "subject", resourceId: subjectId });
}

export const assignmentSchema = z.object({ classId: uuid, subjectId: uuid, teacherId: uuid });

export async function addTeachingAssignment(actor: Actor, input: z.infer<typeof assignmentSchema>): Promise<void> {
  assertAdmin(actor);
  const t = tenant(actor);
  await assertClassInSchool(t, input.classId);
  await assertSubjectInSchool(t, input.subjectId);
  await assertStaffInSchool(t, input.teacherId);
  const exists = () => new UserFacingError("That teacher already teaches this subject in this class.");
  if (await t.teachingAssignments.count({ class_id: input.classId, subject_id: input.subjectId, teacher_id: input.teacherId })) throw exists();
  try {
    await t.teachingAssignments.insertOne({ class_id: input.classId, subject_id: input.subjectId, teacher_id: input.teacherId });
  } catch (err) {
    if (isDuplicateKey(err)) throw exists();
    throw err;
  }
  await audit({
    schoolId: actor.schoolId, actorId: actor.id, action: "teaching.assigned", resourceType: "class", resourceId: input.classId,
    metadata: { subject_id: input.subjectId, teacher_id: input.teacherId },
  });
}

export async function removeTeachingAssignment(actor: Actor, assignmentId: string): Promise<void> {
  assertAdmin(actor);
  const t = tenant(actor);
  const row = await t.teachingAssignments.findOne({ _id: assignmentId }, { projection: { class_id: 1 } });
  if (!row || (await t.teachingAssignments.deleteOne({ _id: assignmentId })) === 0) throw new UserFacingError("That assignment wasn't found.");
  await audit({ schoolId: actor.schoolId, actorId: actor.id, action: "teaching.unassigned", resourceType: "class", resourceId: String(row.class_id), metadata: { assignment_id: assignmentId } });
}

export const enrollmentSchema = z.object({ classId: uuid, studentId: uuid });

export async function enrollStudent(actor: Actor, classId: string, studentId: string): Promise<void> {
  assertAdmin(actor);
  const t = tenant(actor);
  await assertClassInSchool(t, classId);
  await assertStudentInSchool(t, studentId);
  const exists = () => new UserFacingError("That student is already in this class.");
  if (await t.enrollments.count({ class_id: classId, student_id: studentId })) throw exists();
  try {
    await t.enrollments.insertOne({ class_id: classId, student_id: studentId, enrolled_at: new Date() });
  } catch (err) {
    if (isDuplicateKey(err)) throw exists();
    throw err;
  }
  await audit({ schoolId: actor.schoolId, actorId: actor.id, action: "enrollment.added", resourceType: "class", resourceId: classId, metadata: { student_id: studentId } });
}

export async function unenrollStudent(actor: Actor, classId: string, studentId: string): Promise<void> {
  assertAdmin(actor);
  if ((await tenant(actor).enrollments.deleteOne({ class_id: classId, student_id: studentId })) === 0) throw new UserFacingError("That student isn't in this class.");
  await audit({ schoolId: actor.schoolId, actorId: actor.id, action: "enrollment.removed", resourceType: "class", resourceId: classId, metadata: { student_id: studentId } });
}

const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/;
export const timetableSchema = z
  .object({
    classId: uuid,
    subjectId: uuid,
    teacherId: optionalUuid,
    weekday: z.coerce.number().int().min(1, "Choose a day.").max(7, "Choose a day."),
    startTime: z.string().regex(timeRe, "Use HH:MM."),
    endTime: z.string().regex(timeRe, "Use HH:MM."),
    room: z.string().trim().max(20).optional().transform((v) => (v ? v : null)),
  })
  .refine((v) => v.endTime > v.startTime, { path: ["endTime"], message: "End time must be after the start time." });

export async function addTimetableEntry(actor: Actor, input: z.infer<typeof timetableSchema>): Promise<void> {
  assertAdmin(actor);
  const t = tenant(actor);
  await assertClassInSchool(t, input.classId);
  await assertSubjectInSchool(t, input.subjectId);
  await assertStaffInSchool(t, input.teacherId);
  // "HH:MM" strings compare correctly as text.
  const clash = await t.timetable.count({ class_id: input.classId, weekday: input.weekday, start_time: { $lt: input.endTime }, end_time: { $gt: input.startTime } });
  if (clash) throw new UserFacingError("This overlaps another lesson for the class on that day.");
  const id = await t.timetable.insertOne({
    class_id: input.classId, subject_id: input.subjectId, teacher_id: input.teacherId, weekday: input.weekday,
    start_time: input.startTime, end_time: input.endTime, room: input.room,
  });
  await audit({ schoolId: actor.schoolId, actorId: actor.id, action: "timetable.added", resourceType: "class", resourceId: input.classId, metadata: { entry_id: id } });
}

export async function removeTimetableEntry(actor: Actor, entryId: string): Promise<void> {
  assertAdmin(actor);
  const t = tenant(actor);
  const row = await t.timetable.findOne({ _id: entryId }, { projection: { class_id: 1 } });
  if (!row || (await t.timetable.deleteOne({ _id: entryId })) === 0) throw new UserFacingError("That lesson wasn't found.");
  await audit({ schoolId: actor.schoolId, actorId: actor.id, action: "timetable.removed", resourceType: "class", resourceId: String(row.class_id), metadata: { entry_id: entryId } });
}

// ───────────────────────────── Consent ─────────────────────────────

export interface ConsentStatus {
  granted: boolean;
  recordedAt: string | null;
  method: string | null;
  givenByRole: string | null;
}

export interface StudentConsentRow {
  user_id: string;
  display_name: string;
  account_state: "active" | "pending_guardian_consent" | "suspended";
  birth_year: number | null;
  avatar_color: string;
  class_names: string | null;
  guardians: number;
  consents: Record<ConsentType, ConsentStatus>;
}

export async function listStudentConsent(actor: Actor): Promise<StudentConsentRow[]> {
  assertAdmin(actor);
  const t = tenant(actor);
  const students = (await t.profiles.find({ role: "student" }, { projection: { display_name: 1, account_state: 1, birth_year: 1, avatar_color: 1 } }))
    .sort((a, b) => Number(b.account_state === "pending_guardian_consent") - Number(a.account_state === "pending_guardian_consent") || String(a.display_name).localeCompare(String(b.display_name)));
  const ids = students.map((s) => String(s._id));
  const [enrollments, classes, links, records] = await Promise.all([
    t.enrollments.find({ student_id: { $in: ids } }, { projection: { student_id: 1, class_id: 1 } }),
    t.classes.find({}, { projection: { name: 1 } }),
    t.guardianLinks.find({ student_id: { $in: ids }, status: "active" }, { projection: { student_id: 1 } }),
    t.consents.find({ subject_id: { $in: ids } }, { sort: { recorded_at: -1 }, projection: { subject_id: 1, consent_type: 1, granted: 1, recorded_at: 1, method: 1, given_by_role: 1 } }),
  ]);
  const classNames = new Map(classes.map((c) => [String(c._id), String(c.name)]));
  const empty = (): ConsentStatus => ({ granted: false, recordedAt: null, method: null, givenByRole: null });
  const map = new Map<string, Record<ConsentType, ConsentStatus>>();
  for (const id of ids) map.set(id, { platform: empty(), wellbeing_checkins: empty(), matchmaking: empty(), ai_features: empty(), guardian_access: empty() });
  // Newest record per (student, type) wins — records are sorted newest first.
  for (const r of records) {
    const m = map.get(String(r.subject_id));
    const type = r.consent_type as ConsentType;
    if (!m || !(type in m) || m[type].recordedAt) continue;
    m[type] = { granted: Boolean(r.granted), recordedAt: iso(r.recorded_at), method: r.method ?? null, givenByRole: r.given_by_role ?? null };
  }
  return students.map((s) => {
    const id = String(s._id);
    const names = enrollments.filter((e) => String(e.student_id) === id).map((e) => classNames.get(String(e.class_id))).filter((n): n is string => Boolean(n)).sort();
    return {
      user_id: id, display_name: String(s.display_name), account_state: s.account_state, birth_year: (s.birth_year as number | null) ?? null,
      avatar_color: String(s.avatar_color), class_names: names.length ? names.join(", ") : null,
      guardians: links.filter((l) => String(l.student_id) === id).length, consents: map.get(id)!,
    };
  });
}

export interface ConsentHistoryRow {
  id: string;
  consent_type: ConsentType;
  granted: boolean;
  method: string;
  given_by_role: string;
  recorded_at: string;
  student_id: string;
  student_name: string;
  given_by_name: string | null;
}

export async function consentHistory(actor: Actor, studentId?: string | null, limit = 40): Promise<ConsentHistoryRow[]> {
  assertAdmin(actor);
  const t = tenant(actor);
  const rows = await t.consents.find(studentId ? { subject_id: studentId } : {}, { sort: { recorded_at: -1 }, limit });
  const names = await nameMap(t, [...rows.map((r) => r.subject_id), ...rows.map((r) => r.given_by)]);
  return rows
    .filter((r) => names.has(String(r.subject_id)))
    .map((r) => ({
      id: String(r._id), consent_type: r.consent_type as ConsentType, granted: Boolean(r.granted), method: String(r.method), given_by_role: String(r.given_by_role),
      recorded_at: iso(r.recorded_at) ?? "", student_id: String(r.subject_id), student_name: names.get(String(r.subject_id))!,
      given_by_name: r.given_by ? names.get(String(r.given_by)) ?? null : null,
    }));
}

const choice = z.enum(["", "grant", "withhold"]).catch("");
export const recordConsentSchema = z
  .object({
    studentId: uuid,
    method: z.enum(["paper_form", "school_policy"], { message: "Choose how consent was given." }),
    confirm: z.literal("on", { message: "Confirm that you have the signed form or policy decision on file." }),
    platform: choice,
    wellbeing_checkins: choice,
    matchmaking: choice,
    ai_features: choice,
    guardian_access: choice,
  })
  .transform((v) => {
    const choices: Partial<Record<ConsentType, boolean>> = {};
    for (const t of ALL_CONSENTS) if (v[t]) choices[t] = v[t] === "grant";
    return { studentId: v.studentId, method: v.method, choices };
  })
  .refine((v) => Object.keys(v.choices).length > 0, { path: ["platform"], message: "Choose at least one consent to record." });
export type RecordConsentInput = z.infer<typeof recordConsentSchema>;

/**
 * Bring a student's account state in line with their latest platform consent.
 * The caller must already have authorised the actor for this student (admin of
 * the school, or an actively linked guardian). Scoped to `by.schoolId`.
 * Activation: pending → active once platform consent is granted.
 * Deactivation (admin path only): active → pending when platform consent is withdrawn.
 */
export async function syncStudentAccountState(
  studentId: string,
  by: { actorId: string; schoolId: string; allowDeactivate: boolean },
): Promise<"activated" | "deactivated" | null> {
  const t = tenant({ schoolId: by.schoolId });
  const p = await t.profiles.findOne({ _id: studentId, role: "student" }, { projection: { account_state: 1 } });
  if (!p) return null;
  const consents = await consentMap(t, studentId);
  if (p.account_state === "pending_guardian_consent" && consents.platform.granted) {
    const r = await t.profiles.updateOne({ _id: studentId, account_state: "pending_guardian_consent" }, { $set: { account_state: "active" } });
    if (r.modified === 0) return null;
    await audit({ schoolId: by.schoolId, actorId: by.actorId, action: "account.activated", resourceType: "user", resourceId: studentId, metadata: { reason: "platform_consent" } });
    await notify(by.schoolId, [studentId], {
      type: "account", title: "Your account is ready",
      body: "Consent has been recorded. Features you have consent for are now switched on.", link: "/student",
    });
    return "activated";
  }
  if (by.allowDeactivate && p.account_state === "active" && consents.platform.recordedAt && !consents.platform.granted) {
    const r = await t.profiles.updateOne({ _id: studentId, account_state: "active" }, { $set: { account_state: "pending_guardian_consent" } });
    if (r.modified === 0) return null;
    await audit({ schoolId: by.schoolId, actorId: by.actorId, action: "account.deactivated", resourceType: "user", resourceId: studentId, metadata: { reason: "platform_consent_withdrawn" } });
    return "deactivated";
  }
  return null;
}

/** Record consent from a paper form or a school policy decision, then sync the account state. */
export async function recordConsent(actor: Actor, input: RecordConsentInput): Promise<{ recorded: number; accountChange: "activated" | "deactivated" | null }> {
  await verifyAdmin(actor);
  const entries = Object.entries(input.choices) as Array<[ConsentType, boolean]>;
  if (entries.length === 0) throw new UserFacingError("Choose at least one consent to record.");
  const t = tenant(actor);
  await assertStudentInSchool(t, input.studentId, "That student isn't part of your school.");
  const givenByRole = input.method === "paper_form" ? "guardian" : "admin";
  const now = new Date();
  await t.consents.insertMany(
    entries.map(([type, granted]) => ({
      subject_id: input.studentId, consent_type: type, granted, given_by: actor.id, given_by_role: givenByRole, method: input.method, recorded_at: now,
    })),
  );
  await audit({
    schoolId: actor.schoolId, actorId: actor.id, action: "consent.recorded", resourceType: "consent", resourceId: input.studentId,
    metadata: { method: input.method, granted: entries.filter(([, g]) => g).length, withheld: entries.filter(([, g]) => !g).length },
  });
  const accountChange = await syncStudentAccountState(input.studentId, { actorId: actor.id, schoolId: actor.schoolId, allowDeactivate: true });
  return { recorded: entries.length, accountChange };
}

// ───────────────────────────── Audit ─────────────────────────────

export const auditFilterSchema = z.object({
  action: z.string().trim().max(60).regex(/^[a-z_.]*$/i).catch(""),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().catch(undefined),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().catch(undefined),
});
export type AuditFilter = z.infer<typeof auditFilterSchema>;

async function recentAudit(t: Tenant, f: Partial<AuditFilter> & { limit: number }): Promise<AuditRow[]> {
  const filter: Document = {};
  if (f.action) filter.action = { $regex: `^${escapeRegex(f.action)}` };
  if (f.from || f.to) {
    filter.created_at = {
      ...(f.from ? { $gte: new Date(`${f.from}T00:00:00Z`) } : {}),
      ...(f.to ? { $lt: new Date(`${addDays(f.to, 1)}T00:00:00Z`) } : {}),
    };
  }
  const rows = await t.auditLogs.find(filter, { sort: { created_at: -1, _id: -1 }, limit: f.limit });
  const names = await nameMap(t, rows.map((r) => r.actor_id));
  return rows.map((r) => ({
    id: String(r._id), action: String(r.action), resource_type: r.resource_type ?? null, resource_id: r.resource_id ?? null,
    metadata: (r.metadata as Record<string, unknown>) ?? {}, created_at: iso(r.created_at) ?? "", actor_id: r.actor_id ?? null,
    actor_name: r.actor_id ? names.get(String(r.actor_id)) ?? null : null,
  }));
}

export async function listAudit(actor: Actor, filter: AuditFilter, limit = 200): Promise<AuditRow[]> {
  assertAdmin(actor);
  return recentAudit(tenant(actor), { ...filter, limit });
}

export async function auditActionPrefixes(actor: Actor): Promise<string[]> {
  assertAdmin(actor);
  const actions = (await tenant(actor).auditLogs.distinct("action")).map(String);
  return [...new Set(actions.map((a) => a.split(".")[0]))].sort();
}

/** Export the filtered audit log as CSV. The export itself is audited. */
export async function exportAuditCsv(actor: Actor, filter: AuditFilter): Promise<string> {
  assertAdmin(actor);
  const rows = await recentAudit(tenant(actor), { ...filter, limit: 10_000 });
  await audit({ schoolId: actor.schoolId, actorId: actor.id, action: "audit.exported", resourceType: "audit_log", metadata: { rows: rows.length } });
  const header = ["id", "created_at", "action", "actor_id", "actor_name", "resource_type", "resource_id", "metadata"];
  const lines = rows.map((r) =>
    [r.id, r.created_at, r.action, r.actor_id, r.actor_name, r.resource_type, r.resource_id,
      safeMetadata(r.metadata).map(([k, v]) => `${k}=${v}`).join("; ")].map(csvCell).join(","),
  );
  return [header.join(","), ...lines].join("\r\n") + "\r\n";
}

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  let s = String(v);
  // Neutralise spreadsheet formula injection.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

/**
 * Metadata is displayed as identifiers, enums and counts only. Anything that
 * looks like free text is redacted, defensively, even though writers should
 * never put free text in audit metadata.
 */
export function safeMetadata(meta: unknown): Array<[string, string]> {
  if (!meta || typeof meta !== "object") return [];
  const out: Array<[string, string]> = [];
  for (const [k, v] of Object.entries(meta as Record<string, unknown>)) {
    if (!/^[a-z0-9_.]{1,40}$/i.test(k)) continue;
    if (typeof v === "number" || typeof v === "boolean") out.push([k, String(v)]);
    else if (v === null) out.push([k, "—"]);
    else if (typeof v === "string" && /^[A-Za-z0-9_.:-]{1,64}$/.test(v)) out.push([k, v]);
    else out.push([k, "[redacted]"]);
  }
  return out;
}

/** Sign-in health for the school: counts only, from the credential store (privileged, after verifyAdmin). */
export async function securityOverview(actor: Actor) {
  await verifyAdmin(actor);
  const ids = await schoolUserIds(tenant(actor));
  const now = new Date();
  const sessions = await col(C.sessions);
  const users = await col(C.users);
  const [active, signedIn, locked, disabled, failed] = await Promise.all([
    sessions.countDocuments({ user_id: { $in: ids }, expires_at: { $gt: now } }),
    sessions.distinct("user_id", { user_id: { $in: ids }, expires_at: { $gt: now } }),
    users.countDocuments({ _id: { $in: ids }, locked_until: { $gt: now } }),
    users.countDocuments({ _id: { $in: ids }, status: { $ne: "active" } }),
    users.aggregate<{ n: number }>([{ $match: { _id: { $in: ids } } }, { $group: { _id: null, n: { $sum: { $ifNull: ["$failed_logins", 0] } } } }]).toArray(),
  ]);
  return { sessions: active, users_signed_in: signedIn.length, locked, disabled, failed_attempts: failed[0]?.n ?? 0 };
}

// ───────────────────────────── Subscription ─────────────────────────────

export interface PlanRow {
  id: string;
  name: string;
  description: string;
  price_monthly_cents: number;
  price_annual_cents: number;
  currency: string;
  max_students: number | null;
  features: string[];
}

function toPlanRow(p: Document): PlanRow {
  return {
    id: String(p._id), name: String(p.name), description: String(p.description), price_monthly_cents: Number(p.price_monthly_cents),
    price_annual_cents: Number(p.price_annual_cents), currency: String(p.currency), max_students: (p.max_students as number | null) ?? null, features: (p.features as string[]) ?? [],
  };
}

export async function getSubscription(actor: Actor) {
  assertAdmin(actor);
  const t = tenant(actor);
  const [sub, plans, billingDocs, students] = await Promise.all([
    t.subscriptions.findOne({}),
    t.plans(),
    t.billing.find({}, { sort: { created_at: -1 }, limit: 50 }),
    t.profiles.count({ role: "student" }),
  ]);
  const current = sub
    ? {
        plan_id: String(sub.plan_id), billing_cycle: sub.billing_cycle as "monthly" | "annual", status: String(sub.status),
        funding_source: sub.funding_source as (typeof FUNDING_SOURCES)[number], seats: Number(sub.seats),
        current_period_end: iso(sub.current_period_end) ?? "", updated_at: iso(sub.updated_at) ?? "",
      }
    : null;
  const billing = billingDocs.map((b) => ({
    id: String(b._id), description: String(b.description), amount_cents: Number(b.amount_cents), currency: String(b.currency), status: String(b.status),
    period_start: iso(b.period_start) ?? "", period_end: iso(b.period_end) ?? "", provider_ref: (b.provider_ref as string | null) ?? null, created_at: iso(b.created_at) ?? "",
  }));
  return { current, plans: plans.map(toPlanRow), billing, students };
}

export const subscriptionSchema = z.object({
  planId: z.string().trim().min(1, "Choose a plan.").max(40),
  billingCycle: z.enum(["monthly", "annual"], { message: "Choose a billing cycle." }),
  fundingSource: z.enum(FUNDING_SOURCES, { message: "Choose a funding source." }),
  seats: z.coerce.number({ message: "Enter the number of seats." }).int().min(1, "At least one seat.").max(100_000),
});

/**
 * Record a plan / billing-cycle change. No payment is processed: payment
 * processing isn't configured, so a *draft* billing record documents the change.
 */
export async function changeSubscription(actor: Actor, input: z.infer<typeof subscriptionSchema>): Promise<{ draftId: string | null }> {
  await verifyAdmin(actor);
  const t = tenant(actor);
  const planDoc = (await t.plans()).find((p) => String(p._id) === input.planId);
  if (!planDoc) throw new UserFacingError("That plan doesn't exist.");
  const plan = toPlanRow(planDoc);
  const students = await t.profiles.count({ role: "student" });
  if (plan.max_students !== null && input.seats > plan.max_students) {
    throw new UserFacingError(`The ${plan.name} plan supports up to ${plan.max_students} students.`);
  }
  if (input.seats < students) throw new UserFacingError(`You have ${students} student accounts — choose at least ${students} seats.`);
  const before = await t.subscriptions.findOne({}, { projection: { plan_id: 1, billing_cycle: 1 } });
  if (!before) throw new UserFacingError("Your school has no subscription record yet. Contact EduConnect support to set one up.");
  const status = plan.id === "pilot" ? "trialing" : "active";
  await t.subscriptions.updateOne(
    { _id: before._id },
    { $set: { plan_id: plan.id, billing_cycle: input.billingCycle, funding_source: input.fundingSource, seats: input.seats, status, updated_at: new Date() } },
  );
  await audit({
    schoolId: actor.schoolId, actorId: actor.id, action: "subscription.changed", resourceType: "subscription", resourceId: actor.schoolId,
    metadata: { from_plan: String(before.plan_id), to_plan: plan.id, from_cycle: String(before.billing_cycle), to_cycle: input.billingCycle, funding: input.fundingSource, seats: input.seats },
  });
  if (before.plan_id === plan.id && before.billing_cycle === input.billingCycle) return { draftId: null };

  const amount = input.billingCycle === "annual" ? plan.price_annual_cents : plan.price_monthly_cents;
  const today = todayIn(actor.timezone);
  const draftId = await t.billing.insertOne({
    description: `${plan.name} plan — ${input.billingCycle} (draft; payment processing not configured)`, amount_cents: amount, currency: plan.currency,
    status: "draft", period_start: today, period_end: addDays(today, input.billingCycle === "annual" ? 365 : 30), provider_ref: null,
  });
  await audit({ schoolId: actor.schoolId, actorId: actor.id, action: "billing.draft_created", resourceType: "billing_record", resourceId: draftId, metadata: { amount_cents: amount } });
  return { draftId };
}

// ───────────────────────────── Settings & retention ─────────────────────────────

export interface SchoolSettings {
  id: string;
  name: string;
  join_code: string;
  country: string;
  timezone: string;
  data_region: string;
  is_demo: boolean;
  settings: { wellbeing_retention_days?: number; audit_retention_days?: number; [k: string]: unknown };
}

export const DEFAULT_RETENTION = { wellbeing_retention_days: 365, audit_retention_days: 730 };

export async function getSchoolSettings(actor: Actor): Promise<SchoolSettings | null> {
  assertAdmin(actor);
  const s = await tenant(actor).schools.get();
  if (!s) return null;
  return {
    id: String(s._id), name: String(s.name), join_code: String(s.join_code), country: String(s.country), timezone: String(s.timezone),
    data_region: String(s.data_region), is_demo: Boolean(s.is_demo), settings: (s.settings as SchoolSettings["settings"]) ?? {},
  };
}

function validTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export const schoolInfoSchema = z.object({
  name: z.string().trim().min(2, "Enter the school name.").max(160),
  timezone: z.string().trim().min(1).max(60).refine(validTimeZone, "Choose a valid time zone."),
});

export async function updateSchoolInfo(actor: Actor, input: z.infer<typeof schoolInfoSchema>): Promise<void> {
  assertAdmin(actor);
  const r = await tenant(actor).schools.update({ $set: { name: input.name, timezone: input.timezone } });
  if (r.matchedCount === 0) throw new AuthorizationError();
  await audit({ schoolId: actor.schoolId, actorId: actor.id, action: "school.updated", resourceType: "school", resourceId: actor.schoolId, metadata: { timezone: input.timezone } });
}

export async function regenerateJoinCode(actor: Actor): Promise<string> {
  await verifyAdmin(actor);
  const t = tenant(actor);
  const school = await t.schools.get();
  if (!school) throw new AuthorizationError();
  const prefix = String(school.name ?? "SCHOOL").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6) || "SCHOOL";
  // Join codes are globally unique: existence check across schools (privileged, after verifyAdmin).
  const schools = await col(C.schools);
  for (let i = 0; i < 5; i++) {
    const candidate = `${prefix}-${humanCode(6)}`;
    if (await schools.countDocuments({ join_code: candidate }, { limit: 1 })) continue;
    try {
      const r = await t.schools.update({ $set: { join_code: candidate } });
      if (r.matchedCount === 0) throw new AuthorizationError();
    } catch (err) {
      if (isDuplicateKey(err)) continue;
      throw err;
    }
    await audit({ schoolId: actor.schoolId, actorId: actor.id, action: "school.join_code_regenerated", resourceType: "school", resourceId: actor.schoolId });
    return candidate;
  }
  throw new UserFacingError("Couldn't generate a unique code. Please try again.");
}

export const retentionSchema = z.object({
  wellbeingRetentionDays: z.coerce.number({ message: "Enter a number of days." }).int().min(30, "At least 30 days.").max(3650, "At most 10 years."),
  auditRetentionDays: z.coerce.number({ message: "Enter a number of days." }).int().min(180, "Keep audit logs at least 180 days.").max(3650, "At most 10 years."),
});

export async function updateRetention(actor: Actor, input: z.infer<typeof retentionSchema>): Promise<void> {
  assertAdmin(actor);
  await tenant(actor).schools.update({
    $set: { "settings.wellbeing_retention_days": input.wellbeingRetentionDays, "settings.audit_retention_days": input.auditRetentionDays },
  });
  await audit({
    schoolId: actor.schoolId, actorId: actor.id, action: "school.retention_updated", resourceType: "school", resourceId: actor.schoolId,
    metadata: { wellbeing_days: input.wellbeingRetentionDays, audit_days: input.auditRetentionDays },
  });
}

/**
 * Delete wellbeing check-ins (including their encrypted private notes) and
 * audit rows older than the school's retention windows. Check-ins are selected
 * by date only and never read; only counts are returned and logged.
 */
export async function runRetentionCleanup(actor: Actor): Promise<{ checkins: number; notes: number; auditRows: number }> {
  await verifyAdmin(actor);
  const t = tenant(actor);
  const school = await t.schools.get();
  const settings = (school?.settings ?? {}) as SchoolSettings["settings"];
  const wDays = Number(settings.wellbeing_retention_days ?? DEFAULT_RETENTION.wellbeing_retention_days);
  const aDays = Number(settings.audit_retention_days ?? DEFAULT_RETENTION.audit_retention_days);
  const cutoff = addDays(todayIn(String(school?.timezone ?? actor.timezone)), -wDays);
  const notes = await t.checkins.count({ date: { $lt: cutoff }, note_enc: { $ne: null } });
  const checkins = await t.checkins.deleteMany({ date: { $lt: cutoff } });
  const auditRows = await t.auditLogs.deleteMany({ created_at: { $lt: new Date(Date.now() - aDays * 86400_000) } });
  const result = { checkins, notes, auditRows };
  await audit({
    schoolId: actor.schoolId, actorId: actor.id, action: "retention.cleanup", resourceType: "school", resourceId: actor.schoolId,
    metadata: { checkins_deleted: result.checkins, notes_deleted: result.notes, audit_rows_deleted: result.auditRows, wellbeing_days: wDays, audit_days: aDays },
  });
  return result;
}

// ───────────────────────────── Alert rules (configuration only) ─────────────────────────────

export interface AlertRuleRow {
  id: string;
  name: string;
  kind: "window_average" | "consecutive_low";
  window_days: number;
  threshold: number;
  consecutive_count: number | null;
  min_checkins: number;
  severity: "info" | "attention" | "urgent";
  enabled: boolean;
  updated_at: string;
}

const SEVERITY_RANK: Record<string, number> = { info: 0, attention: 1, urgent: 2 };

/** Rule configuration only (thresholds) — never check-ins or alerts. */
export async function listAlertRules(actor: Actor): Promise<AlertRuleRow[]> {
  assertAdmin(actor);
  const rows = await tenant(actor).alertRules.find({});
  return rows
    .map((r) => ({
      id: String(r._id), name: String(r.name), kind: r.kind, window_days: Number(r.window_days), threshold: Number(r.threshold),
      consecutive_count: (r.consecutive_count as number | null) ?? null, min_checkins: Number(r.min_checkins), severity: r.severity,
      enabled: Boolean(r.enabled), updated_at: iso(r.updated_at ?? r.created_at) ?? "",
    }))
    .sort((a, b) => (SEVERITY_RANK[b.severity] ?? 0) - (SEVERITY_RANK[a.severity] ?? 0) || a.name.localeCompare(b.name));
}

export const alertRuleSchema = z.object({
  id: uuid,
  threshold: z.coerce.number().min(1, "1–10").max(10, "1–10"),
  windowDays: z.coerce.number().int().min(3, "3–60 days").max(60, "3–60 days"),
  minCheckins: z.coerce.number().int().min(1).max(60),
  consecutiveCount: z.coerce.number().int().min(2).max(20).optional().catch(undefined),
  severity: z.enum(["info", "attention", "urgent"]),
  enabled: z.enum(["on"]).optional().transform((v) => v === "on"),
});

export async function updateAlertRule(actor: Actor, input: z.infer<typeof alertRuleSchema>): Promise<void> {
  assertAdmin(actor);
  const t = tenant(actor);
  const rule = await t.alertRules.findOne({ _id: input.id }, { projection: { kind: 1 } });
  if (!rule) throw new UserFacingError("That rule wasn't found.");
  const set: Document = {
    threshold: input.threshold, window_days: input.windowDays, min_checkins: input.minCheckins, severity: input.severity,
    enabled: input.enabled, updated_by: actor.id, updated_at: new Date(),
  };
  if (rule.kind === "consecutive_low" && input.consecutiveCount !== undefined) set.consecutive_count = input.consecutiveCount;
  await t.alertRules.updateOne({ _id: input.id }, { $set: set });
  await audit({ schoolId: actor.schoolId, actorId: actor.id, action: "alert_rule.updated", resourceType: "alert_rule", resourceId: input.id, metadata: { enabled: input.enabled, severity: input.severity } });
}
