import type { Metadata } from "next";
import { Info } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { formatDate } from "@/lib/dates";
import { getStudentAcademics } from "@/lib/services/academics";
import { Badge, Card, DemoBadge, EmptyState, Notice, PageHeader, gradeTone } from "@/components/ui";
import { TrendChart } from "@/components/charts";
import { AcademicsNav } from "../nav";
import { GradeCalculator } from "./calculator";

export const metadata: Metadata = { title: "Grades" };

export default async function GradesPage() {
  const user = await requireUser(["student"]);
  const a = await getStudentAcademics(user);
  const withGrades = a.subjects.filter((s) => s.grades.length > 0);

  // Running overall average after each grading date, for the trend line.
  const dates = [...new Set(a.grades.map((g) => g.graded_on))].sort();
  const trend = dates.map((d) => {
    const upTo = a.grades.filter((g) => g.graded_on <= d);
    const bySubject = new Map<string, { s: number; w: number }>();
    for (const g of upTo) {
      const cur = bySubject.get(g.subject_id) ?? { s: 0, w: 0 };
      bySubject.set(g.subject_id, { s: cur.s + g.score * g.weight, w: cur.w + g.weight });
    }
    const avgs = [...bySubject.values()].map((v) => v.s / v.w);
    return { label: formatDate(d), value: Math.round((avgs.reduce((x, y) => x + y, 0) / avgs.length) * 100) / 100 };
  });

  return (
    <div className="animate-fade-up">
      <PageHeader eyebrow="Academics" title="Grades & calculator" description="Every grade your teachers have entered, and how your averages are calculated." actions={a.grades.some((g) => g.is_demo) ? <DemoBadge /> : undefined} />
      <AcademicsNav />

      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        <div className="space-y-5">
          {trend.length > 1 && (
            <Card>
              <h2 className="mb-3 font-bold">Overall average over time</h2>
              <TrendChart title="Overall average" data={trend} domain={[1, 10]} />
            </Card>
          )}
          {withGrades.length === 0 ? (
            <EmptyState title="No grades yet">Grades appear here once your teachers add them.</EmptyState>
          ) : (
            withGrades.map((s) => (
              <Card key={s.subjectId}>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="font-bold">{s.name}</h2>
                  <span className="text-sm text-ink-500">Average <Badge tone={gradeTone(s.average)} className="ml-1 text-sm">{s.average}</Badge></span>
                </div>
                <ul className="flex flex-wrap gap-2">
                  {s.grades.map((g) => (
                    <li key={g.id} className="rounded-xl bg-ink-50 px-3 py-2 text-center" title={g.comment ?? undefined}>
                      <span className="block text-lg font-extrabold leading-none text-ink-900">{g.score}</span>
                      <span className="mt-1 block text-[11px] text-ink-500">{formatDate(g.graded_on)} · {g.kind}{g.weight !== 1 ? ` ×${g.weight}` : ""}</span>
                    </li>
                  ))}
                </ul>
                {s.grades.some((g) => g.comment) && (
                  <ul className="mt-3 space-y-1 text-sm text-ink-600">
                    {s.grades.filter((g) => g.comment).map((g) => <li key={g.id}>“{g.comment}” — {formatDate(g.graded_on)}</li>)}
                  </ul>
                )}
              </Card>
            ))
          )}
        </div>
        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          {withGrades.length > 0 && <GradeCalculator subjects={withGrades.map((s) => ({ id: s.subjectId, name: s.name, grades: s.grades.map((g) => ({ score: g.score, weight: g.weight })) }))} />}
          <Notice tone="blue" icon={Info} title="How averages work">
            <p>Subject average = Σ(grade × weight) ÷ Σ(weight). Tests marked ×2 count twice.</p>
            <p className="mt-1">Overall average = the mean of your subject averages.</p>
          </Notice>
        </aside>
      </div>
    </div>
  );
}
