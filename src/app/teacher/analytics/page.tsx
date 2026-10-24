import Link from "next/link";
import type { Metadata } from "next";
import { BarChart3, TrendingUp, LifeBuoy, ClipboardCheck, Gauge, Hash, Filter, Info, UsersRound } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { addDays, formatDate, todayIn } from "@/lib/dates";
import { getAssignments, getTeacherAnalytics, isIsoDate, SUPPORT_THRESHOLD, FALLING_DROP } from "@/lib/services/teacher";
import { BarsChart, DistributionBar, TrendChart } from "@/components/charts";
import { Avatar, Badge, Card, CardHeader, EmptyState, Notice, PageHeader, Stat, Table, Td, Th, buttonClass, gradeTone } from "@/components/ui";
import { Input, Label, Select } from "@/components/forms";
import { fmt, param, type SearchParams } from "../_components/selection";

export const metadata: Metadata = { title: "Academic analytics" };

export default async function AnalyticsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser(["teacher"]);
  const sp = await searchParams;
  const today = todayIn(user.timezone);
  const assignments = await getAssignments(user);

  if (assignments.length === 0) {
    return (
      <div className="animate-fade-up">
        <PageHeader title="Academic analytics" />
        <EmptyState icon={BarChart3} title="No subject assignments">Analytics appear once you teach a subject in a class.</EmptyState>
      </div>
    );
  }

  const classes = [...new Map(assignments.map((a) => [a.class_id, a.class_name])).entries()];
  const subjects = [...new Map(assignments.map((a) => [a.subject_id, a.subject_name])).entries()];
  const rawClass = param(sp, "class");
  const rawSubject = param(sp, "subject");
  const classId = classes.some(([id]) => id === rawClass) ? rawClass! : null;
  const subjectId = subjects.some(([id]) => id === rawSubject) ? rawSubject! : null;
  let from = param(sp, "from");
  let to = param(sp, "to");
  if (!to || !isIsoDate(to) || to > today) to = today;
  if (!from || !isIsoDate(from) || from > to) from = addDays(to, -89);
  const ignored = (rawClass && !classId) || (rawSubject && !subjectId);

  const a = await getTeacherAnalytics(user, { classId, subjectId, from, to });
  const maxBucket = Math.max(1, ...a.histogram.map((h) => h.value));

  return (
    <div className="animate-fade-up space-y-5">
      <PageHeader
        title="Academic analytics"
        description="Grades and attendance in the classes and subjects you teach. Academic data only — wellbeing information is never used here."
      />

      <Card>
        <form method="get" action="/teacher/analytics" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto_auto_auto] lg:items-end">
          <div>
            <Label htmlFor="f-class">Class</Label>
            <Select id="f-class" name="class" defaultValue={classId ?? ""}>
              <option value="">All my classes</option>
              {classes.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </Select>
          </div>
          <div>
            <Label htmlFor="f-subject">Subject</Label>
            <Select id="f-subject" name="subject" defaultValue={subjectId ?? ""}>
              <option value="">All my subjects</option>
              {subjects.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </Select>
          </div>
          <div>
            <Label htmlFor="f-from">From</Label>
            <Input id="f-from" type="date" name="from" defaultValue={from} max={today} />
          </div>
          <div>
            <Label htmlFor="f-to">To</Label>
            <Input id="f-to" type="date" name="to" defaultValue={to} max={today} />
          </div>
          <div className="flex gap-2">
            <button type="submit" className={buttonClass("primary", "md")}><Filter className="size-4" aria-hidden /> Apply</button>
            <Link href="/teacher/analytics" className={buttonClass("ghost", "md")}>Reset</Link>
          </div>
        </form>
        {ignored && <p className="mt-3 text-sm text-amber-800">A filter you don&apos;t have access to was ignored.</p>}
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Average grade" value={fmt(a.average)} icon={Gauge} tone={gradeTone(a.average)} hint="Weighted mean of all grades in range" />
        <Stat label="Grades recorded" value={a.gradeCount} icon={Hash} tone="blue" hint={`${formatDate(from)} – ${formatDate(to)}`} />
        <Stat label="Attendance rate" value={fmt(a.attendanceRate, "%")} icon={ClipboardCheck} tone="green" hint={`${a.attendanceRecords} records, present or late`} />
        <Stat label="May need support" value={new Set(a.flags.map((f) => f.studentId)).size} icon={LifeBuoy} tone="amber" hint={`of ${a.studentCount} students`} />
      </div>

      {a.gradeCount === 0 ? (
        <EmptyState icon={BarChart3} title="No grades in this range">Try a wider date range or a different class or subject.</EmptyState>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader title="Average by subject" icon={BarChart3} subtitle={`Bars below ${SUPPORT_THRESHOLD} are highlighted`} />
            <BarsChart title="Average grade by subject" data={a.subjectAverages} threshold={SUPPORT_THRESHOLD} />
            {a.classAverages.length > 1 && (
              <p className="mt-3 text-sm text-ink-600">
                By class: {a.classAverages.map((c, i) => <span key={c.label}>{i > 0 && " · "}{c.label} <strong className="text-ink-900">{fmt(c.value)}</strong></span>)}
              </p>
            )}
          </Card>
          <Card>
            <CardHeader title="Weekly average" icon={TrendingUp} subtitle="Weighted average of grades given each week" />
            <TrendChart title="Weekly average grade" data={a.weekly.map((w) => ({ label: w.label, value: w.value }))} threshold={SUPPORT_THRESHOLD} thresholdLabel={String(SUPPORT_THRESHOLD)} />
          </Card>
          <Card>
            <CardHeader title="Grade distribution" icon={Hash} subtitle={`${a.gradeCount} grades, rounded to the nearest whole grade`} />
            <DistributionBar title="Share of grades by band" buckets={a.distribution} />
            <div className="mt-4">
              <BarsChart title="Number of grades by score" data={a.histogram} domain={[0, maxBucket]} height={200} />
            </div>
          </Card>
          <Card>
            <CardHeader title="Attendance by class" icon={ClipboardCheck} subtitle="Your lessons only · present or late counts as attended" />
            {a.attendanceRecords === 0 ? (
              <p className="text-sm text-ink-500">No attendance recorded in this range.</p>
            ) : (
              <BarsChart title="Attendance rate by class" data={a.attendanceByClass} domain={[0, 100]} suffix="%" />
            )}
          </Card>
        </div>
      )}

      <Card>
        <CardHeader
          title="Students who may need academic support"
          icon={LifeBuoy}
          subtitle={`Average below ${SUPPORT_THRESHOLD}, or the last two grades at least ${FALLING_DROP} point below the earlier ones (4+ grades)`}
        />
        {a.flags.length === 0 ? (
          <EmptyState icon={UsersRound} title="No one flagged">Nobody in this selection is below {SUPPORT_THRESHOLD} or on a falling trend.</EmptyState>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Student</Th>
                <Th>Class · subject</Th>
                <Th className="text-right">Average</Th>
                <Th className="text-right">Grades</Th>
                <Th>Why</Th>
                <Th><span className="sr-only">Open gradebook</span></Th>
              </tr>
            </thead>
            <tbody>
              {a.flags.map((f) => (
                <tr key={`${f.studentId}:${f.classId}:${f.subjectId}`}>
                  <Td>
                    <span className="flex items-center gap-2.5">
                      <Avatar name={f.displayName} color={f.avatarColor} emoji={f.avatarEmoji} size="sm" />
                      <span className="whitespace-nowrap font-semibold text-ink-900">{f.displayName}</span>
                    </span>
                  </Td>
                  <Td className="whitespace-nowrap">{f.className} · {f.subjectName}</Td>
                  <Td className="text-right"><Badge tone={gradeTone(f.average)}>{f.average}</Badge></Td>
                  <Td className="text-right">{f.gradeCount}</Td>
                  <Td className="text-sm text-ink-600">{f.reasons.join("; ")}</Td>
                  <Td className="text-right">
                    <Link href={`/teacher/gradebook?class=${f.classId}&subject=${f.subjectId}`} className="whitespace-nowrap text-sm font-semibold text-brand-700 hover:underline">Gradebook</Link>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        <div className="mt-4">
          <Notice tone="neutral" icon={Info}>
            These flags are based on grades only and are a prompt for a conversation or extra practice — not a judgement.
          </Notice>
        </div>
      </Card>
    </div>
  );
}
