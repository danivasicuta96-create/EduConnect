// Early-warning rule evaluation.
//
// These rules are configurable *examples* of sustained low self-reported mood.
// They are not clinically validated thresholds and never produce a diagnosis.
// An alert means "a trained adult may want to offer support", nothing more.

export type Severity = "info" | "attention" | "urgent";

export interface AlertRule {
  id: string;
  name: string;
  kind: "window_average" | "consecutive_low";
  windowDays: number;
  threshold: number;
  consecutiveCount: number | null;
  minCheckins: number;
  severity: Severity;
  enabled: boolean;
}

export interface CheckinPoint {
  date: string; // YYYY-MM-DD
  mood: number;
}

export interface RuleMatch {
  ruleId: string;
  severity: Severity;
  summary: string;
  observed: { average: number; checkins: number; lowest: number; windowDays: number; threshold: number };
  windowStart: string;
  windowEnd: string;
}

export const SEVERITY_RANK: Record<Severity, number> = { info: 1, attention: 2, urgent: 3 };

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function evaluateRule(rule: AlertRule, checkins: CheckinPoint[], today: string): RuleMatch | null {
  if (!rule.enabled) return null;
  const windowStart = addDays(today, -(rule.windowDays - 1));
  const inWindow = checkins
    .filter((c) => c.date >= windowStart && c.date <= today)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (rule.kind === "window_average") {
    if (inWindow.length < rule.minCheckins) return null;
    const avg = inWindow.reduce((a, c) => a + c.mood, 0) / inWindow.length;
    if (avg >= rule.threshold) return null;
    const average = round1(avg);
    return {
      ruleId: rule.id,
      severity: rule.severity,
      summary: `Average self-reported mood of ${average}/10 across ${inWindow.length} check-ins in the last ${rule.windowDays} days is below the configured level of ${rule.threshold}.`,
      observed: { average, checkins: inWindow.length, lowest: Math.min(...inWindow.map((c) => c.mood)), windowDays: rule.windowDays, threshold: rule.threshold },
      windowStart: inWindow[0].date,
      windowEnd: inWindow[inWindow.length - 1].date,
    };
  }

  // consecutive_low: the most recent N check-ins (school days without a
  // check-in are skipped, not counted) are all at or below the threshold.
  const n = rule.consecutiveCount ?? 5;
  if (inWindow.length < Math.max(n, rule.minCheckins)) return null;
  const latest = inWindow.slice(-n);
  // Must be current: the newest check-in is within the last 3 days.
  if (latest[latest.length - 1].date < addDays(today, -2)) return null;
  if (!latest.every((c) => c.mood <= rule.threshold)) return null;
  const average = round1(latest.reduce((a, c) => a + c.mood, 0) / latest.length);
  return {
    ruleId: rule.id,
    severity: rule.severity,
    summary: `The last ${n} check-ins were all at or below ${rule.threshold}/10 (average ${average}).`,
    observed: { average, checkins: latest.length, lowest: Math.min(...latest.map((c) => c.mood)), windowDays: rule.windowDays, threshold: rule.threshold },
    windowStart: latest[0].date,
    windowEnd: latest[latest.length - 1].date,
  };
}

export function evaluateRules(rules: AlertRule[], checkins: CheckinPoint[], today: string): RuleMatch[] {
  return rules
    .map((r) => evaluateRule(r, checkins, today))
    .filter((m): m is RuleMatch => m !== null)
    .sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]);
}

export interface ExistingAlert {
  id: string;
  ruleId: string | null;
  severity: Severity;
  status: "open" | "acknowledged" | "in_progress" | "resolved";
  resolvedAt: string | null; // YYYY-MM-DD
}

export type AlertDecision =
  | { action: "none"; reason: string }
  | { action: "create"; match: RuleMatch }
  | { action: "escalate"; alertId: string; match: RuleMatch };

/** Days after a resolution during which the same rule will not re-alert. */
export const RESOLUTION_COOLDOWN_DAYS = 7;

/**
 * Decide what to do with the strongest rule match, avoiding duplicate alerts:
 * – an unresolved alert already exists → do nothing, unless the new match is
 *   more severe, in which case the existing alert is escalated;
 * – the same rule was resolved recently → wait for the cooldown.
 */
export function decideAlert(matches: RuleMatch[], existing: ExistingAlert[], today: string): AlertDecision {
  const strongest = matches[0];
  if (!strongest) return { action: "none", reason: "no rule matched" };

  const unresolved = existing.filter((a) => a.status !== "resolved");
  if (unresolved.length > 0) {
    const top = unresolved.reduce((a, b) => (SEVERITY_RANK[b.severity] > SEVERITY_RANK[a.severity] ? b : a));
    if (SEVERITY_RANK[strongest.severity] > SEVERITY_RANK[top.severity]) {
      return { action: "escalate", alertId: top.id, match: strongest };
    }
    return { action: "none", reason: "an unresolved alert already covers this" };
  }

  const cooldownStart = addDays(today, -RESOLUTION_COOLDOWN_DAYS);
  const recentlyResolved = existing.some(
    (a) => a.status === "resolved" && a.ruleId === strongest.ruleId && a.resolvedAt !== null && a.resolvedAt >= cooldownStart,
  );
  if (recentlyResolved) return { action: "none", reason: "same rule resolved recently (cooldown)" };

  return { action: "create", match: strongest };
}

/** Defaults installed for new schools — clearly marked as examples to review. */
export const DEFAULT_RULES: Array<Omit<AlertRule, "id">> = [
  { name: "7-day average below 5 (example)", kind: "window_average", windowDays: 7, threshold: 5, consecutiveCount: null, minCheckins: 3, severity: "attention", enabled: true },
  { name: "14-day average below 6 (example)", kind: "window_average", windowDays: 14, threshold: 6, consecutiveCount: null, minCheckins: 6, severity: "info", enabled: true },
  { name: "5 consecutive low check-ins (example)", kind: "consecutive_low", windowDays: 10, threshold: 3, consecutiveCount: 5, minCheckins: 5, severity: "urgent", enabled: true },
];
