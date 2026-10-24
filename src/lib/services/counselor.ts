// School counselor portal: alert review & follow-up, support conversations,
// aggregate reports, alert-rule configuration, support resources and
// bullying / harassment reports.
//
// MongoDB has no row-level security, so every former RLS policy is enforced
// here, explicitly (see docs/ARCHITECTURE.md):
//   1. every function checks role ("counselor") and the specific staff permission
//      (wellbeing.alerts / wellbeing.rules / wellbeing.aggregate / safeguarding.reports);
//   2. every query goes through `tenant(actor)`, so it can only ever touch the
//      actor's own school;
//   3. individual check-in scores are read only while `hasAlertFor()` holds, and
//      check-in notes only when the student shared them (`note_shared`);
//   4. follow-ups are append-only — this module never updates or deletes them;
//   5. platform support resources (school_id null) are read-only: writes go
//      through the tenant wrapper, which can never match them.
// Free text (follow-up notes, resolutions, shared notes, student messages) is
// encrypted at rest with field-crypto. Audit metadata holds identifiers and
// counts only — never notes or scores.

import { z } from "zod";
import type { Document } from "mongodb";
import { tenant, type Tenant } from "@/lib/db/tenant";
import { decryptField, encryptField } from "@/lib/db/field-crypto";
import { hasAlertFor, hasPerm } from "@/lib/authz";
import { addDays, todayIn } from "@/lib/dates";
import { UserFacingError } from "@/lib/action-state";
import { ALERT_STATUS_LABELS } from "@/lib/constants";
import type { Actor } from "./actor";
import { assertPermission, assertRole } from "./actor";
import { audit } from "./audit";
import { notify } from "./notify";
import { runAlertEngine } from "./alert-engine";
import { classSummary, schoolSummary } from "./wellbeing-aggregates";
import { platformSupportResources } from "./wellbeing";

export const PERMS = {
  alerts: "wellbeing.alerts",
  rules: "wellbeing.rules",
  aggregate: "wellbeing.aggregate",
  reports: "safeguarding.reports",
} as const;

function authorize(actor: Actor, permission: string): void {
  assertRole(actor, "counselor");
  assertPermission(actor, permission);
}

const iso = (d: Date | string | null | undefined): string | null => (d ? new Date(d).toISOString() : null);
const str = (v: unknown): string | null => (v === null || v === undefined ? null : String(v));

export type Severity = "info" | "attention" | "urgent";
export type AlertStatus = "open" | "acknowledged" | "in_progress" | "resolved";
export type FollowupAction = "note" | "conversation_offered" | "conversation_held" | "referred" | "monitoring" | "status_change";

export const FOLLOWUP_ACTION_LABELS: Record<FollowupAction, string> = {
  note: "Note",
  conversation_offered: "Conversation offered",
  conversation_held: "Conversation held",
  referred: "Referred (per school policy)",
  monitoring: "Monitoring",
  status_change: "Status update",
};

/** Follow-up types a counselor can add by hand (status changes are recorded automatically). */
export const MANUAL_FOLLOWUP_ACTIONS = ["note", "conversation_offered", "conversation_held", "referred", "monitoring"] as const;

export const SESSION_STATUS_LABELS: Record<string, string> = {
  proposed: "Invitation sent",
  accepted: "Accepted",
  declined: "Declined",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const REPORT_REASON_LABELS: Record<string, string> = {
  harassment: "Harassment",
  bullying: "Bullying",
  inappropriate: "Inappropriate content",
  spam: "Spam",
  other: "Other",
};

export const REPORT_STATUS_LABELS: Record<string, string> = { open: "Open", reviewing: "Under review", closed: "Closed" };

export const RESOURCE_CATEGORY_LABELS: Record<string, string> = {
  emergency: "Emergency",
  helpline: "Helpline",
  school: "School support",
  selfcare: "Self-care",
};

const SEVERITY_RANK: Record<string, number> = { urgent: 3, attention: 2, info: 1 };
const sevRank = (s: unknown) => SEVERITY_RANK[String(s)] ?? 1;
const time = (d: unknown) => (d ? new Date(d as string | Date).getTime() : 0);

// ───────────────────────────── Lookup helpers (tenant-scoped) ─────────────────────────────

type ProfileInfo = { name: string; color: string; role: string };

/** Display names / colours for users of the actor's school. Unknown ids are simply absent. */
async function profilesById(t: Tenant, ids: Array<string | null | undefined>): Promise<Map<string, ProfileInfo>> {
  const unique = [...new Set(ids.filter((x): x is string => Boolean(x)))];
  if (unique.length === 0) return new Map();
  const rows = await t.profiles.find({ _id: { $in: unique } }, { projection: { display_name: 1, avatar_color: 1, role: 1 } });
  return new Map(rows.map((p) => [String(p._id), { name: String(p.display_name), color: String(p.avatar_color ?? "slate"), role: String(p.role) }]));
}

/** "9A, 10B" per student (sorted class names), or absent when not enrolled. */
async function classNamesByStudent(t: Tenant, studentIds: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(studentIds)];
  if (unique.length === 0) return new Map();
  const enrollments = await t.enrollments.find({ student_id: { $in: unique } }, { projection: { student_id: 1, class_id: 1 } });
  const classIds = [...new Set(enrollments.map((e) => String(e.class_id)))];
  const classes = classIds.length ? await t.classes.find({ _id: { $in: classIds } }, { projection: { name: 1 } }) : [];
  const className = new Map(classes.map((c) => [String(c._id), String(c.name)]));
  const byStudent = new Map<string, string[]>();
  for (const e of enrollments) {
    const name = className.get(String(e.class_id));
    if (!name) continue;
    const list = byStudent.get(String(e.student_id)) ?? [];
    list.push(name);
    byStudent.set(String(e.student_id), list);
  }
  return new Map([...byStudent.entries()].map(([id, names]) => [id, names.sort((a, b) => a.localeCompare(b)).join(", ")]));
}

// ───────────────────────────── Alert queue ─────────────────────────────

export interface AlertListItem {
  id: string;
  studentId: string;
  studentName: string;
  studentColor: string;
  className: string | null;
  source: "rule" | "self_referral";
  ruleId: string | null;
  ruleName: string | null;
  severity: Severity;
  status: AlertStatus;
  windowStart: string | null;
  windowEnd: string | null;
  createdAt: string;
  updatedAt: string;
  assignedToName: string | null;
  assignedToMe: boolean;
}

const sourceFilter = z.union([z.enum(["all", "rule", "self_referral"]), z.uuid()]);

export const alertFilterSchema = z.object({
  status: z.enum(["active", "open", "acknowledged", "in_progress", "resolved", "all"]).catch("active"),
  severity: z.enum(["all", "info", "attention", "urgent"]).catch("all"),
  source: sourceFilter.catch("all"),
  assigned: z.enum(["all", "me", "unassigned"]).catch("all"),
});
export type AlertFilters = z.infer<typeof alertFilterSchema>;

/** Resolve names for a batch of alert documents (all from the actor's school). */
async function toListItems(t: Tenant, actor: Actor, alerts: Document[]): Promise<AlertListItem[]> {
  if (alerts.length === 0) return [];
  const studentIds = alerts.map((a) => String(a.student_id));
  const ruleIds = [...new Set(alerts.map((a) => a.rule_id).filter(Boolean).map(String))];
  const [people, classes, rules] = await Promise.all([
    profilesById(t, [...studentIds, ...alerts.map((a) => str(a.assigned_to))]),
    classNamesByStudent(t, studentIds),
    ruleIds.length ? t.alertRules.find({ _id: { $in: ruleIds } }, { projection: { name: 1 } }) : Promise.resolve([]),
  ]);
  const ruleName = new Map(rules.map((r) => [String(r._id), String(r.name)]));
  const items: AlertListItem[] = [];
  for (const a of alerts) {
    const student = people.get(String(a.student_id));
    // Inner-join semantics: an alert whose student profile no longer exists is not listed.
    if (!student) continue;
    const ruleId = str(a.rule_id);
    const assignedTo = str(a.assigned_to);
    items.push({
      id: String(a._id),
      studentId: String(a.student_id),
      studentName: student.name,
      studentColor: student.color,
      className: classes.get(String(a.student_id)) ?? null,
      source: a.source === "self_referral" ? "self_referral" : "rule",
      ruleId,
      ruleName: ruleId ? ruleName.get(ruleId) ?? null : null,
      severity: a.severity as Severity,
      status: a.status as AlertStatus,
      windowStart: str(a.window_start),
      windowEnd: str(a.window_end),
      createdAt: iso(a.created_at)!,
      updatedAt: iso(a.updated_at ?? a.created_at)!,
      assignedToName: assignedTo ? people.get(assignedTo)?.name ?? null : null,
      assignedToMe: assignedTo === actor.id,
    });
  }
  return items;
}

/** Queue order: unresolved first, then highest severity, then newest. */
const queueOrder = (a: Document, b: Document) =>
  Number(a.status === "resolved") - Number(b.status === "resolved") || sevRank(b.severity) - sevRank(a.severity) || time(b.created_at) - time(a.created_at);

export async function listAlerts(actor: Actor, filters: Partial<AlertFilters> = {}): Promise<AlertListItem[]> {
  authorize(actor, PERMS.alerts);
  const f = alertFilterSchema.parse(filters);
  const t = tenant(actor);
  // Only validated enum / uuid values reach the filter.
  const filter: Document = {};
  if (f.status === "active") filter.status = { $ne: "resolved" };
  else if (f.status !== "all") filter.status = f.status;
  if (f.severity !== "all") filter.severity = f.severity;
  if (f.source === "rule" || f.source === "self_referral") filter.source = f.source;
  else if (f.source !== "all") filter.rule_id = f.source;
  if (f.assigned === "me") filter.assigned_to = actor.id;
  if (f.assigned === "unassigned") filter.assigned_to = null;

  const alerts = (await t.alerts.find(filter, { projection: { message_enc: 0, resolution_enc: 0, resolution: 0 } })).sort(queueOrder).slice(0, 200);
  return toListItems(t, actor, alerts);
}

/** Rule names for the queue's source filter. */
export async function listRuleOptions(actor: Actor): Promise<Array<{ id: string; name: string }>> {
  authorize(actor, PERMS.alerts);
  const rows = await tenant(actor).alertRules.find({}, { projection: { name: 1 }, sort: { name: 1 } });
  return rows.map((r) => ({ id: String(r._id), name: String(r.name) }));
}

// ───────────────────────────── Dashboard ─────────────────────────────

export interface Summary {
  students_total: number;
  students_reporting: number;
  suppressed: boolean;
  k: number;
  checkins?: number;
  average?: number | null;
  distribution?: { low: number; mid: number; high: number };
  weekly?: Array<{ week_start: string; average: number | null; students: number }>;
  factors?: Array<{ factor: string; students: number }>;
}

export interface ActivityItem {
  id: string;
  kind: "alert_created" | FollowupAction;
  at: string;
  alertId: string;
  studentName: string;
  authorName: string | null;
  severity: Severity;
}

export interface SessionItem {
  id: string;
  studentId: string;
  studentName: string;
  studentColor: string;
  counselorName: string | null;
  alertId: string | null;
  proposedAt: string;
  location: string | null;
  status: string;
  studentMessage: string | null;
  mine: boolean;
  /** The proposed time is in the past. */
  isPast: boolean;
}

async function toSessions(t: Tenant, actor: Actor, sessions: Document[]): Promise<SessionItem[]> {
  if (sessions.length === 0) return [];
  const people = await profilesById(t, sessions.flatMap((s) => [str(s.student_id), str(s.counselor_id)]));
  const now = Date.now();
  const items: SessionItem[] = [];
  for (const s of sessions) {
    const student = people.get(String(s.student_id));
    if (!student) continue;
    const counselorId = str(s.counselor_id);
    items.push({
      id: String(s._id),
      studentId: String(s.student_id),
      studentName: student.name,
      studentColor: student.color,
      counselorName: counselorId ? people.get(counselorId)?.name ?? null : null,
      alertId: str(s.alert_id),
      proposedAt: iso(s.proposed_at)!,
      location: str(s.location),
      status: String(s.status),
      studentMessage: decryptField(s.student_message_enc ?? null),
      mine: counselorId === actor.id,
      isPast: time(s.proposed_at) < now,
    });
  }
  return items;
}

export async function getDashboard(actor: Actor) {
  authorize(actor, PERMS.alerts);
  const today = todayIn(actor.timezone);
  const canAggregate = actor.permissions.includes(PERMS.aggregate);
  const t = tenant(actor);
  const now = Date.now();

  const active = await t.alerts.find({ status: { $ne: "resolved" } }, { projection: { message_enc: 0, resolution_enc: 0, resolution: 0 } });
  const bySeverity: Record<Severity, number> = { urgent: 0, attention: 0, info: 0 };
  const byStatus: Record<string, number> = { open: 0, acknowledged: 0, in_progress: 0 };
  for (const a of active) {
    bySeverity[a.severity as Severity] = (bySeverity[a.severity as Severity] ?? 0) + 1;
    byStatus[String(a.status)] = (byStatus[String(a.status)] ?? 0) + 1;
  }
  const assignedToMe = active.filter((a) => a.assigned_to === actor.id).length;
  const resolvedLast30 = await t.alerts.count({ status: "resolved", resolved_at: { $gt: new Date(now - 30 * 86400_000) } });

  const pending = await toListItems(t, actor, [...active].sort(queueOrder).slice(0, 6));

  // Activity shows *what* happened, never the content of notes.
  const [recentAlerts, recentFollowups] = await Promise.all([
    t.alerts.find({}, { projection: { student_id: 1, severity: 1, created_at: 1 }, sort: { created_at: -1 }, limit: 8 }),
    t.followups.find({}, { projection: { alert_id: 1, author_id: 1, action: 1, created_at: 1 }, sort: { created_at: -1 }, limit: 8 }),
  ]);
  const followupAlertIds = [...new Set(recentFollowups.map((f) => String(f.alert_id)))];
  const followupAlerts = followupAlertIds.length
    ? await t.alerts.find({ _id: { $in: followupAlertIds } }, { projection: { student_id: 1, severity: 1 } })
    : [];
  const alertById = new Map([...recentAlerts, ...followupAlerts].map((a) => [String(a._id), a]));
  const people = await profilesById(t, [
    ...[...alertById.values()].map((a) => str(a.student_id)),
    ...recentFollowups.map((f) => str(f.author_id)),
  ]);
  const activity: ActivityItem[] = [];
  for (const a of recentAlerts) {
    const student = people.get(String(a.student_id));
    if (!student) continue;
    activity.push({ id: String(a._id), kind: "alert_created", at: iso(a.created_at)!, alertId: String(a._id), studentName: student.name, authorName: null, severity: a.severity as Severity });
  }
  for (const f of recentFollowups) {
    const a = alertById.get(String(f.alert_id));
    const student = a ? people.get(String(a.student_id)) : undefined;
    if (!a || !student) continue;
    const authorId = str(f.author_id);
    activity.push({
      id: String(f._id), kind: f.action as FollowupAction, at: iso(f.created_at)!, alertId: String(f.alert_id),
      studentName: student.name, authorName: authorId ? people.get(authorId)?.name ?? null : null, severity: a.severity as Severity,
    });
  }
  activity.sort((x, y) => time(y.at) - time(x.at));

  const upcoming = await toSessions(
    t,
    actor,
    await t.supportSessions.find(
      { status: { $in: ["proposed", "accepted"] }, proposed_at: { $gt: new Date(now - 86400_000) } },
      { sort: { proposed_at: 1 }, limit: 5 },
    ),
  );

  let trend: Summary | null = null;
  if (canAggregate) trend = await schoolSummary(actor, addDays(today, -55), today);

  return {
    today,
    bySeverity,
    byStatus,
    assignedToMe,
    resolvedLast30,
    pending,
    activity: activity.slice(0, 8),
    upcoming,
    trend,
    canAggregate,
  };
}

// ───────────────────────────── Alert detail ─────────────────────────────

export interface AlertDetail {
  alert: AlertListItem & {
    summary: string;
    observed: { average?: number; checkins?: number; lowest?: number; windowDays?: number; threshold?: number };
    acknowledgedByName: string | null;
    acknowledgedAt: string | null;
    resolvedAt: string | null;
    resolution: string | null;
  };
  rule: { id: string; name: string; kind: string; windowDays: number; threshold: number; consecutiveCount: number | null; minCheckins: number; enabled: boolean } | null;
  /** Date range used for the observed-data panel. */
  range: { from: string; to: string; basis: "alert_window" | "before_request" };
  /** False once the alert has been resolved for more than 90 days (individual scores are then hidden). */
  dataAccessible: boolean;
  checkins: Array<{ date: string; mood: number }>;
  sharedNotes: Array<{ date: string; note: string }>;
  followups: Array<{ id: string; action: FollowupAction; note: string | null; authorName: string | null; createdAt: string }>;
  sessions: SessionItem[];
  otherAlerts: Array<{ id: string; status: AlertStatus; severity: Severity; createdAt: string; source: "rule" | "self_referral" }>;
}

/**
 * Individual check-in data for one student — only for staff with
 * `wellbeing.alerts` (checked by the caller) and only while the student has a
 * recent alert. Only date + score are returned (minimum necessary — no factors
 * or experience); notes only when the student chose to share them.
 */
async function individualCheckinData(t: Tenant, studentId: string, from: string, to: string) {
  if (!(await hasAlertFor(t, studentId))) return { accessible: false, checkins: [], sharedNotes: [] };
  const rows = await t.checkins.find(
    { student_id: studentId, date: { $gte: from, $lte: to } },
    { projection: { date: 1, mood: 1, note_enc: 1, note_shared: 1 }, sort: { date: 1 } },
  );
  const checkins = rows.map((r) => ({ date: String(r.date), mood: Number(r.mood) }));
  const sharedNotes: Array<{ date: string; note: string }> = [];
  for (const r of rows) {
    if (r.note_shared !== true || !r.note_enc) continue;
    const note = decryptField(r.note_enc as string);
    if (note) sharedNotes.push({ date: String(r.date), note });
  }
  return { accessible: true, checkins, sharedNotes };
}

/**
 * Everything a counselor needs to review one alert. Each call writes a
 * `wellbeing.alert.viewed` audit event (IDs only).
 */
export async function getAlertDetail(actor: Actor, alertId: string): Promise<AlertDetail | null> {
  authorize(actor, PERMS.alerts);
  if (!z.uuid().safeParse(alertId).success) return null;
  const t = tenant(actor);
  const a = await t.alerts.findOne({ _id: alertId });
  if (!a) return null;
  const [item] = await toListItems(t, actor, [a]);
  if (!item) return null;
  const studentId = String(a.student_id);

  const createdOn = todayIn(actor.timezone, new Date(a.created_at));
  const range: AlertDetail["range"] =
    a.window_start && a.window_end
      ? { from: String(a.window_start), to: String(a.window_end), basis: "alert_window" }
      : { from: addDays(createdOn, -13), to: createdOn, basis: "before_request" };

  const [data, followups, sessions, others, rule, ackPeople] = await Promise.all([
    individualCheckinData(t, studentId, range.from, range.to),
    t.followups.find({ alert_id: alertId }, { sort: { created_at: 1 } }),
    t.supportSessions.find({ alert_id: alertId }, { sort: { proposed_at: -1 } }),
    t.alerts.find(
      { student_id: studentId, _id: { $ne: alertId } },
      { projection: { status: 1, severity: 1, created_at: 1, source: 1 }, sort: { created_at: -1 }, limit: 10 },
    ),
    a.rule_id ? t.alertRules.findOne({ _id: String(a.rule_id) }) : Promise.resolve(null),
    profilesById(t, [str(a.acknowledged_by)]),
  ]);
  const authors = await profilesById(t, followups.map((f) => str(f.author_id)));

  await audit({
    schoolId: actor.schoolId,
    actorId: actor.id,
    action: "wellbeing.alert.viewed",
    resourceType: "wellbeing_alert",
    resourceId: alertId,
    metadata: { student_id: studentId },
  });

  // Self-referral messages are stored encrypted; show them to the reviewing counselor.
  const message = decryptField(a.message_enc ?? null);
  const summary = message ? `Student asked to talk: "${message.slice(0, 300)}"` : String(a.summary ?? "");

  return {
    alert: {
      ...item,
      summary,
      observed: (a.observed as AlertDetail["alert"]["observed"] | null) ?? {},
      acknowledgedByName: a.acknowledged_by ? ackPeople.get(String(a.acknowledged_by))?.name ?? null : null,
      acknowledgedAt: iso(a.acknowledged_at),
      resolvedAt: iso(a.resolved_at),
      resolution: decryptField(a.resolution_enc ?? a.resolution ?? null),
    },
    rule: rule
      ? {
          id: String(rule._id), name: String(rule.name), kind: String(rule.kind), windowDays: Number(rule.window_days), threshold: Number(rule.threshold),
          consecutiveCount: rule.consecutive_count ?? null, minCheckins: Number(rule.min_checkins), enabled: Boolean(rule.enabled),
        }
      : null,
    range,
    dataAccessible: data.accessible,
    checkins: data.checkins,
    sharedNotes: data.sharedNotes,
    followups: followups.map((f) => {
      const authorId = str(f.author_id);
      return {
        id: String(f._id),
        action: f.action as FollowupAction,
        // Counselor notes are encrypted; automatic (rule-engine) entries carry a plain system_note.
        note: decryptField(f.note_enc ?? null) ?? str(f.system_note),
        authorName: authorId ? authors.get(authorId)?.name ?? null : null,
        createdAt: iso(f.created_at)!,
      };
    }),
    sessions: await toSessions(t, actor, sessions),
    otherAlerts: others.map((o) => ({
      id: String(o._id), status: o.status as AlertStatus, severity: o.severity as Severity, createdAt: iso(o.created_at)!,
      source: o.source === "self_referral" ? "self_referral" : "rule",
    })),
  };
}

// ───────────────────────────── Alert workflow ─────────────────────────────

async function loadAlert(t: Tenant, alertId: string) {
  const row = await t.alerts.findOne({ _id: alertId }, { projection: { student_id: 1, status: 1, assigned_to: 1, acknowledged_by: 1, acknowledged_at: 1 } });
  if (!row) throw new UserFacingError("This alert could not be found.");
  return {
    id: String(row._id),
    student_id: String(row.student_id),
    status: row.status as AlertStatus,
    assigned_to: str(row.assigned_to),
    acknowledged_by: str(row.acknowledged_by),
    acknowledged_at: (row.acknowledged_at as Date | null) ?? null,
  };
}

/** Follow-ups are append-only: this is the only way they are written (never updated or deleted). */
async function appendFollowup(t: Tenant, actor: Actor, alertId: string, action: FollowupAction, note: string | null) {
  await t.followups.insertOne({ alert_id: alertId, author_id: actor.id, action, note_enc: encryptField(note), system_note: null });
}

/** Update an alert only if it is still in the state we validated against. */
async function updateAlertFrom(t: Tenant, alertId: string, fromStatus: AlertStatus, set: Document) {
  const r = await t.alerts.updateOne({ _id: alertId, status: fromStatus }, { $set: { ...set, updated_at: new Date() } });
  if (r.matched === 0) throw new UserFacingError("This alert was updated by someone else. Reload the page and try again.");
}

const touchAlert = (t: Tenant, alertId: string) => t.alerts.updateOne({ _id: alertId }, { $set: { updated_at: new Date() } });

export const alertIdSchema = z.uuid("Unknown alert.");

/** Acknowledge (open → acknowledged) or mark support in progress (open/acknowledged → in_progress). */
export async function setAlertStatus(actor: Actor, alertId: string, to: "acknowledged" | "in_progress"): Promise<void> {
  authorize(actor, PERMS.alerts);
  alertIdSchema.parse(alertId);
  z.enum(["acknowledged", "in_progress"]).parse(to);
  const t = tenant(actor);
  const a = await loadAlert(t, alertId);
  if (a.status === "resolved") throw new UserFacingError("This alert is already resolved.");
  if (a.status === to) throw new UserFacingError(`This alert is already marked "${ALERT_STATUS_LABELS[to]}".`);
  if (to === "acknowledged" && a.status !== "open") throw new UserFacingError("Only open alerts can be acknowledged.");
  await updateAlertFrom(t, alertId, a.status, {
    status: to,
    acknowledged_by: a.acknowledged_by ?? actor.id,
    acknowledged_at: a.acknowledged_at ?? new Date(),
  });
  await appendFollowup(t, actor, alertId, "status_change", `Status changed to "${ALERT_STATUS_LABELS[to]}".`);
  await audit({
    schoolId: actor.schoolId, actorId: actor.id,
    action: to === "acknowledged" ? "wellbeing.alert.acknowledged" : "wellbeing.alert.in_progress",
    resourceType: "wellbeing_alert", resourceId: alertId, metadata: { from: a.status, to },
  });
}

export async function assignAlertToMe(actor: Actor, alertId: string): Promise<void> {
  authorize(actor, PERMS.alerts);
  alertIdSchema.parse(alertId);
  const t = tenant(actor);
  const a = await loadAlert(t, alertId);
  if (a.status === "resolved") throw new UserFacingError("This alert is already resolved.");
  if (a.assigned_to === actor.id) throw new UserFacingError("This alert is already assigned to you.");
  const me = await t.profiles.findOne({ _id: actor.id }, { projection: { display_name: 1 } });
  await updateAlertFrom(t, alertId, a.status, { assigned_to: actor.id });
  await appendFollowup(t, actor, alertId, "status_change", `Assigned to ${me?.display_name ?? "a counselor"}.`);
  await audit({
    schoolId: actor.schoolId, actorId: actor.id, action: "wellbeing.alert.assigned",
    resourceType: "wellbeing_alert", resourceId: alertId, metadata: { assigned_to: actor.id, previous: a.assigned_to },
  });
}

export const resolveSchema = z.object({
  alertId: alertIdSchema,
  resolution: z.string().trim().min(3, "Add a short resolution note.").max(2000, "Keep the note under 2000 characters."),
});

export async function resolveAlert(actor: Actor, input: z.infer<typeof resolveSchema>): Promise<void> {
  authorize(actor, PERMS.alerts);
  const { alertId, resolution } = resolveSchema.parse(input);
  const t = tenant(actor);
  const a = await loadAlert(t, alertId);
  if (a.status === "resolved") throw new UserFacingError("This alert is already resolved.");
  await updateAlertFrom(t, alertId, a.status, {
    status: "resolved",
    resolved_at: new Date(),
    resolution_enc: encryptField(resolution),
    acknowledged_by: a.acknowledged_by ?? actor.id,
    acknowledged_at: a.acknowledged_at ?? new Date(),
  });
  await appendFollowup(t, actor, alertId, "status_change", `Resolved: ${resolution}`);
  await audit({
    schoolId: actor.schoolId, actorId: actor.id, action: "wellbeing.alert.resolved",
    resourceType: "wellbeing_alert", resourceId: alertId, metadata: { from: a.status },
  });
}

export const followupSchema = z
  .object({
    alertId: alertIdSchema,
    action: z.enum(MANUAL_FOLLOWUP_ACTIONS, "Choose the type of follow-up."),
    note: z.string().trim().max(4000, "Keep the note under 4000 characters.").nullish().transform((v) => v || null),
  })
  .refine((v) => v.action !== "note" || v.note, { message: "Write the note.", path: ["note"] });

/** Append a follow-up. Follow-ups are append-only (this module never updates or deletes them). */
export async function addFollowup(actor: Actor, input: z.input<typeof followupSchema>): Promise<void> {
  authorize(actor, PERMS.alerts);
  const { alertId, action, note } = followupSchema.parse(input);
  const t = tenant(actor);
  await loadAlert(t, alertId);
  await appendFollowup(t, actor, alertId, action, note);
  await touchAlert(t, alertId);
  await audit({
    schoolId: actor.schoolId, actorId: actor.id, action: "wellbeing.followup.added",
    resourceType: "wellbeing_alert", resourceId: alertId, metadata: { action, has_note: Boolean(note) },
  });
}

export const offerSessionSchema = z.object({
  alertId: alertIdSchema,
  proposedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Choose a date and time."),
  location: z.string().trim().min(2, "Say where you'll meet (e.g. the counselor's office).").max(120),
});

/** Offset (ms) of `timeZone` from UTC at the given instant. */
function tzOffsetMs(utcMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

/** "YYYY-MM-DDTHH:mm" wall-clock time in `timeZone` → instant (like `timestamp at time zone`). */
function zonedLocalToUtc(local: string, timeZone: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  const check = new Date(guess);
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d || h > 23 || mi > 59) return null;
  let ts = guess - tzOffsetMs(guess, timeZone);
  ts = guess - tzOffsetMs(ts, timeZone);
  return new Date(ts);
}

/**
 * Offer a support conversation linked to an alert. The student receives a
 * neutral notification and can accept, decline or reply — it is always their choice.
 */
export async function offerSupportSession(actor: Actor, input: z.infer<typeof offerSessionSchema>): Promise<{ sessionId: string }> {
  authorize(actor, PERMS.alerts);
  const { alertId, proposedAt, location } = offerSessionSchema.parse(input);
  const t = tenant(actor);
  const a = await loadAlert(t, alertId);
  if (a.status === "resolved") throw new UserFacingError("This alert is resolved. Open a new conversation from an active alert.");
  const when = zonedLocalToUtc(proposedAt, actor.timezone);
  if (!when) throw new UserFacingError("Choose a date and time.");
  const now = Date.now();
  if (when.getTime() <= now) throw new UserFacingError("Choose a time in the future.");
  if (when.getTime() > now + 60 * 86400_000) throw new UserFacingError("Choose a time within the next 60 days.");
  const pending = await t.supportSessions.findOne({ student_id: a.student_id, status: { $in: ["proposed", "accepted"] }, proposed_at: { $gt: new Date(now) } });
  if (pending) throw new UserFacingError("There is already an upcoming conversation with this student. Update it from Support conversations.");
  // The student comes from an alert of this school (tenant-scoped), so they are in the actor's school.
  const sessionId = await t.supportSessions.insertOne({
    student_id: a.student_id, counselor_id: actor.id, alert_id: alertId, proposed_at: when, location,
    status: "proposed", student_message_enc: null, responded_at: null, updated_at: new Date(),
  });
  await appendFollowup(t, actor, alertId, "conversation_offered", `Support conversation offered (${location}).`);
  await touchAlert(t, alertId);
  await audit({
    schoolId: actor.schoolId, actorId: actor.id, action: "wellbeing.support_session.offered",
    resourceType: "support_session", resourceId: sessionId, metadata: { alert_id: alertId, student_id: a.student_id },
  });
  // Trusted fan-out after the checks above. Wording is neutral by design.
  await notify(actor.schoolId, [a.student_id], {
    type: "support_session",
    title: "Your school counselor would like to check in",
    body: "You can accept, decline or reply with a message. It's always your choice.",
    link: "/student/wellbeing/support",
    sensitive: true,
  });
  return { sessionId };
}

// ───────────────────────────── Support conversations ─────────────────────────────

export const sessionFilterSchema = z.enum(["upcoming", "proposed", "accepted", "declined", "completed", "cancelled", "all"]).catch("upcoming");

export async function listSessions(actor: Actor, filter: string = "upcoming"): Promise<SessionItem[]> {
  authorize(actor, PERMS.alerts);
  const f = sessionFilterSchema.parse(filter);
  const t = tenant(actor);
  const where: Document = f === "upcoming" ? { status: { $in: ["proposed", "accepted"] } } : f === "all" ? {} : { status: f };
  const rows = await t.supportSessions.find(where, { sort: { proposed_at: f === "upcoming" ? 1 : -1 }, limit: 200 });
  return toSessions(t, actor, rows);
}

export const sessionUpdateSchema = z.object({
  sessionId: z.uuid("Unknown conversation."),
  status: z.enum(["completed", "cancelled"]),
});

export async function updateSessionStatus(actor: Actor, input: z.infer<typeof sessionUpdateSchema>): Promise<void> {
  authorize(actor, PERMS.alerts);
  const { sessionId, status } = sessionUpdateSchema.parse(input);
  const t = tenant(actor);
  const s = await t.supportSessions.findOne({ _id: sessionId }, { projection: { student_id: 1, status: 1, alert_id: 1 } });
  if (!s) throw new UserFacingError("This conversation could not be found.");
  const current = String(s.status);
  if (!["proposed", "accepted"].includes(current)) {
    throw new UserFacingError(`This conversation is already ${SESSION_STATUS_LABELS[current]?.toLowerCase() ?? current}.`);
  }
  if (status === "completed" && current !== "accepted") {
    throw new UserFacingError("Only accepted conversations can be marked as completed.");
  }
  const r = await t.supportSessions.updateOne({ _id: sessionId, status: current }, { $set: { status, updated_at: new Date() } });
  if (r.matched === 0) throw new UserFacingError("This conversation was updated meanwhile. Reload the page and try again.");
  const alertId = str(s.alert_id);
  if (alertId && (await t.alerts.count({ _id: alertId })) > 0) {
    await appendFollowup(
      t, actor, alertId,
      status === "completed" ? "conversation_held" : "status_change",
      status === "completed" ? "Support conversation marked as held." : "Support conversation cancelled.",
    );
  }
  await audit({
    schoolId: actor.schoolId, actorId: actor.id, action: `wellbeing.support_session.${status}`,
    resourceType: "support_session", resourceId: sessionId, metadata: { from: current, alert_id: alertId },
  });
  if (status === "cancelled") {
    await notify(actor.schoolId, [String(s.student_id)], {
      type: "support_session",
      title: "A support conversation was cancelled",
      body: "You can always ask to talk from the Get support page.",
      link: "/student/wellbeing/support",
      sensitive: true,
    });
  }
}

// ───────────────────────────── Aggregate reports ─────────────────────────────

export const REPORT_PERIODS = [7, 14, 30] as const;

export async function getAggregateReport(actor: Actor, days: number) {
  authorize(actor, PERMS.aggregate);
  const period = (REPORT_PERIODS as readonly number[]).includes(days) ? days : 14;
  const today = todayIn(actor.timezone);
  const from = addDays(today, -(period - 1));
  const t = tenant(actor);
  // Aggregates only: these never return individual rows and suppress groups under k = 5.
  const school: Summary = await schoolSummary(actor, from, today);
  const classes = await t.classes.find({}, { projection: { name: 1, grade_level: 1 }, sort: { grade_level: 1, name: 1 } });
  const perClass: Array<{ id: string; name: string; gradeLevel: number; summary: Summary }> = [];
  for (const c of classes) {
    perClass.push({ id: String(c._id), name: String(c.name), gradeLevel: Number(c.grade_level), summary: await classSummary(actor, String(c._id), from, today) });
  }
  await audit({
    schoolId: actor.schoolId, actorId: actor.id, action: "wellbeing.aggregate.viewed",
    resourceType: "wellbeing_report", metadata: { days: period, classes: classes.length },
  });
  return { period, from, to: today, school, classes: perClass };
}

// ───────────────────────────── Alert rules ─────────────────────────────

export interface RuleItem {
  id: string;
  name: string;
  kind: "window_average" | "consecutive_low";
  windowDays: number;
  threshold: number;
  consecutiveCount: number | null;
  minCheckins: number;
  severity: Severity;
  enabled: boolean;
  updatedAt: string;
  updatedByName: string | null;
  openAlerts: number;
}

export async function listRules(actor: Actor): Promise<RuleItem[]> {
  authorize(actor, PERMS.rules);
  const t = tenant(actor);
  const rows = await t.alertRules.find({});
  // Alert counts only for viewers who may see alerts; otherwise 0.
  const openByRule = new Map<string, number>();
  if (hasPerm(actor, PERMS.alerts)) {
    const counts = await t.alerts.aggregate<{ _id: string; n: number }>([
      { $match: { status: { $ne: "resolved" }, rule_id: { $ne: null } } },
      { $group: { _id: "$rule_id", n: { $sum: 1 } } },
    ]);
    for (const c of counts) openByRule.set(String(c._id), c.n);
  }
  const people = await profilesById(t, rows.map((r) => str(r.updated_by)));
  return rows
    .sort((a, b) => sevRank(b.severity) - sevRank(a.severity) || String(a.name).localeCompare(String(b.name)))
    .map((r) => ({
      id: String(r._id), name: String(r.name), kind: r.kind as RuleItem["kind"], windowDays: Number(r.window_days), threshold: Number(r.threshold),
      consecutiveCount: r.consecutive_count ?? null, minCheckins: Number(r.min_checkins), severity: r.severity as Severity, enabled: Boolean(r.enabled),
      updatedAt: iso(r.updated_at ?? r.created_at)!, updatedByName: r.updated_by ? people.get(String(r.updated_by))?.name ?? null : null,
      openAlerts: openByRule.get(String(r._id)) ?? 0,
    }));
}

const intField = (min: number, max: number, label: string) =>
  z.coerce.number({ error: `${label} must be a number.` }).int(`${label} must be a whole number.`).min(min, `${label} must be at least ${min}.`).max(max, `${label} must be at most ${max}.`);

export const ruleSchema = z
  .object({
    id: z.uuid().optional(),
    name: z.string().trim().min(2, "Give the rule a name (2–80 characters).").max(80, "Keep the name under 80 characters."),
    kind: z.enum(["window_average", "consecutive_low"], "Choose a rule type."),
    windowDays: intField(3, 60, "Window"),
    threshold: z.coerce
      .number({ error: "Threshold must be a number." })
      .min(1, "Threshold must be between 1 and 10.")
      .max(10, "Threshold must be between 1 and 10.")
      .transform((v) => Math.round(v * 10) / 10),
    consecutiveCount: z.preprocess((v) => (v === "" || v === undefined || v === null ? null : v), intField(2, 20, "Consecutive check-ins").nullable()),
    minCheckins: intField(1, 60, "Minimum check-ins"),
    severity: z.enum(["info", "attention", "urgent"], "Choose a severity."),
    enabled: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.kind === "consecutive_low") {
      if (v.consecutiveCount === null) ctx.addIssue({ code: "custom", path: ["consecutiveCount"], message: "Set how many consecutive low check-ins trigger the rule." });
      else if (v.consecutiveCount > v.windowDays) ctx.addIssue({ code: "custom", path: ["consecutiveCount"], message: "Consecutive check-ins can't exceed the window length." });
    }
    if (v.minCheckins > v.windowDays) ctx.addIssue({ code: "custom", path: ["minCheckins"], message: "Minimum check-ins can't exceed the window length." });
  })
  .transform((v) => ({ ...v, consecutiveCount: v.kind === "consecutive_low" ? v.consecutiveCount : null }));
export type RuleInput = z.output<typeof ruleSchema>;

export async function saveRule(actor: Actor, input: z.input<typeof ruleSchema>): Promise<{ id: string; created: boolean }> {
  authorize(actor, PERMS.rules);
  const r = ruleSchema.parse(input);
  const t = tenant(actor);
  const fields = {
    name: r.name, kind: r.kind, window_days: r.windowDays, threshold: r.threshold, consecutive_count: r.consecutiveCount,
    min_checkins: r.minCheckins, severity: r.severity, enabled: r.enabled, updated_by: actor.id, updated_at: new Date(),
  };
  let id: string;
  if (r.id) {
    const res = await t.alertRules.updateOne({ _id: r.id }, { $set: fields });
    if (res.matched === 0) throw new UserFacingError("This rule could not be found.");
    id = r.id;
  } else {
    id = await t.alertRules.insertOne(fields);
  }
  await audit({
    schoolId: actor.schoolId, actorId: actor.id, action: r.id ? "wellbeing.rule.updated" : "wellbeing.rule.created",
    resourceType: "alert_rule", resourceId: id,
    // Rule configuration only (no student data).
    metadata: { kind: r.kind, window_days: r.windowDays, threshold: r.threshold, consecutive_count: r.consecutiveCount, min_checkins: r.minCheckins, severity: r.severity, enabled: r.enabled },
  });
  return { id, created: !r.id };
}

export async function setRuleEnabled(actor: Actor, ruleId: string, enabled: boolean): Promise<void> {
  authorize(actor, PERMS.rules);
  z.uuid().parse(ruleId);
  z.boolean().parse(enabled);
  const res = await tenant(actor).alertRules.updateOne({ _id: ruleId }, { $set: { enabled, updated_by: actor.id, updated_at: new Date() } });
  if (res.matched === 0) throw new UserFacingError("This rule could not be found.");
  await audit({
    schoolId: actor.schoolId, actorId: actor.id, action: enabled ? "wellbeing.rule.enabled" : "wellbeing.rule.disabled",
    resourceType: "alert_rule", resourceId: ruleId,
  });
}

/** Re-run every enabled rule for every student in the counselor's school. */
export async function reevaluateAllStudents(actor: Actor): Promise<{ students: number; created: number; escalated: number }> {
  authorize(actor, PERMS.rules);
  const today = todayIn(actor.timezone);
  // Tenant-scoped, so the list can only ever contain this school's students.
  const students = await tenant(actor).profiles.find({ role: "student" }, { projection: { _id: 1 } });
  // runAlertEngine is trusted server code with privileged access: it must read
  // every student's check-ins (including students without a current alert) and
  // write alerts + notifications. It runs only after the permission check above,
  // and no individual data is returned to the caller — just counts.
  let created = 0;
  let escalated = 0;
  for (const s of students) {
    const decision = await runAlertEngine(String(s._id), today);
    if (decision.action === "create") created++;
    if (decision.action === "escalate") escalated++;
  }
  await audit({
    schoolId: actor.schoolId, actorId: actor.id, action: "wellbeing.rules.reevaluated",
    resourceType: "school", resourceId: actor.schoolId, metadata: { students: students.length, created, escalated },
  });
  return { students: students.length, created, escalated };
}

// ───────────────────────────── Support resources ─────────────────────────────

export interface ResourceItem {
  id: string;
  schoolId: string | null;
  category: string;
  name: string;
  phone: string | null;
  url: string | null;
  description: string;
  hours: string | null;
  lastVerified: string | null;
  sortOrder: number;
}

function toResource(r: Document): ResourceItem {
  return {
    id: String(r._id), schoolId: str(r.school_id), category: String(r.category), name: String(r.name), phone: str(r.phone), url: str(r.url),
    description: String(r.description ?? ""), hours: str(r.hours), lastVerified: str(r.last_verified), sortOrder: Number(r.sort_order ?? 100),
  };
}

const byOrderThenName = (a: ResourceItem, b: ResourceItem) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name);

export async function listResources(actor: Actor): Promise<{ school: ResourceItem[]; platform: ResourceItem[] }> {
  authorize(actor, PERMS.alerts);
  const [own, platform] = await Promise.all([tenant(actor).supportResources.find({}), platformSupportResources()]);
  return {
    school: own.map(toResource).sort(byOrderThenName),
    platform: platform.map(toResource).map((r) => ({ ...r, schoolId: null })).sort(byOrderThenName),
  };
}

const optionalText = (max: number, msg: string) =>
  z.string().trim().max(max, msg).nullish().transform((v) => v || null);

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date.");

export const resourceSchema = z.object({
  id: z.uuid().optional(),
  category: z.enum(["emergency", "helpline", "school", "selfcare"], "Choose a category."),
  name: z.string().trim().min(2, "Give the resource a name.").max(120, "Keep the name under 120 characters."),
  phone: optionalText(40, "Keep the phone number short.").refine((v) => v === null || /^[0-9+()./\s-]{2,40}$/.test(v), "Use digits, spaces and + ( ) - only."),
  // Only web links or in-app paths — never javascript: or other schemes.
  url: optionalText(300, "Keep the link under 300 characters.").refine(
    (v) => v === null || /^https?:\/\/[^\s]+$/i.test(v) || /^\/(?!\/)[^\s]*$/.test(v),
    "Use a full https:// link or an in-app path starting with /.",
  ),
  description: z.string().trim().min(5, "Describe the resource in a sentence.").max(500, "Keep the description under 500 characters."),
  hours: optionalText(120, "Keep the opening hours short."),
  lastVerified: z.preprocess((v) => (v === "" || v === null ? undefined : v), isoDate.optional()).transform((v) => v ?? null),
  sortOrder: z.preprocess((v) => (v === "" || v === undefined ? 100 : v), intField(0, 1000, "Order")),
});

function assertNotFuture(actor: Actor, date: string | null) {
  if (date && date > todayIn(actor.timezone)) throw new UserFacingError("The verification date can't be in the future.");
}

const READ_ONLY_RESOURCE = "This resource could not be found or is a read-only platform default.";

export async function saveResource(actor: Actor, input: z.input<typeof resourceSchema>): Promise<{ id: string }> {
  authorize(actor, PERMS.alerts);
  const r = resourceSchema.parse(input);
  assertNotFuture(actor, r.lastVerified);
  const t = tenant(actor);
  const fields = {
    category: r.category, name: r.name, phone: r.phone, url: r.url, description: r.description, hours: r.hours,
    last_verified: r.lastVerified, sort_order: r.sortOrder,
  };
  let id: string;
  if (r.id) {
    // The tenant scope (`school_id = actor's school`) also makes platform defaults (school_id null) read-only.
    const res = await t.supportResources.updateOne({ _id: r.id }, { $set: fields });
    if (res.matched === 0) throw new UserFacingError(READ_ONLY_RESOURCE);
    id = r.id;
  } else {
    const school = await t.schools.get();
    id = await t.supportResources.insertOne({ ...fields, country: school?.country ?? "RO" });
  }
  await audit({
    schoolId: actor.schoolId, actorId: actor.id, action: r.id ? "support_resource.updated" : "support_resource.created",
    resourceType: "support_resource", resourceId: id,
  });
  return { id };
}

export async function setResourceVerified(actor: Actor, resourceId: string, date: string): Promise<void> {
  authorize(actor, PERMS.alerts);
  z.uuid().parse(resourceId);
  isoDate.parse(date);
  assertNotFuture(actor, date);
  const res = await tenant(actor).supportResources.updateOne({ _id: resourceId }, { $set: { last_verified: date } });
  if (res.matched === 0) throw new UserFacingError(READ_ONLY_RESOURCE);
  await audit({
    schoolId: actor.schoolId, actorId: actor.id, action: "support_resource.verified",
    resourceType: "support_resource", resourceId,
  });
}

export async function deleteResource(actor: Actor, resourceId: string): Promise<void> {
  authorize(actor, PERMS.alerts);
  z.uuid().parse(resourceId);
  const n = await tenant(actor).supportResources.deleteOne({ _id: resourceId });
  if (n === 0) throw new UserFacingError(READ_ONLY_RESOURCE);
  await audit({
    schoolId: actor.schoolId, actorId: actor.id, action: "support_resource.deleted",
    resourceType: "support_resource", resourceId,
  });
}

// ───────────────────────────── Safety reports ─────────────────────────────

export interface SafetyReport {
  id: string;
  reason: string;
  details: string | null;
  status: "open" | "reviewing" | "closed";
  createdAt: string;
  reporterId: string;
  reporterName: string;
  reporterRole: string;
  reportedId: string;
  reportedName: string;
  reportedRole: string;
  reportedOpenReports: number;
}

export const reportFilterSchema = z.enum(["active", "open", "reviewing", "closed", "all"]).catch("active");

export async function listSafetyReports(actor: Actor, filter: string = "active"): Promise<SafetyReport[]> {
  authorize(actor, PERMS.reports);
  const f = reportFilterSchema.parse(filter);
  const t = tenant(actor);
  const where: Document = f === "active" ? { status: { $ne: "closed" } } : f === "all" ? {} : { status: f };
  const rows = (await t.reports.find(where))
    .sort((a, b) => Number(a.status === "closed") - Number(b.status === "closed") || time(b.created_at) - time(a.created_at))
    .slice(0, 200);
  const reportedIds = [...new Set(rows.map((r) => String(r.reported_id)))];
  const [people, openCounts] = await Promise.all([
    profilesById(t, rows.flatMap((r) => [str(r.reporter_id), str(r.reported_id)])),
    reportedIds.length
      ? t.reports.aggregate<{ _id: string; n: number }>([
          { $match: { reported_id: { $in: reportedIds }, status: { $ne: "closed" } } },
          { $group: { _id: "$reported_id", n: { $sum: 1 } } },
        ])
      : Promise.resolve([]),
  ]);
  const openByReported = new Map(openCounts.map((c) => [String(c._id), c.n]));
  const result: SafetyReport[] = [];
  for (const r of rows) {
    const reporter = people.get(String(r.reporter_id));
    const reported = people.get(String(r.reported_id));
    if (!reporter || !reported) continue; // both parties must belong to this school
    result.push({
      id: String(r._id), reason: String(r.reason), details: str(r.details), status: r.status as SafetyReport["status"], createdAt: iso(r.created_at)!,
      reporterId: String(r.reporter_id), reporterName: reporter.name, reporterRole: reporter.role,
      reportedId: String(r.reported_id), reportedName: reported.name, reportedRole: reported.role,
      reportedOpenReports: openByReported.get(String(r.reported_id)) ?? 0,
    });
  }
  await audit({
    schoolId: actor.schoolId, actorId: actor.id, action: "safeguarding.reports.viewed",
    resourceType: "report", metadata: { filter: f, count: result.length },
  });
  return result;
}

export const reportStatusSchema = z.object({
  reportId: z.uuid("Unknown report."),
  status: z.enum(["open", "reviewing", "closed"]),
});

export async function setSafetyReportStatus(actor: Actor, input: z.infer<typeof reportStatusSchema>): Promise<void> {
  authorize(actor, PERMS.reports);
  const { reportId, status } = reportStatusSchema.parse(input);
  const t = tenant(actor);
  const current = await t.reports.findOne({ _id: reportId }, { projection: { status: 1 } });
  if (!current) throw new UserFacingError("This report could not be found.");
  if (current.status === status) throw new UserFacingError(`This report is already "${REPORT_STATUS_LABELS[status]}".`);
  const res = await t.reports.updateOne({ _id: reportId, status: current.status }, { $set: { status, updated_at: new Date() } });
  if (res.matched === 0) throw new UserFacingError("This report was updated meanwhile. Reload the page and try again.");
  await audit({
    schoolId: actor.schoolId, actorId: actor.id, action: "safeguarding.report.status_changed",
    resourceType: "report", resourceId: reportId, metadata: { from: String(current.status), to: status },
  });
}
