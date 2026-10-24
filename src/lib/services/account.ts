// Self-service account functions available to every role: notifications,
// preferences, password, data export and deletion requests.

import { col, COLLECTIONS as C } from "@/lib/db/mongo";
import { tenant } from "@/lib/db/tenant";
import { decryptField } from "@/lib/db/field-crypto";
import { UserFacingError } from "@/lib/action-state";
import { hashPassword, passwordProblem, verifyPassword } from "@/lib/auth/crypto";
import type { Actor } from "./actor";
import { audit } from "./audit";
import { notify, type NotificationType, NOTIFICATION_TYPE_LABELS } from "./notify";

export interface NotificationRow {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  sensitive: boolean;
  read_at: Date | null;
  created_at: Date;
}

export async function listNotifications(actor: Actor, limit = 50): Promise<NotificationRow[]> {
  const rows = await tenant(actor).notifications.find({ user_id: actor.id }, { sort: { created_at: -1 }, limit });
  return rows.map((n) => ({
    id: String(n._id), type: n.type, title: n.title, body: n.body ?? null, link: n.link ?? null, sensitive: Boolean(n.sensitive), read_at: n.read_at ?? null, created_at: n.created_at,
  }));
}

export async function unreadCount(actor: Actor): Promise<number> {
  return tenant(actor).notifications.count({ user_id: actor.id, read_at: null });
}

export async function markNotificationsRead(actor: Actor, id?: string): Promise<void> {
  const t = tenant(actor);
  if (id) await t.notifications.updateOne({ _id: id, user_id: actor.id, read_at: null }, { $set: { read_at: new Date() } });
  else await t.notifications.updateMany({ user_id: actor.id, read_at: null }, { $set: { read_at: new Date() } });
}

export async function deleteNotification(actor: Actor, id: string): Promise<void> {
  await tenant(actor).notifications.deleteOne({ _id: id, user_id: actor.id });
}

/** Notification types relevant to each role. */
export function notificationTypesFor(role: Actor["role"]): NotificationType[] {
  switch (role) {
    case "student":
      return ["connection_request", "connection_accepted", "group_invite", "academic_event", "grade_update", "support_session", "announcement", "account"];
    case "counselor":
      return ["counselor_alert", "support_session", "announcement", "account"];
    case "parent":
      return ["grade_update", "academic_event", "announcement", "account"];
    default:
      return ["academic_event", "announcement", "counselor_alert", "account"];
  }
}

export async function getNotificationPrefs(actor: Actor) {
  const rows = await tenant(actor).notificationPrefs.find({ user_id: actor.id });
  const byType = new Map(rows.map((r) => [String(r.type), r]));
  return notificationTypesFor(actor.role).map((type) => ({
    type,
    label: NOTIFICATION_TYPE_LABELS[type],
    inApp: byType.get(type)?.in_app ?? true,
    email: byType.get(type)?.email ?? false,
    locked: type === "account" || type === "counselor_alert" || type === "support_session",
  }));
}

export async function saveNotificationPrefs(actor: Actor, prefs: Array<{ type: string; inApp: boolean; email: boolean }>): Promise<void> {
  const allowed = new Set<string>(notificationTypesFor(actor.role));
  const t = tenant(actor);
  for (const p of prefs) {
    if (!allowed.has(p.type)) continue;
    await t.notificationPrefs.updateOne(
      { user_id: actor.id, type: p.type },
      { $set: { in_app: p.inApp, email: p.email }, $setOnInsert: { _id: crypto.randomUUID(), created_at: new Date() } },
      { upsert: true },
    );
  }
}

export async function setLocale(actor: Actor, locale: "en" | "ro"): Promise<void> {
  await tenant(actor).profiles.updateOne({ _id: actor.id }, { $set: { locale } });
}

export async function changePassword(actor: Actor, current: string, next: string): Promise<void> {
  const problem = passwordProblem(next);
  if (problem) throw new UserFacingError(problem);
  const users = await col(C.users);
  const row = await users.findOne({ _id: actor.id as never });
  if (!row || !(await verifyPassword(current, row.password_hash))) throw new UserFacingError("Your current password is incorrect.");
  await users.updateOne({ _id: actor.id as never }, { $set: { password_hash: await hashPassword(next) } });
  await audit({ schoolId: actor.schoolId, actorId: actor.id, action: "account.password_changed", resourceType: "user", resourceId: actor.id });
}

export async function hasUsablePassword(actor: Actor): Promise<boolean> {
  const row = await (await col(C.users)).findOne({ _id: actor.id as never }, { projection: { password_hash: 1 } });
  return Boolean(row?.password_hash?.startsWith("scrypt$"));
}

const strip = <T extends Record<string, unknown>>(rows: T[], drop: string[] = []) =>
  rows.map((r) => Object.fromEntries(Object.entries(r).filter(([k]) => k !== "_id" && k !== "school_id" && !drop.includes(k))));

/** Everything the platform stores about the requesting user — only their own records. */
export async function exportMyData(actor: Actor): Promise<Record<string, unknown>> {
  const t = tenant(actor);
  const user = await (await col(C.users)).findOne({ _id: actor.id as never }, { projection: { email: 1, created_at: 1, last_login_at: 1 } });
  const me = { user_id: actor.id };
  const data: Record<string, unknown> = {
    exported_at: new Date().toISOString(),
    notice: "Export of the personal data EduConnect AI holds about you. Keep it somewhere safe.",
    account: user ? { email: user.email, created_at: user.created_at, last_login_at: user.last_login_at } : null,
    profile: strip([(await t.profiles.findOne({ _id: actor.id })) ?? {}])[0],
    consent_records: strip(await t.consents.find({ subject_id: actor.id }, { sort: { recorded_at: 1 } }), ["given_by"]),
    notifications: strip(await t.notifications.find(me, { sort: { created_at: 1 } }), ["user_id"]),
    notification_preferences: strip(await t.notificationPrefs.find(me), ["user_id"]),
  };
  if (actor.role === "student") {
    const subjects = new Map((await t.subjects.find({})).map((s) => [String(s._id), String(s.name)]));
    const interests = new Map((await t.interests()).map((i) => [Number(i._id), String(i.label)]));
    const sp = await t.studentProfiles.findOne({ _id: actor.id });
    const conns = await t.connections.find({ $or: [{ requester_id: actor.id }, { addressee_id: actor.id }] });
    const others = new Map((await t.profiles.find({ _id: { $in: conns.map((c) => (c.requester_id === actor.id ? c.addressee_id : c.requester_id)) } })).map((p) => [String(p._id), String(p.display_name)]));
    const checkins = await t.checkins.find({ student_id: actor.id }, { sort: { date: 1 } });
    Object.assign(data, {
      student_profile: sp ? { ...strip([sp], ["interest_ids"])[0], interests: (sp.interest_ids ?? []).map((i: number) => interests.get(Number(i))) } : null,
      grades: (await t.grades.find({ student_id: actor.id }, { sort: { graded_on: 1 } })).map((g) => ({ subject: subjects.get(String(g.subject_id)), score: g.score, weight: g.weight, kind: g.kind, graded_on: g.graded_on, comment: g.comment })),
      attendance: (await t.attendance.find({ student_id: actor.id }, { sort: { date: 1 } })).map((a) => ({ subject: subjects.get(String(a.subject_id)), date: a.date, status: a.status })),
      learning_goals: strip(await t.goals.find({ student_id: actor.id }), ["student_id", "subject_id"]),
      connections: conns.map((c) => ({ status: c.status, created_at: c.created_at, other: others.get(String(c.requester_id === actor.id ? c.addressee_id : c.requester_id)) })),
      study_groups: (await t.groupMembers.find(me)).map((m) => ({ status: m.status, joined_at: m.joined_at })),
      wellbeing_checkins: checkins.map((c) => ({ date: c.date, mood: c.mood, experience: c.experience, factors: c.factors, note: decryptField(c.note_enc), note_shared: c.note_shared })),
      support_requests: (await t.alerts.find({ student_id: actor.id, source: "self_referral" })).map((a) => ({ created_at: a.created_at, status: a.status, message: decryptField(a.message_enc) })),
      support_sessions: (await t.supportSessions.find({ student_id: actor.id })).map((s) => ({ proposed_at: s.proposed_at, status: s.status, location: s.location })),
      blocks: (await t.blocks.find({ blocker_id: actor.id })).map((b) => ({ created_at: b.created_at })),
      reports_submitted: (await t.reports.find({ reporter_id: actor.id })).map((r) => ({ reason: r.reason, status: r.status, created_at: r.created_at })),
    });
  }
  await audit({ schoolId: actor.schoolId, actorId: actor.id, action: "account.data_exported", resourceType: "user", resourceId: actor.id });
  return data;
}

/** Permanently delete the student's own check-ins and notes. Alerts already raised remain with the counselor. */
export async function deleteMyWellbeingHistory(actor: Actor): Promise<number> {
  if (actor.role !== "student") throw new UserFacingError("Only students have wellbeing check-ins.");
  const n = await tenant(actor).checkins.deleteMany({ student_id: actor.id });
  await audit({ schoolId: actor.schoolId, actorId: actor.id, action: "wellbeing.history_deleted", resourceType: "user", resourceId: actor.id, metadata: { count: n } });
  return n;
}

/**
 * Request account deletion. The account is disabled straight away (all
 * sessions end); a school administrator completes the deletion, because the
 * school may have a legal duty to keep some academic records.
 */
export async function requestAccountDeletion(actor: Actor): Promise<void> {
  await (await col(C.users)).updateOne({ _id: actor.id as never }, { $set: { status: "deletion_requested" } });
  await (await col(C.sessions)).deleteMany({ user_id: actor.id });
  const t = tenant(actor);
  await t.studentProfiles.updateOne({ _id: actor.id }, { $set: { discoverable: false } });
  await audit({ schoolId: actor.schoolId, actorId: actor.id, action: "account.deletion_requested", resourceType: "user", resourceId: actor.id });
  const admins = await t.profiles.find({ role: "admin" }, { projection: { _id: 1 } });
  await notify(actor.schoolId, admins.map((a) => String(a._id)), { type: "account", title: "Account deletion requested", body: "A user asked for their account to be deleted. Review it in Users & roles.", link: "/admin/users" });
}

export async function signOutEverywhere(actor: Actor): Promise<void> {
  await (await col(C.sessions)).deleteMany({ user_id: actor.id });
}
