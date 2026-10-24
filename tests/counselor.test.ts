import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { col, COLLECTIONS, newId } from "@/lib/db/mongo";
import { encryptField } from "@/lib/db/field-crypto";
import { tenant } from "@/lib/db/tenant";
import { hasAlertFor } from "@/lib/authz";
import { AuthorizationError } from "@/lib/services/errors";
import * as counselor from "@/lib/services/counselor";
import { actorFor, DEMO } from "./helpers";

type A = Awaited<ReturnType<typeof actorFor>>;

let elena: A;
let admin: A;
let teacher: A;
let otherAdmin: A;
let ids: Record<string, string>;

const ALL_PERMS = Object.values(counselor.PERMS);

async function userId(email: string): Promise<string> {
  const row = await (await col(COLLECTIONS.users)).findOne({ email });
  return String(row!._id);
}

/** Audit rows for a resource, in insertion order. */
async function auditRows(resourceId: string) {
  const rows = await (await col(COLLECTIONS.auditLogs)).find({ resource_id: resourceId }).toArray();
  return rows
    .map((r, i) => ({ i, action: String(r.action), actor_id: r.actor_id as string | null, metadata: r.metadata as Record<string, unknown>, at: new Date(r.created_at).getTime() }))
    .sort((a, b) => a.at - b.at || a.i - b.i);
}

beforeAll(async () => {
  elena = await actorFor(DEMO.counselor);
  admin = await actorFor(DEMO.admin);
  teacher = await actorFor(DEMO.mathTeacher);
  otherAdmin = await actorFor(DEMO.otherAdmin);
  ids = {
    tudor: await userId(DEMO.tudor),
    irina: await userId(DEMO.irina),
    maria: await userId(DEMO.maria),
    radu: await userId("radu.iordache@aurora.demo"),
    luca: await userId("luca.stoica@aurora.demo"),
  };
});

describe("counselor alert queue", () => {
  it("shows the seeded alerts with neutral severities", async () => {
    const active = await counselor.listAlerts(elena, { status: "active" });
    const names = active.map((a) => a.studentName);
    expect(names).toEqual(expect.arrayContaining(["Tudor Lazăr", "Irina Dobre", "Radu Iordache", "Andrei Toma"]));
    expect(active.find((a) => a.studentName === "Irina Dobre")?.severity).toBe("urgent");
    expect(active.find((a) => a.studentName === "Tudor Lazăr")?.severity).toBe("attention");
    expect(active.every((a) => a.status !== "resolved")).toBe(true);
    // Highest severity first.
    expect(active[0].severity).toBe("urgent");

    const resolved = await counselor.listAlerts(elena, { status: "resolved" });
    expect(resolved.some((a) => a.studentId === ids.luca)).toBe(true);

    const urgentOnly = await counselor.listAlerts(elena, { status: "all", severity: "urgent" });
    expect(urgentOnly.length).toBeGreaterThan(0);
    expect(urgentOnly.every((a) => a.severity === "urgent")).toBe(true);
  });

  it("filters by source", async () => {
    const rules = await counselor.listAlerts(elena, { status: "all", source: "rule" });
    expect(rules.every((a) => a.source === "rule")).toBe(true);
    const self = await counselor.listAlerts(elena, { status: "all", source: "self_referral" });
    expect(self.every((a) => a.source === "self_referral")).toBe(true);
    const tudorAlert = rules.find((a) => a.studentId === ids.tudor)!;
    const byRule = await counselor.listAlerts(elena, { status: "all", source: tudorAlert.ruleId! });
    expect(byRule.length).toBeGreaterThan(0);
    expect(byRule.every((a) => a.ruleId === tudorAlert.ruleId)).toBe(true);
    // Invalid filter values (including operator injection attempts) fall back to safe defaults.
    const fallback = await counselor.listAlerts(elena, { source: "'; drop table x; --" as never });
    expect(fallback.length).toBe((await counselor.listAlerts(elena, {})).length);
    const injected = await counselor.listAlerts(elena, { status: { $ne: null } as never, source: { $gt: "" } as never });
    expect(injected.every((a) => a.status !== "resolved")).toBe(true);
  });
});

describe("least-privilege access to individual data", () => {
  it("lets the counselor read check-in scores only for students with a recent alert", async () => {
    const t = tenant(elena);
    expect(await hasAlertFor(t, ids.tudor)).toBe(true);
    expect(await hasAlertFor(t, ids.maria)).toBe(false);

    const tudorAlert = (await counselor.listAlerts(elena, { status: "active" })).find((a) => a.studentId === ids.tudor)!;
    const tudor = await counselor.getAlertDetail(elena, tudorAlert.id);
    expect(tudor!.dataAccessible).toBe(true);
    expect(tudor!.checkins.length).toBeGreaterThan(0);
    // Minimum necessary: date + score only.
    expect(Object.keys(tudor!.checkins[0]).sort()).toEqual(["date", "mood"]);

    // Maria definitely has check-ins (and one shared note) in the window…
    const today = new Date().toISOString().slice(0, 10);
    const checkins = await col(COLLECTIONS.checkins);
    const mariaRows = await checkins.find({ student_id: ids.maria }).sort({ date: -1 }).toArray();
    expect(mariaRows.length).toBeGreaterThan(0);
    await checkins.updateOne({ _id: mariaRows[0]._id }, { $set: { note_enc: encryptField("MARIA-SHARED-NOTE"), note_shared: true } });
    // …but her only alert was resolved long ago, so the counselor sees neither scores nor notes.
    const alerts = await col(COLLECTIONS.alerts);
    const oldAlertId = newId();
    await alerts.insertOne({
      _id: oldAlertId, school_id: elena.schoolId, student_id: ids.maria, rule_id: null, source: "rule", severity: "info", status: "resolved",
      summary: "Historic test alert.", observed: {}, window_start: mariaRows.at(-1)!.date, window_end: today,
      assigned_to: null, acknowledged_by: null, acknowledged_at: null, resolved_at: new Date(Date.now() - 120 * 86400_000), resolution_enc: null,
      created_at: new Date(Date.now() - 130 * 86400_000), updated_at: new Date(Date.now() - 120 * 86400_000),
    });
    try {
      expect(await hasAlertFor(t, ids.maria)).toBe(false);
      const maria = await counselor.getAlertDetail(elena, oldAlertId);
      expect(maria).not.toBeNull();
      expect(maria!.dataAccessible).toBe(false);
      expect(maria!.checkins).toEqual([]);
      expect(maria!.sharedNotes).toEqual([]);
      expect(JSON.stringify(maria)).not.toContain("MARIA-SHARED-NOTE");
    } finally {
      await alerts.deleteOne({ _id: oldAlertId });
      await checkins.updateOne({ _id: mariaRows[0]._id }, { $set: { note_enc: mariaRows[0].note_enc ?? null, note_shared: false } });
    }
  });

  it("never shows private notes, only notes the student chose to share (decrypted)", async () => {
    const tudorAlert = (await counselor.listAlerts(elena, { status: "active" })).find((a) => a.studentId === ids.tudor)!;
    const checkins = await col(COLLECTIONS.checkins);
    const inWindow = await checkins
      .find({ student_id: ids.tudor, date: { $gte: tudorAlert.windowStart!, $lte: tudorAlert.windowEnd! } })
      .sort({ date: -1 })
      .limit(2)
      .toArray();
    expect(inWindow.length).toBe(2);
    await checkins.updateOne({ _id: inWindow[0]._id }, { $set: { note_enc: encryptField("PRIVATE-NOTE-XYZ"), note_shared: false } });
    await checkins.updateOne({ _id: inWindow[1]._id }, { $set: { note_enc: encryptField("SHARED-NOTE-ABC"), note_shared: true } });

    // Notes are encrypted at rest.
    const raw = JSON.stringify(await checkins.find({ student_id: ids.tudor }).toArray());
    expect(raw).not.toContain("PRIVATE-NOTE-XYZ");
    expect(raw).not.toContain("SHARED-NOTE-ABC");

    const detail = await counselor.getAlertDetail(elena, tudorAlert.id);
    expect(detail).not.toBeNull();
    expect(detail!.checkins.length).toBeGreaterThan(0);
    expect(detail!.sharedNotes.map((n) => n.note)).toEqual(["SHARED-NOTE-ABC"]);
    expect(JSON.stringify(detail)).not.toContain("PRIVATE-NOTE-XYZ");
  });

  it("records an audit event (IDs only) for every detail view", async () => {
    const irinaAlert = (await counselor.listAlerts(elena, { status: "active" })).find((a) => a.studentId === ids.irina)!;
    const before = (await auditRows(irinaAlert.id)).filter((r) => r.action === "wellbeing.alert.viewed").length;
    await counselor.getAlertDetail(elena, irinaAlert.id);
    await counselor.getAlertDetail(elena, irinaAlert.id);
    const views = (await auditRows(irinaAlert.id)).filter((r) => r.action === "wellbeing.alert.viewed");
    expect(views.length).toBe(before + 2);
    expect(views.at(-1)!.actor_id).toBe(elena.id);
    expect(Object.keys(views.at(-1)!.metadata)).toEqual(["student_id"]);
  });

  it("returns null for unknown or malformed alert ids", async () => {
    expect(await counselor.getAlertDetail(elena, "not-a-uuid")).toBeNull();
    expect(await counselor.getAlertDetail(elena, "00000000-0000-4000-8000-000000000000")).toBeNull();
  });
});

describe("alert workflow", () => {
  it("acknowledge → assign → follow-up → offer conversation → resolve, all audited", async () => {
    const alert = (await counselor.listAlerts(elena, { status: "active" })).find((a) => a.studentId === ids.radu)!;
    expect(alert).toBeDefined();

    await counselor.setAlertStatus(elena, alert.id, "acknowledged");
    await expect(counselor.setAlertStatus(elena, alert.id, "acknowledged")).rejects.toThrow(/already/);
    await counselor.assignAlertToMe(elena, alert.id);
    await counselor.setAlertStatus(elena, alert.id, "in_progress");
    await counselor.addFollowup(elena, { alertId: alert.id, action: "note", note: "SECRET-FOLLOWUP-TEXT" });
    await expect(counselor.addFollowup(elena, { alertId: alert.id, action: "note", note: "" })).rejects.toThrow();

    const tomorrow = new Date(Date.now() + 2 * 86400_000).toISOString().slice(0, 10);
    const { sessionId } = await counselor.offerSupportSession(elena, { alertId: alert.id, proposedAt: `${tomorrow}T10:30`, location: "Counselor's office" });
    await expect(
      counselor.offerSupportSession(elena, { alertId: alert.id, proposedAt: `${tomorrow}T11:30`, location: "Counselor's office" }),
    ).rejects.toThrow(/already an upcoming/);
    await expect(
      counselor.offerSupportSession(elena, { alertId: alert.id, proposedAt: "2020-01-01T10:00", location: "Office" }),
    ).rejects.toThrow(/future/);

    // The proposed wall-clock time is interpreted in the counselor's time zone.
    const session = await (await col(COLLECTIONS.supportSessions)).findOne({ _id: sessionId });
    const local = new Intl.DateTimeFormat("sv-SE", { timeZone: elena.timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })
      .format(session!.proposed_at).replace(" ", "T");
    expect(local).toBe(`${tomorrow}T10:30`);
    expect(session!.school_id).toBe(elena.schoolId);

    // The student got a neutral notification.
    const notes = await (await col(COLLECTIONS.notifications))
      .find({ user_id: ids.radu, type: "support_session" }, { projection: { _id: 0, title: 1, type: 1, sensitive: 1, link: 1 } })
      .toArray();
    expect(notes).toEqual([{ title: "Your school counselor would like to check in", type: "support_session", sensitive: true, link: "/student/wellbeing/support" }]);
    const upcoming = await counselor.listSessions(elena, "upcoming");
    expect(upcoming.find((s) => s.id === sessionId)?.status).toBe("proposed");
    await expect(counselor.updateSessionStatus(elena, { sessionId, status: "completed" })).rejects.toThrow(/accepted/);
    await counselor.updateSessionStatus(elena, { sessionId, status: "cancelled" });

    await counselor.resolveAlert(elena, { alertId: alert.id, resolution: "Checked in with the student; no further action." });
    await expect(counselor.resolveAlert(elena, { alertId: alert.id, resolution: "again" })).rejects.toThrow(/already resolved/);

    const detail = await counselor.getAlertDetail(elena, alert.id);
    expect(detail!.alert.status).toBe("resolved");
    expect(detail!.alert.assignedToMe).toBe(true);
    expect(detail!.alert.acknowledgedByName).toBe("Elena Popa");
    expect(detail!.alert.resolution).toBe("Checked in with the student; no further action.");
    expect(detail!.followups.map((f) => f.action)).toEqual(
      expect.arrayContaining(["status_change", "note", "conversation_offered"]),
    );
    // Notes are decrypted for the authorised counselor.
    expect(detail!.followups.find((f) => f.action === "note")?.note).toBe("SECRET-FOLLOWUP-TEXT");

    const actions = (await auditRows(alert.id)).map((r) => r.action);
    expect(actions).toEqual(
      expect.arrayContaining([
        "wellbeing.alert.acknowledged",
        "wellbeing.alert.assigned",
        "wellbeing.alert.in_progress",
        "wellbeing.followup.added",
        "wellbeing.alert.resolved",
        "wellbeing.alert.viewed",
      ]),
    );
    const sessionAudit = (await auditRows(sessionId)).map((r) => r.action);
    expect(sessionAudit).toEqual(["wellbeing.support_session.offered", "wellbeing.support_session.cancelled"]);
    // Audit metadata never carries note content.
    const all = JSON.stringify([...(await auditRows(alert.id)), ...(await auditRows(sessionId))]);
    expect(all).not.toContain("SECRET-FOLLOWUP-TEXT");
    expect(all).not.toContain("no further action");
  });

  it("stores follow-up notes and resolutions encrypted at rest", async () => {
    const alert = (await counselor.listAlerts(elena, { status: "resolved" })).find((a) => a.studentId === ids.radu)!;
    const followups = await (await col(COLLECTIONS.followups)).find({ alert_id: alert.id }).toArray();
    expect(followups.length).toBeGreaterThan(0);
    const note = followups.find((f) => f.action === "note")!;
    expect(String(note.note_enc)).toMatch(/^enc:v1:/);
    expect(note.author_id).toBe(elena.id);
    expect(note.school_id).toBe(elena.schoolId);
    const raw = JSON.stringify(followups);
    expect(raw).not.toContain("SECRET-FOLLOWUP-TEXT");
    expect(raw).not.toContain("no further action");

    const alertDoc = await (await col(COLLECTIONS.alerts)).findOne({ _id: alert.id });
    expect(String(alertDoc!.resolution_enc)).toMatch(/^enc:v1:/);
    expect(JSON.stringify(alertDoc)).not.toContain("no further action");
  });

  it("keeps follow-ups append-only", async () => {
    const alert = (await counselor.listAlerts(elena, { status: "active" })).find((a) => a.studentId === ids.irina)!;
    const followups = await col(COLLECTIONS.followups);
    await counselor.addFollowup(elena, { alertId: alert.id, action: "monitoring", note: "First entry." });
    const before = await followups.find({ alert_id: alert.id }).toArray();
    await counselor.addFollowup(elena, { alertId: alert.id, action: "note", note: "Second entry." });
    await counselor.setAlertStatus(elena, alert.id, "acknowledged");
    const after = await followups.find({ alert_id: alert.id }).toArray();
    expect(after.length).toBe(before.length + 2);
    // Every existing follow-up is untouched.
    for (const f of before) expect(after.find((x) => x._id === f._id)).toEqual(f);

    // The service has no code path that updates or deletes follow-ups.
    const source = readFileSync(path.resolve(import.meta.dirname, "../src/lib/services/counselor.ts"), "utf8");
    expect(source).not.toMatch(/followups\.(update|delete|findOneAndUpdate|replace)/);
    expect(Object.keys(counselor).some((k) => /^(update|edit|delete|remove)Followup/i.test(k))).toBe(false);
  });
});

describe("people without wellbeing permission", () => {
  const permissionGated = (a: A) => [
    () => counselor.listAlerts(a),
    () => counselor.listRuleOptions(a),
    () => counselor.getDashboard(a),
    () => counselor.getAlertDetail(a, "00000000-0000-4000-8000-000000000000"),
    () => counselor.setAlertStatus(a, "00000000-0000-4000-8000-000000000000", "acknowledged"),
    () => counselor.assignAlertToMe(a, "00000000-0000-4000-8000-000000000000"),
    () => counselor.addFollowup(a, { alertId: "00000000-0000-4000-8000-000000000000", action: "note", note: "x" }),
    () => counselor.resolveAlert(a, { alertId: "00000000-0000-4000-8000-000000000000", resolution: "xxx" }),
    () => counselor.listSessions(a),
    () => counselor.getAggregateReport(a, 14),
    () => counselor.listRules(a),
    () => counselor.reevaluateAllStudents(a),
    () => counselor.listResources(a),
    () => counselor.listSafetyReports(a),
  ];

  it("the school admin cannot read alerts, check-ins or follow-ups", async () => {
    expect(admin.permissions).not.toContain("wellbeing.alerts");
    await expect(counselor.listAlerts(admin)).rejects.toThrow(/permission/);
    for (const call of permissionGated(admin)) await expect(call()).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("a teacher cannot read alerts", async () => {
    await expect(counselor.listAlerts(teacher)).rejects.toThrow(/permission/);
    await expect(counselor.getAlertDetail(teacher, "00000000-0000-4000-8000-000000000000")).rejects.toThrow(/permission/);
    for (const call of permissionGated(teacher)) await expect(call()).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("the role alone is not enough: a counselor without the permission is denied", async () => {
    const noPerms = { ...elena, permissions: [] };
    for (const call of permissionGated(noPerms)) await expect(call()).rejects.toBeInstanceOf(AuthorizationError);
    // Rules permission alone does not open the alert queue.
    await expect(counselor.listAlerts({ ...elena, permissions: ["wellbeing.rules"] })).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("another school's staff never see Aurora data, even with every wellbeing permission", async () => {
    await expect(counselor.listAlerts(otherAdmin)).rejects.toThrow(/permission/);
    // A Birchwood counselor holding every permission.
    const birch = { ...otherAdmin, role: "counselor" as const, permissions: ALL_PERMS };
    expect(birch.schoolId).not.toBe(elena.schoolId);

    const auroraAlerts = await counselor.listAlerts(elena, { status: "all" });
    const auroraAlert = auroraAlerts.find((a) => a.status !== "resolved")!;
    const auroraIds = new Set(auroraAlerts.map((a) => a.id));
    const auroraRules = await counselor.listRules(elena);
    const auroraSessions = await counselor.listSessions(elena, "all");
    expect(auroraSessions.length).toBeGreaterThan(0);

    // Reads see nothing of Aurora.
    expect((await counselor.listAlerts(birch, { status: "all" })).some((a) => auroraIds.has(a.id))).toBe(false);
    expect(await counselor.getAlertDetail(birch, auroraAlert.id)).toBeNull();
    expect(await hasAlertFor(tenant(birch), ids.tudor)).toBe(false);
    expect((await counselor.listSessions(birch, "all")).some((s) => auroraSessions.some((x) => x.id === s.id))).toBe(false);
    expect((await counselor.listRules(birch)).some((r) => auroraRules.some((x) => x.id === r.id))).toBe(false);
    expect((await counselor.listResources(birch)).school).toEqual([]);
    expect(await counselor.listSafetyReports(birch, "all")).toEqual([]);
    const dash = await counselor.getDashboard(birch);
    expect(dash.pending.some((a) => auroraIds.has(a.id))).toBe(false);
    expect(dash.activity.some((a) => auroraIds.has(a.alertId))).toBe(false);
    const report = await counselor.getAggregateReport(birch, 30);
    expect(report.classes.map((c) => c.name)).toEqual(["9X"]);

    // Writes cannot reach Aurora records.
    await expect(counselor.setAlertStatus(birch, auroraAlert.id, "in_progress")).rejects.toThrow(/could not be found/);
    await expect(counselor.addFollowup(birch, { alertId: auroraAlert.id, action: "note", note: "Cross-school" })).rejects.toThrow(/could not be found/);
    await expect(counselor.resolveAlert(birch, { alertId: auroraAlert.id, resolution: "Cross-school" })).rejects.toThrow(/could not be found/);
    await expect(counselor.setRuleEnabled(birch, auroraRules[0].id, false)).rejects.toThrow(/could not be found/);
    await expect(counselor.updateSessionStatus(birch, { sessionId: auroraSessions[0].id, status: "cancelled" })).rejects.toThrow(/could not be found/);
    const reeval = await counselor.reevaluateAllStudents(birch);
    expect(reeval.students).toBe(3);
    expect((await (await col(COLLECTIONS.followups)).countDocuments({ alert_id: auroraAlert.id, author_id: otherAdmin.id }))).toBe(0);
  });
});

describe("rules, reports, resources and safety reports", () => {
  it("edits, toggles and re-evaluates rules with audit", async () => {
    const rules = await counselor.listRules(elena);
    expect(rules.length).toBeGreaterThanOrEqual(3);
    expect(rules.some((r) => r.openAlerts > 0)).toBe(true);
    const rule = rules[0];
    await counselor.setRuleEnabled(elena, rule.id, false);
    expect((await counselor.listRules(elena)).find((r) => r.id === rule.id)!.enabled).toBe(false);
    await counselor.setRuleEnabled(elena, rule.id, true);
    await expect(
      counselor.saveRule(elena, { name: "Bad", kind: "consecutive_low", windowDays: 5, threshold: 3, consecutiveCount: null, minCheckins: 3, severity: "info", enabled: true }),
    ).rejects.toThrow();
    const { id } = await counselor.saveRule(elena, { name: "Test rule (example)", kind: "window_average", windowDays: 10, threshold: 2.04, consecutiveCount: 4, minCheckins: 4, severity: "info", enabled: false });
    const saved = (await counselor.listRules(elena)).find((r) => r.id === id)!;
    expect(saved.threshold).toBe(2);
    expect(saved.consecutiveCount).toBeNull();
    expect(saved.updatedByName).toBe("Elena Popa");
    expect((await auditRows(id)).map((r) => r.action)).toEqual(["wellbeing.rule.created"]);
    expect((await auditRows(rule.id)).map((r) => r.action)).toEqual(["wellbeing.rule.disabled", "wellbeing.rule.enabled"]);

    // Rules-only staff see the rules but not alert counts.
    const rulesOnly = await counselor.listRules({ ...elena, permissions: ["wellbeing.rules"] });
    expect(rulesOnly.every((r) => r.openAlerts === 0)).toBe(true);

    const result = await counselor.reevaluateAllStudents(elena);
    const auroraStudents = await (await col(COLLECTIONS.profiles)).countDocuments({ school_id: elena.schoolId, role: "student" });
    expect(result.students).toBe(auroraStudents);
    expect((await auditRows(elena.schoolId)).map((r) => r.action)).toContain("wellbeing.rules.reevaluated");
    expect(result.created + result.escalated).toBeGreaterThanOrEqual(0);

    await expect(counselor.listRules(admin)).rejects.toThrow(/permission/);
  });

  it("serves only k-anonymous aggregates", async () => {
    const report = await counselor.getAggregateReport(elena, 30);
    expect(report.school.suppressed).toBe(false);
    expect(report.school.students_reporting).toBeGreaterThanOrEqual(5);
    expect(report.classes.length).toBe(3);
    expect(JSON.stringify(report)).not.toContain(ids.tudor);
  });

  it("manages school resources but never platform defaults", async () => {
    const { platform } = await counselor.listResources(elena);
    expect(platform.length).toBeGreaterThan(0);
    const platformBefore = await (await col(COLLECTIONS.supportResources)).findOne({ _id: platform[0].id });
    await expect(
      counselor.saveResource(elena, { id: platform[0].id, category: "helpline", name: "Hijack", description: "Should not be editable.", sortOrder: 100 }),
    ).rejects.toThrow(/read-only/);
    await expect(counselor.setResourceVerified(elena, platform[0].id, "2026-01-01")).rejects.toThrow(/read-only/);
    await expect(counselor.deleteResource(elena, platform[0].id)).rejects.toThrow(/read-only/);
    expect(await (await col(COLLECTIONS.supportResources)).findOne({ _id: platform[0].id })).toEqual(platformBefore);
    await expect(
      counselor.saveResource(elena, { category: "school", name: "Bad link", description: "Uses a script link.", url: "javascript:alert(1)", sortOrder: 100 }),
    ).rejects.toThrow();
    const { id } = await counselor.saveResource(elena, { category: "school", name: "Counselor's office", description: "Room 12, ground floor. Drop in any break.", hours: "Mon–Fri 9:00–15:00", sortOrder: 10 });
    await counselor.setResourceVerified(elena, id, new Date().toISOString().slice(0, 10).replace(/\d\d$/, "01"));
    const { school } = await counselor.listResources(elena);
    expect(school.find((r) => r.id === id)!.lastVerified).not.toBeNull();
    expect(school.find((r) => r.id === id)!.schoolId).toBe(elena.schoolId);
    await counselor.deleteResource(elena, id);
    expect((await auditRows(id)).map((r) => r.action)).toEqual(["support_resource.created", "support_resource.verified", "support_resource.deleted"]);
  });

  it("lists and updates safety reports only with safeguarding.reports", async () => {
    const reportId = newId();
    await (await col(COLLECTIONS.reports)).insertOne({
      _id: reportId, school_id: elena.schoolId, reporter_id: ids.maria, reported_id: ids.tudor, reason: "bullying", details: "Test report", status: "open", created_at: new Date(),
    });
    const list = await counselor.listSafetyReports(elena, "active");
    const r = list.find((x) => x.id === reportId)!;
    expect(r.reporterName).toBe("Maria Georgescu");
    expect(r.reportedName).toBe("Tudor Lazăr");
    expect(r.reportedOpenReports).toBeGreaterThanOrEqual(1);
    await counselor.setSafetyReportStatus(elena, { reportId, status: "reviewing" });
    await expect(counselor.setSafetyReportStatus(elena, { reportId, status: "reviewing" })).rejects.toThrow(/already/);
    await counselor.setSafetyReportStatus(elena, { reportId, status: "closed" });
    expect((await counselor.listSafetyReports(elena, "closed")).some((x) => x.id === reportId)).toBe(true);
    expect((await auditRows(reportId)).map((x) => x.action)).toEqual(["safeguarding.report.status_changed", "safeguarding.report.status_changed"]);
    await expect(counselor.listSafetyReports(admin)).rejects.toThrow(/permission/);
    await expect(counselor.listSafetyReports({ ...elena, permissions: ["wellbeing.alerts"] })).rejects.toBeInstanceOf(AuthorizationError);
  });
});
