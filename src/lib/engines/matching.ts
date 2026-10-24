// Deterministic, explainable peer matching. Works without any AI provider.
//
// Only declared, non-sensitive preferences are used: interests, goals,
// learning style, what the student is open to, and grade level (to keep
// matches age-appropriate). Wellbeing data, grades, gender, ethnicity,
// religion or any other protected attribute are never inputs.

import { GOAL_OPTIONS, LEARNING_STYLES, OPEN_TO } from "../constants";

export interface MatchProfile {
  id: string;
  gradeLevel: number | null;
  interests: number[];
  goals: string[];
  learningStyle: string | null;
  openTo: string[];
}

export interface MatchCandidate extends MatchProfile {
  discoverable: boolean;
}

export interface MatchExclusions {
  blocked: Set<string>;      // blocks in either direction
  existing: Set<string>;     // pending or accepted connections
  dismissed: Set<string>;
}

export interface MatchBreakdown {
  interests: number;
  goals: number;
  learningStyle: number;
  openTo: number;
  grade: number;
}

export interface MatchResult {
  id: string;
  score: number;             // 0–100
  sharedInterests: number[];
  sharedGoals: string[];
  breakdown: MatchBreakdown;
  reasons: string[];
}

/** Maximum grade-level difference for a recommendation (keeps peers close in age). */
export const MAX_GRADE_GAP = 2;
/** Minimum score for a candidate to be recommended at all. */
export const MIN_SCORE = 20;

export const WEIGHTS = {
  interestJaccard: 45,   // share of combined interests that overlap
  interestCount: 21,     // 7 points per shared interest, up to 3
  goals: 16,             // 8 points per shared goal, up to 2
  learningStyle: 6,
  openTo: 6,
  grade: 6,
} as const;

export function scoreMatch(me: MatchProfile, other: MatchProfile, interestLabel: (id: number) => string = String): MatchResult {
  const mine = new Set(me.interests);
  const shared = other.interests.filter((i) => mine.has(i));
  const union = new Set([...me.interests, ...other.interests]).size;
  const jaccard = union === 0 ? 0 : shared.length / union;
  const interests = WEIGHTS.interestJaccard * jaccard + (WEIGHTS.interestCount / 3) * Math.min(shared.length, 3);

  const sharedGoals = other.goals.filter((g) => me.goals.includes(g));
  const goals = (WEIGHTS.goals / 2) * Math.min(sharedGoals.length, 2);

  let learningStyle = 0;
  if (me.learningStyle && other.learningStyle) {
    if (me.learningStyle === other.learningStyle) learningStyle = WEIGHTS.learningStyle;
    else if (me.learningStyle === "mixed" || other.learningStyle === "mixed") learningStyle = WEIGHTS.learningStyle / 2;
  }

  const sharedOpenTo = other.openTo.filter((o) => me.openTo.includes(o));
  const openTo = sharedOpenTo.length > 0 ? WEIGHTS.openTo : 0;

  let grade = 0;
  if (me.gradeLevel !== null && other.gradeLevel !== null) {
    const gap = Math.abs(me.gradeLevel - other.gradeLevel);
    grade = gap === 0 ? WEIGHTS.grade : gap === 1 ? WEIGHTS.grade / 2 : 0;
  }

  const breakdown: MatchBreakdown = {
    interests: Math.round(interests),
    goals: Math.round(goals),
    learningStyle: Math.round(learningStyle),
    openTo: Math.round(openTo),
    grade: Math.round(grade),
  };
  const score = Math.min(100, Object.values(breakdown).reduce((a, b) => a + b, 0));

  const reasons: string[] = [];
  if (shared.length > 0) reasons.push(`You both like ${listJoin(shared.map(interestLabel))}`);
  if (sharedGoals.length > 0) reasons.push(`Shared goal: ${listJoin(sharedGoals.map((g) => GOAL_OPTIONS[g] ?? g))}`);
  if (learningStyle === WEIGHTS.learningStyle && me.learningStyle)
    reasons.push(`Similar way of learning (${(LEARNING_STYLES[me.learningStyle] ?? me.learningStyle).split(" — ")[0].toLowerCase()})`);
  if (sharedOpenTo.length > 0) reasons.push(`Both open to ${listJoin(sharedOpenTo.map((o) => (OPEN_TO[o] ?? o).toLowerCase()))}`);

  return { id: other.id, score, sharedInterests: shared, sharedGoals, breakdown, reasons };
}

/** Rank eligible candidates for `me`. Eligibility rules are applied before scoring. */
export function recommendPeers(
  me: MatchProfile,
  candidates: MatchCandidate[],
  exclusions: MatchExclusions,
  options: { limit?: number; interestLabel?: (id: number) => string } = {},
): MatchResult[] {
  const results: MatchResult[] = [];
  for (const c of candidates) {
    if (!isEligible(me, c, exclusions)) continue;
    const r = scoreMatch(me, c, options.interestLabel);
    // Require *some* genuine common ground, not just matching grade or style.
    if (r.sharedInterests.length === 0 && r.sharedGoals.length === 0) continue;
    if (r.score < MIN_SCORE) continue;
    results.push(r);
  }
  results.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  return results.slice(0, options.limit ?? 12);
}

export function isEligible(me: MatchProfile, c: MatchCandidate, ex: MatchExclusions): boolean {
  if (c.id === me.id) return false;
  if (!c.discoverable) return false;
  if (ex.blocked.has(c.id) || ex.existing.has(c.id) || ex.dismissed.has(c.id)) return false;
  if (me.gradeLevel !== null && c.gradeLevel !== null && Math.abs(me.gradeLevel - c.gradeLevel) > MAX_GRADE_GAP) return false;
  return true;
}

export interface GroupCandidate {
  id: string;
  interestIds: number[];
  subjectId: string | null;
  memberCount: number;
  maxMembers: number;
}

export interface GroupRecommendation {
  id: string;
  score: number;
  reasons: string[];
}

/** Recommend open study groups by interest overlap and subjects the student wants to practise. */
export function recommendGroups(
  interests: number[],
  practiceSubjectIds: string[],
  groups: GroupCandidate[],
  joined: Set<string>,
  interestLabel: (id: number) => string = String,
  subjectLabel: (id: string) => string = String,
): GroupRecommendation[] {
  const mine = new Set(interests);
  const out: GroupRecommendation[] = [];
  for (const g of groups) {
    if (joined.has(g.id) || g.memberCount >= g.maxMembers) continue;
    const shared = g.interestIds.filter((i) => mine.has(i));
    const practice = g.subjectId !== null && practiceSubjectIds.includes(g.subjectId);
    const score = shared.length * 20 + (practice ? 35 : 0);
    if (score === 0) continue;
    const reasons: string[] = [];
    if (practice && g.subjectId) reasons.push(`Practise ${subjectLabel(g.subjectId)} together`);
    if (shared.length) reasons.push(`Matches your interest in ${listJoin(shared.map(interestLabel))}`);
    out.push({ id: g.id, score: Math.min(100, score), reasons });
  }
  return out.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}

function listJoin(items: string[]): string {
  if (items.length <= 1) return items.join("");
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}
