// Grade calculations on the Romanian 1–10 scale. Every function is pure and
// documented so the UI can explain exactly how a number was produced.

export interface GradeLike {
  score: number;
  weight?: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Weighted arithmetic mean: Σ(score × weight) ÷ Σ(weight). Null when there are no grades. */
export function subjectAverage(grades: GradeLike[]): number | null {
  if (grades.length === 0) return null;
  let sum = 0;
  let weights = 0;
  for (const g of grades) {
    const w = g.weight ?? 1;
    sum += g.score * w;
    weights += w;
  }
  return weights === 0 ? null : round2(sum / weights);
}

/** Overall average: the plain mean of the subject averages that exist. */
export function overallAverage(subjectAverages: Array<number | null>): number | null {
  const present = subjectAverages.filter((a): a is number => a !== null);
  if (present.length === 0) return null;
  return round2(present.reduce((a, b) => a + b, 0) / present.length);
}

export interface RequiredScoreInput {
  current: GradeLike[];
  target: number;
  upcomingCount: number;
  upcomingWeight?: number;
}

export interface RequiredScoreResult {
  /** The score needed on *each* upcoming grade, or null if it cannot be computed. */
  needed: number | null;
  status: "already_met" | "achievable" | "out_of_reach" | "invalid";
  currentAverage: number | null;
  explanation: string;
}

/**
 * Solve for the score x needed on each of k upcoming grades (weight w) so that
 * the new weighted average reaches the target T:
 *
 *   (S + k·w·x) ÷ (W + k·w) = T   ⇒   x = (T·(W + k·w) − S) ÷ (k·w)
 *
 * where S = Σ(score × weight) and W = Σ(weight) of the existing grades.
 */
export function requiredScore({ current, target, upcomingCount, upcomingWeight = 1 }: RequiredScoreInput): RequiredScoreResult {
  const currentAverage = subjectAverage(current);
  if (!(target >= 1 && target <= 10) || !(upcomingCount >= 1) || !(upcomingWeight > 0)) {
    return { needed: null, status: "invalid", currentAverage, explanation: "Choose a target between 1 and 10 and at least one upcoming grade." };
  }
  const S = current.reduce((acc, g) => acc + g.score * (g.weight ?? 1), 0);
  const W = current.reduce((acc, g) => acc + (g.weight ?? 1), 0);
  const kw = upcomingCount * upcomingWeight;
  const raw = (target * (W + kw) - S) / kw;
  const needed = Math.ceil(raw * 100) / 100;
  const formula = `(${target} × (${round2(W)} + ${round2(kw)}) − ${round2(S)}) ÷ ${round2(kw)} = ${round2(raw)}`;

  if (raw <= 1) {
    return {
      needed: 1,
      status: "already_met",
      currentAverage,
      explanation: `You will stay at or above ${target} even with the lowest possible grade. Calculation: ${formula}.`,
    };
  }
  if (raw > 10) {
    return {
      needed,
      status: "out_of_reach",
      currentAverage,
      explanation: `You would need ${needed} on each grade, which is above 10. Try adding more upcoming grades or a nearer target. Calculation: ${formula}.`,
    };
  }
  return {
    needed,
    status: "achievable",
    currentAverage,
    explanation: `Score at least ${needed} on each of the next ${upcomingCount} grade${upcomingCount > 1 ? "s" : ""}. Calculation: ${formula}.`,
  };
}

export interface SubjectSnapshot {
  subjectId: string;
  subjectName: string;
  grades: Array<GradeLike & { gradedOn: string }>;
}

export interface PracticeRecommendation {
  subjectId: string;
  subjectName: string;
  average: number;
  reason: string;
}

/**
 * Suggest subjects that may benefit from practice: an average below 7, or the
 * latest grades trending at least half a point below the earlier ones.
 */
export function practiceRecommendations(subjects: SubjectSnapshot[]): PracticeRecommendation[] {
  const out: PracticeRecommendation[] = [];
  for (const s of subjects) {
    const avg = subjectAverage(s.grades);
    if (avg === null) continue;
    const sorted = [...s.grades].sort((a, b) => a.gradedOn.localeCompare(b.gradedOn));
    let reason: string | null = null;
    if (avg < 7) {
      reason = `Average of ${avg} — a little extra practice could help.`;
    } else if (sorted.length >= 4) {
      const recent = subjectAverage(sorted.slice(-2))!;
      const earlier = subjectAverage(sorted.slice(0, -2))!;
      if (earlier - recent >= 0.5) reason = `Recent grades (${recent}) are below your earlier ones (${earlier}).`;
    }
    if (reason) out.push({ subjectId: s.subjectId, subjectName: s.subjectName, average: avg, reason });
  }
  return out.sort((a, b) => a.average - b.average);
}

export function attendanceRate(records: Array<{ status: string }>): number | null {
  if (records.length === 0) return null;
  const attended = records.filter((r) => r.status === "present" || r.status === "late").length;
  return Math.round((attended / records.length) * 1000) / 10;
}
