"use client";

import { useMemo, useState } from "react";
import { Calculator } from "lucide-react";
import { requiredScore } from "@/lib/engines/grades";
import { Badge } from "@/components/ui";
import { inputClass } from "@/components/forms";

export interface CalcSubject {
  id: string;
  name: string;
  grades: Array<{ score: number; weight: number }>;
}

export function GradeCalculator({ subjects }: { subjects: CalcSubject[] }) {
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? "");
  const [target, setTarget] = useState(8);
  const [count, setCount] = useState(2);
  const [weight, setWeight] = useState(1);
  const subject = subjects.find((s) => s.id === subjectId);
  const result = useMemo(
    () => requiredScore({ current: subject?.grades ?? [], target, upcomingCount: count, upcomingWeight: weight }),
    [subject, target, count, weight],
  );
  const tone = result.status === "already_met" ? "green" : result.status === "achievable" ? "blue" : result.status === "out_of_reach" ? "red" : "neutral";

  return (
    <section aria-labelledby="calc-title" className="rounded-2xl bg-white p-5 shadow-[var(--shadow-card)] ring-1 ring-ink-100">
      <h2 id="calc-title" className="flex items-center gap-2 text-base font-bold"><Calculator className="size-5 text-brand-600" aria-hidden /> Target grade calculator</h2>
      <p className="mt-1 text-sm text-ink-500">What do I need on my next grades to reach my target average?</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-semibold">
          Subject
          <select className={`${inputClass} mt-1`} value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <label className="text-sm font-semibold">
          Target average
          <input className={`${inputClass} mt-1`} type="number" min={1} max={10} step={0.1} value={target} onChange={(e) => setTarget(Number(e.target.value))} />
        </label>
        <label className="text-sm font-semibold">
          Upcoming grades
          <input className={`${inputClass} mt-1`} type="number" min={1} max={10} value={count} onChange={(e) => setCount(Math.max(1, Number(e.target.value)))} />
        </label>
        <label className="text-sm font-semibold">
          Weight of each
          <select className={`${inputClass} mt-1`} value={weight} onChange={(e) => setWeight(Number(e.target.value))}>
            <option value={1}>1 (regular grade)</option>
            <option value={2}>2 (test / thesis)</option>
          </select>
        </label>
      </div>
      <div className="mt-4 rounded-xl bg-ink-50 p-4" aria-live="polite">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-ink-600">Current average: <strong className="text-ink-900">{result.currentAverage ?? "no grades yet"}</strong></span>
          {result.needed !== null && (
            <span className="text-sm text-ink-600">
              Needed on each: <Badge tone={tone} className="text-sm">{result.status === "already_met" ? "any grade" : result.needed}</Badge>
            </span>
          )}
        </div>
        <p className="mt-2 text-sm text-ink-700">{result.explanation}</p>
      </div>
      <p className="mt-3 text-xs text-ink-500">
        Uses the weighted mean: Σ(grade × weight) ÷ Σ(weight). Your school may round final averages (for example 9.50 → 10); the calculator shows exact values.
      </p>
    </section>
  );
}
