// Applies the configured alert rules to one student's check-ins and records
// the outcome. Privileged (system access) because students can neither read
// the rules nor write alerts — callers are trusted server code (check-in
// submission, the seed, or a counselor-triggered re-evaluation).

import { col, COLLECTIONS, newId } from "@/lib/db/mongo";
import { addDays } from "@/lib/dates";
import { decideAlert, evaluateRules, type AlertDecision, type AlertRule, type ExistingAlert } from "@/lib/engines/alerts";
import { audit } from "./audit";
import { notify } from "./notify";

export async function loadRules(schoolId: string): Promise<AlertRule[]> {
  const rows = await (await col(COLLECTIONS.alertRules)).find({ school_id: schoolId }).sort({ severity: -1, name: 1 }).toArray();
  return rows.map((r) => ({
    id: String(r._id),
    name: r.name,
    kind: r.kind,
    windowDays: r.window_days,
    threshold: r.threshold,
    consecutiveCount: r.consecutive_count ?? null,
    minCheckins: r.min_checkins,
    severity: r.severity,
    enabled: r.enabled,
  }));
}

export async function runAlertEngine(studentId: string, today: string): Promise<AlertDecision> {
  const student = await (await col(COLLECTIONS.profiles)).findOne({ _id: studentId as never, role: "student" });
  if (!student) return { action: "none", reason: "not a student" };
  const schoolId = String(student.school_id);

  const rules = await loadRules(schoolId);
  const maxWindow = Math.max(14, ...rules.map((r) => r.windowDays));
  const checkins = (
    await (await col(COLLECTIONS.checkins))
      .find({ student_id: studentId, date: { $gte: addDays(today, -maxWindow), $lte: today } }, { projection: { date: 1, mood: 1 } })
      .sort({ date: 1 })
      .toArray()
  ).map((c) => ({ date: String(c.date), mood: Number(c.mood) }));

  const alertsCol = await col(COLLECTIONS.alerts);
  const existing: ExistingAlert[] = (
    await alertsCol.find({ student_id: studentId, source: "rule", created_at: { $gt: new Date(Date.now() - 90 * 86400_000) } }).toArray()
  ).map((a) => ({
    id: String(a._id),
    ruleId: a.rule_id ?? null,
    severity: a.severity,
    status: a.status,
    resolvedAt: a.resolved_at ? new Date(a.resolved_at).toISOString().slice(0, 10) : null,
  }));

  const decision = decideAlert(evaluateRules(rules, checkins, today), existing, today);

  if (decision.action === "create") {
    const m = decision.match;
    const id = newId();
    const now = new Date();
    await alertsCol.insertOne({
      _id: id as never, school_id: schoolId, student_id: studentId, rule_id: m.ruleId, source: "rule", severity: m.severity, status: "open",
      summary: m.summary, observed: m.observed, window_start: m.windowStart, window_end: m.windowEnd,
      assigned_to: null, acknowledged_by: null, acknowledged_at: null, resolved_at: null, resolution_enc: null, created_at: now, updated_at: now,
    });
    await audit({ schoolId, actorId: null, action: "wellbeing.alert.created", resourceType: "wellbeing_alert", resourceId: id, metadata: { severity: m.severity, rule_id: m.ruleId } });
    await notifyCounselors(schoolId, id, m.severity);
  } else if (decision.action === "escalate") {
    const m = decision.match;
    await alertsCol.updateOne(
      { _id: decision.alertId as never },
      { $set: { severity: m.severity, rule_id: m.ruleId, summary: m.summary, observed: m.observed, window_start: m.windowStart, window_end: m.windowEnd, updated_at: new Date() } },
    );
    await (await col(COLLECTIONS.followups)).insertOne({
      _id: newId() as never, school_id: schoolId, alert_id: decision.alertId, author_id: null, action: "status_change",
      note_enc: null, system_note: `Severity raised automatically to "${m.severity}" by rule evaluation.`, created_at: new Date(),
    });
    await audit({ schoolId, actorId: null, action: "wellbeing.alert.escalated", resourceType: "wellbeing_alert", resourceId: decision.alertId, metadata: { severity: m.severity } });
    await notifyCounselors(schoolId, decision.alertId, m.severity);
  }
  return decision;
}

export async function notifyCounselors(schoolId: string, alertId: string, severity: string) {
  const staff = await (await col(COLLECTIONS.staffPermissions)).find({ school_id: schoolId, permission: "wellbeing.alerts" }).toArray();
  await notify(schoolId, staff.map((s) => String(s.user_id)), {
    type: "counselor_alert",
    title: severity === "urgent" ? "Support follow-up: urgent review suggested" : "Support follow-up suggested",
    body: "Open the alert queue to review the context.",
    link: `/counselor/alerts/${alertId}`,
    sensitive: true,
  });
}
