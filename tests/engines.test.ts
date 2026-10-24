import { describe, expect, it } from "vitest";
import { overallAverage, practiceRecommendations, requiredScore, subjectAverage, attendanceRate } from "@/lib/engines/grades";
import { recommendPeers, scoreMatch, type MatchCandidate } from "@/lib/engines/matching";
import { decideAlert, evaluateRule, evaluateRules, type AlertRule } from "@/lib/engines/alerts";
import { screenText } from "@/lib/engines/safety";
import { addDays } from "@/lib/dates";
import { streakOf, suggestionsFor } from "@/lib/services/wellbeing";

describe("grade calculations", () => {
  it("computes weighted averages", () => {
    expect(subjectAverage([{ score: 8 }, { score: 10, weight: 2 }])).toBe(9.33);
    expect(subjectAverage([])).toBeNull();
    expect(overallAverage([8, 9, null])).toBe(8.5);
  });

  it("solves for the score needed to reach a target", () => {
    // (8 × (2 + 2) − 14) ÷ 2 = 9
    const r = requiredScore({ current: [{ score: 7 }, { score: 7 }], target: 8, upcomingCount: 2 });
    expect(r.status).toBe("achievable");
    expect(r.needed).toBe(9);
  });

  it("flags impossible and already-met targets", () => {
    expect(requiredScore({ current: [{ score: 4 }, { score: 4 }, { score: 4 }], target: 9, upcomingCount: 1 }).status).toBe("out_of_reach");
    expect(requiredScore({ current: [{ score: 10 }, { score: 10 }, { score: 10 }], target: 7, upcomingCount: 1 }).status).toBe("already_met");
    expect(requiredScore({ current: [], target: 11, upcomingCount: 1 }).status).toBe("invalid");
  });

  it("recommends practice for low or falling subjects", () => {
    const recs = practiceRecommendations([
      { subjectId: "a", subjectName: "Maths", grades: [{ score: 5, gradedOn: "2026-01-01" }, { score: 6, gradedOn: "2026-01-08" }] },
      { subjectId: "b", subjectName: "Art", grades: [{ score: 10, gradedOn: "2026-01-01" }, { score: 10, gradedOn: "2026-01-02" }, { score: 8, gradedOn: "2026-01-03" }, { score: 8, gradedOn: "2026-01-04" }] },
      { subjectId: "c", subjectName: "History", grades: [{ score: 9, gradedOn: "2026-01-01" }] },
    ]);
    expect(recs.map((r) => r.subjectName)).toEqual(["Maths", "Art"]);
  });

  it("computes attendance rate counting lates as attended", () => {
    expect(attendanceRate([{ status: "present" }, { status: "late" }, { status: "absent" }, { status: "excused" }])).toBe(50);
  });
});

describe("matchmaking", () => {
  const me = { id: "me", gradeLevel: 9, interests: [1, 2, 3], goals: ["learn_coding"], learningStyle: "visual", openTo: ["study_partner"] };
  const cand = (over: Partial<MatchCandidate>): MatchCandidate => ({ id: "x", gradeLevel: 9, interests: [], goals: [], learningStyle: null, openTo: [], discoverable: true, ...over });

  it("scores shared interests and explains why", () => {
    const r = scoreMatch(me, cand({ interests: [1, 2, 9], goals: ["learn_coding"], learningStyle: "visual" }), (i) => `I${i}`);
    expect(r.sharedInterests).toEqual([1, 2]);
    expect(r.score).toBeGreaterThan(50);
    expect(r.reasons[0]).toBe("You both like I1 and I2");
  });

  it("ranks better matches first", () => {
    const res = recommendPeers(me, [cand({ id: "weak", interests: [1] }), cand({ id: "strong", interests: [1, 2, 3], goals: ["learn_coding"] })], { blocked: new Set(), existing: new Set(), dismissed: new Set() });
    expect(res.map((r) => r.id)).toEqual(["strong", "weak"]);
  });

  it("excludes blocked, connected, dismissed, hidden, far-apart grades and no-common-ground candidates", () => {
    const res = recommendPeers(
      me,
      [
        cand({ id: "blocked", interests: [1, 2] }),
        cand({ id: "existing", interests: [1, 2] }),
        cand({ id: "dismissed", interests: [1, 2] }),
        cand({ id: "hidden", interests: [1, 2], discoverable: false }),
        cand({ id: "older", interests: [1, 2], gradeLevel: 12 }),
        cand({ id: "nothing", interests: [7, 8], learningStyle: "visual" }),
        cand({ id: "ok", interests: [1, 2] }),
      ],
      { blocked: new Set(["blocked"]), existing: new Set(["existing"]), dismissed: new Set(["dismissed"]) },
    );
    expect(res.map((r) => r.id)).toEqual(["ok"]);
  });
});

describe("alert rules", () => {
  const today = "2026-10-23";
  const rule = (over: Partial<AlertRule>): AlertRule => ({
    id: "r", name: "r", kind: "window_average", windowDays: 7, threshold: 5, consecutiveCount: null, minCheckins: 3, severity: "attention", enabled: true, ...over,
  });
  const days = (moods: number[]) => moods.map((mood, i) => ({ date: addDays(today, -(moods.length - 1 - i)), mood }));

  it("window average fires below the threshold with enough check-ins", () => {
    expect(evaluateRule(rule({}), days([4, 4, 5]), today)?.observed.average).toBe(4.3);
    expect(evaluateRule(rule({}), days([4, 4]), today)).toBeNull(); // too few check-ins
    expect(evaluateRule(rule({}), days([5, 5, 5]), today)).toBeNull(); // not below
    expect(evaluateRule(rule({ enabled: false }), days([1, 1, 1]), today)).toBeNull();
  });

  it("ignores check-ins outside the window", () => {
    const old = [{ date: addDays(today, -20), mood: 1 }, { date: addDays(today, -19), mood: 1 }, { date: addDays(today, -18), mood: 1 }];
    expect(evaluateRule(rule({}), [...old, ...days([8, 8, 8])], today)).toBeNull();
  });

  it("consecutive low fires only when the latest N are all low and recent", () => {
    const r = rule({ kind: "consecutive_low", threshold: 3, consecutiveCount: 5, minCheckins: 5, windowDays: 10, severity: "urgent" });
    expect(evaluateRule(r, days([3, 2, 3, 2, 3]), today)?.severity).toBe("urgent");
    expect(evaluateRule(r, days([3, 2, 6, 2, 3]), today)).toBeNull();
    const stale = days([2, 2, 2, 2, 2]).map((c) => ({ ...c, date: addDays(c.date, -4) }));
    expect(evaluateRule(r, stale, today)).toBeNull();
  });

  it("sorts matches by severity and deduplicates against open alerts", () => {
    const matches = evaluateRules(
      [rule({ id: "info", severity: "info", threshold: 6 }), rule({ id: "att", severity: "attention" })],
      days([4, 4, 4]),
      today,
    );
    expect(matches.map((m) => m.ruleId)).toEqual(["att", "info"]);
    expect(decideAlert(matches, [], today).action).toBe("create");
    expect(decideAlert(matches, [{ id: "a1", ruleId: "att", severity: "attention", status: "open", resolvedAt: null }], today).action).toBe("none");
    const esc = decideAlert(matches, [{ id: "a1", ruleId: "info", severity: "info", status: "acknowledged", resolvedAt: null }], today);
    expect(esc).toMatchObject({ action: "escalate", alertId: "a1" });
    expect(decideAlert(matches, [{ id: "a1", ruleId: "att", severity: "attention", status: "resolved", resolvedAt: addDays(today, -2) }], today).action).toBe("none");
    expect(decideAlert(matches, [{ id: "a1", ruleId: "att", severity: "attention", status: "resolved", resolvedAt: addDays(today, -30) }], today).action).toBe("create");
  });
});

describe("safety screen", () => {
  it("detects crisis language in English and Romanian (with or without diacritics)", () => {
    expect(screenText("I want to kill myself").level).toBe("crisis");
    expect(screenText("Nu mai vreau să trăiesc").level).toBe("crisis");
    expect(screenText("sa ma omor").level).toBe("crisis");
    expect(screenText("someone is hurting me at home").level).toBe("crisis");
  });
  it("detects distress as concern, and ignores ordinary text", () => {
    expect(screenText("I feel so hopeless about maths").level).toBe("concern");
    expect(screenText("nu mai pot cu temele").level).toBe("concern");
    expect(screenText("How do I solve 2x + 3 = 7?").level).toBe("none");
  });
});

describe("check-in helpers", () => {
  it("counts consecutive school-day streaks, skipping weekends", () => {
    // 2026-10-23 is a Friday.
    expect(streakOf(["2026-10-23", "2026-10-22", "2026-10-21"], "2026-10-23")).toBe(3);
    expect(streakOf(["2026-10-22", "2026-10-21"], "2026-10-23")).toBe(2); // today not done yet
    expect(streakOf(["2026-10-23", "2026-10-19"], "2026-10-26")).toBe(1); // Monday pending, Friday done, Thursday missing
    expect(streakOf(["2026-10-23", "2026-10-22"], "2026-10-25")).toBe(2); // Sunday
  });
  it("suggests talking to someone for low moods", () => {
    expect(suggestionsFor({ mood: 2, factors: [] }).map((s) => s.key)).toContain("talk");
    expect(suggestionsFor({ mood: 8, factors: ["tests"] }).map((s) => s.key)).toEqual(["plan", "journal"]);
  });
});
