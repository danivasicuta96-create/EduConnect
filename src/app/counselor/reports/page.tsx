import type { Metadata } from "next";
import { ChartLine, EyeOff, Info, School, UsersRound } from "lucide-react";
import { requirePermission, requireUser } from "@/lib/auth/session";
import { formatDate } from "@/lib/dates";
import { CHECKIN_FACTORS } from "@/lib/constants";
import { PERMS, REPORT_PERIODS, getAggregateReport, type Summary } from "@/lib/services/counselor";
import { Badge, Card, CardHeader, EmptyState, Notice, PageHeader, Stat, moodTone } from "@/components/ui";
import { BarsChart, DistributionBar, TrendChart } from "@/components/charts";
import { FilterPills, param } from "../_components/shared";

export const metadata: Metadata = { title: "Aggregate reports" };

function distribution(s: Summary) {
  const d = s.distribution ?? { low: 0, mid: 0, high: 0 };
  return [
    { label: "Low (1–3)", value: d.low },
    { label: "Middle (4–6)", value: d.mid },
    { label: "High (7–10)", value: d.high },
  ];
}

function factorPoints(s: Summary) {
  return (s.factors ?? []).map((f) => ({ label: CHECKIN_FACTORS[f.factor] ?? f.factor, value: f.students }));
}

function Suppressed({ k }: { k: number }) {
  return (
    <div className="flex items-start gap-2 rounded-xl bg-ink-50 p-3 text-sm text-ink-600">
      <EyeOff className="mt-0.5 size-4 shrink-0" aria-hidden />
      <p>
        <strong className="text-ink-800">Hidden to protect privacy.</strong> Fewer than {k} students checked in during this period, so
        results could identify individuals.
      </p>
    </div>
  );
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireUser(["counselor"]);
  const user = await requirePermission(PERMS.aggregate);
  const days = Number(param((await searchParams).days) ?? 14);
  const report = await getAggregateReport(user, days);
  const s = report.school;
  const maxFactor = Math.max(1, ...(s.factors ?? []).map((f) => f.students));

  return (
    <div className="space-y-6 animate-fade-up">
      <PageHeader
        title="Aggregate reports"
        description={`School-wide and per-class wellbeing, ${formatDate(report.from)} – ${formatDate(report.to)}. No individual students are ever shown.`}
      />
      <FilterPills
        label="Report period"
        items={REPORT_PERIODS.map((p) => ({ href: `/counselor/reports?days=${p}`, label: `Last ${p} days`, active: p === report.period }))}
      />

      <Notice tone="blue" icon={Info} title="How privacy is protected">
        Any group with fewer than {s.k} reporting students is hidden, weekly points with fewer than {s.k} students are left blank, and factors
        mentioned by fewer than 3 students are not listed. Scores are self-reported and are not a measure of mental health.
      </Notice>

      <Card>
        <CardHeader title="Whole school" icon={School} />
        {s.suppressed ? (
          <Suppressed k={s.k} />
        ) : (
          <div className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-3">
              <Stat label="Students reporting" value={`${s.students_reporting} / ${s.students_total}`} icon={UsersRound} tone="blue" />
              <Stat label="Check-ins" value={s.checkins ?? 0} icon={ChartLine} tone="violet" />
              <Stat label="Average mood" value={s.average !== null && s.average !== undefined ? `${s.average}/10` : "—"} icon={ChartLine} tone={moodTone(s.average ?? null)} />
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <div>
                <h3 className="mb-2 text-sm font-bold text-ink-800">Weekly average</h3>
                {(s.weekly ?? []).length === 0 ? (
                  <p className="text-sm text-ink-500">No weekly data.</p>
                ) : (
                  <TrendChart data={(s.weekly ?? []).map((w) => ({ label: `w/c ${formatDate(w.week_start)}`, value: w.average }))} title="Weekly average mood, whole school" height={200} />
                )}
              </div>
              <div>
                <h3 className="mb-2 text-sm font-bold text-ink-800">Factors students mentioned</h3>
                {factorPoints(s).length === 0 ? (
                  <p className="text-sm text-ink-500">No factor was mentioned by 3 or more students.</p>
                ) : (
                  <BarsChart data={factorPoints(s)} title="Number of students mentioning each factor" domain={[0, maxFactor]} height={220} />
                )}
              </div>
            </div>
            <div>
              <h3 className="mb-2 text-sm font-bold text-ink-800">Distribution of check-ins</h3>
              <DistributionBar buckets={distribution(s)} title="Distribution of check-in scores, whole school" />
            </div>
          </div>
        )}
      </Card>

      <section aria-labelledby="classes-heading">
        <h2 id="classes-heading" className="mb-3 text-lg font-bold text-ink-900">By class</h2>
        {report.classes.length === 0 ? (
          <EmptyState icon={UsersRound} title="No classes yet">Classes appear once an administrator sets them up.</EmptyState>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {report.classes.map((c) => {
              const cs = c.summary;
              return (
                <Card key={c.id}>
                  <CardHeader
                    title={`Class ${c.name}`}
                    subtitle={`Grade ${c.gradeLevel} · ${cs.students_total} students`}
                    action={!cs.suppressed && cs.average !== null && cs.average !== undefined ? <Badge tone={moodTone(cs.average)}>{cs.average}/10</Badge> : undefined}
                  />
                  {cs.suppressed ? (
                    <Suppressed k={cs.k} />
                  ) : (
                    <div className="space-y-4">
                      <p className="text-sm text-ink-600">
                        {cs.students_reporting} of {cs.students_total} students · {cs.checkins} check-ins
                      </p>
                      <DistributionBar buckets={distribution(cs)} title={`Distribution of check-in scores, class ${c.name}`} />
                      {factorPoints(cs).length > 0 ? (
                        <div>
                          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-500">Most mentioned factors</h3>
                          <ul className="flex flex-wrap gap-1.5">
                            {factorPoints(cs).slice(0, 4).map((f) => (
                              <li key={f.label}><Badge>{f.label} · {f.value}</Badge></li>
                            ))}
                          </ul>
                        </div>
                      ) : (
                        <p className="text-xs text-ink-500">No factor was mentioned by 3 or more students.</p>
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
