import Link from "next/link";
import type { Metadata } from "next";
import clsx from "clsx";
import { HeartPulse, ShieldCheck, EyeOff, School } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { formatDate } from "@/lib/dates";
import { CHECKIN_FACTORS } from "@/lib/constants";
import { getTeacherWellbeing, WELLBEING_WINDOWS, type WellbeingWindow } from "@/lib/services/teacher";
import { DistributionBar, TrendChart } from "@/components/charts";
import { Badge, Card, CardHeader, EmptyState, Notice, PageHeader, moodTone } from "@/components/ui";
import { param, type SearchParams } from "../_components/selection";

export const metadata: Metadata = { title: "Class wellbeing" };

export default async function TeacherWellbeingPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser(["teacher"]);
  const sp = await searchParams;
  const requested = Number(param(sp, "days"));
  const days: WellbeingWindow = (WELLBEING_WINDOWS as readonly number[]).includes(requested) ? (requested as WellbeingWindow) : 14;
  const data = await getTeacherWellbeing(user, days);

  return (
    <div className="animate-fade-up space-y-5">
      <PageHeader
        title="Class wellbeing"
        description="Anonymous, class-level trends from students' daily check-ins, to help you plan workload and the classroom climate."
      />

      <Notice tone="pink" icon={ShieldCheck} title="Individual check-ins are private">
        <p>
          You only see totals for a whole class — never an individual student&apos;s check-ins, scores or notes. A class is hidden
          whenever fewer than 5 students checked in during the period, so nobody can be identified.
        </p>
        <p className="mt-1.5">
          If you are worried about a particular student, follow your school&apos;s safeguarding procedure and speak with the
          designated counselor. Authorised counselors handle individual concerns.
        </p>
      </Notice>

      <nav aria-label="Time period" className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-ink-700">Period:</span>
        <ul className="flex gap-1 rounded-2xl bg-white p-1 ring-1 ring-ink-100">
          {WELLBEING_WINDOWS.map((d) => (
            <li key={d}>
              <Link
                href={`/teacher/wellbeing?days=${d}`}
                aria-current={d === days ? "page" : undefined}
                className={clsx("block rounded-xl px-3.5 py-1.5 text-sm font-semibold", d === days ? "bg-brand-600 text-white" : "text-ink-600 hover:bg-ink-50")}
              >
                {d} days
              </Link>
            </li>
          ))}
        </ul>
        <span className="text-sm text-ink-500">{formatDate(data.from)} – {formatDate(data.to)}</span>
      </nav>

      {data.classes.length === 0 ? (
        <EmptyState icon={School} title="No classes assigned yet">Class wellbeing appears for classes you teach or are homeroom teacher for.</EmptyState>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {data.classes.map(({ class: c, summary: s }) => (
            <Card key={c.id} as="article">
              <CardHeader
                title={<>Class {c.name} {c.is_homeroom && <Badge tone="pink" className="ml-1 align-middle">Homeroom</Badge>}</>}
                icon={HeartPulse}
                subtitle={`${s.students_reporting} of ${s.students_total} students checked in`}
              />
              {s.suppressed ? (
                <Notice tone="neutral" icon={EyeOff} title="Not enough check-ins to show">
                  Fewer than {s.k} students checked in during this period, so the class summary is hidden to protect their privacy.
                  Try a longer period.
                </Notice>
              ) : (
                <div className="space-y-5">
                  <div className="flex flex-wrap items-end gap-6">
                    <div>
                      <p className="text-sm font-medium text-ink-500">Average mood</p>
                      <p className="text-3xl font-extrabold tracking-tight text-ink-900">
                        {s.average ?? "—"}<span className="text-base font-semibold text-ink-400">/10</span>
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-ink-500">Check-ins</p>
                      <p className="text-3xl font-extrabold tracking-tight text-ink-900">{s.checkins ?? 0}</p>
                    </div>
                    {s.average != null && <Badge tone={moodTone(s.average)}>{s.average >= 7 ? "Mostly positive" : s.average >= 5 ? "Mixed" : "Lower than usual"}</Badge>}
                  </div>

                  {s.distribution && (
                    <div>
                      <p className="mb-2 text-sm font-semibold text-ink-800">How check-ins were rated</p>
                      <DistributionBar
                        title={`Check-in ratings for class ${c.name}`}
                        buckets={[
                          { label: "1–3", value: s.distribution.low },
                          { label: "4–6", value: s.distribution.mid },
                          { label: "7–10", value: s.distribution.high },
                        ]}
                      />
                    </div>
                  )}

                  {s.weekly && s.weekly.length > 1 && (
                    <div>
                      <p className="mb-2 text-sm font-semibold text-ink-800">Weekly average</p>
                      <TrendChart
                        title={`Weekly average mood for class ${c.name}`}
                        data={s.weekly.map((w) => ({ label: `w/c ${formatDate(w.week_start)}`, value: w.average }))}
                        height={180}
                      />
                      {s.weekly.some((w) => w.average === null) && (
                        <p className="mt-1 text-xs text-ink-500">Weeks with fewer than {s.k} students are left blank.</p>
                      )}
                    </div>
                  )}

                  <div>
                    <p className="mb-2 text-sm font-semibold text-ink-800">What students mentioned most</p>
                    {s.factors && s.factors.length > 0 ? (
                      <ul className="flex flex-wrap gap-2">
                        {s.factors.slice(0, 6).map((f) => (
                          <li key={f.factor}>
                            <Badge tone="neutral" className="text-sm">{CHECKIN_FACTORS[f.factor] ?? f.factor} · {f.students} students</Badge>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-ink-500">No topic was mentioned by 3 or more students.</p>
                    )}
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <p className="text-xs text-ink-500">
        Topics are shown only when at least 3 students mentioned them. Viewing this page is recorded in the school&apos;s audit log.
      </p>
    </div>
  );
}
