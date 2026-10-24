import Link from "next/link";
import type { Metadata } from "next";
import { GraduationCap, ClipboardCheck, CalendarClock, Target, Lightbulb, Check, Trash2 } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { formatDate, daysBetween, todayIn } from "@/lib/dates";
import { getStudentAcademics, listGoals } from "@/lib/services/academics";
import { Badge, Card, CardHeader, DemoBadge, EmptyState, LinkButton, PageHeader, Stat, gradeTone } from "@/components/ui";
import { ActionButton } from "@/components/forms";
import { BarsChart } from "@/components/charts";
import { AcademicsNav } from "./nav";
import { GoalForm } from "./goal-form";
import { deleteGoalAction, toggleGoalAction } from "./actions";

export const metadata: Metadata = { title: "Academics" };

export default async function AcademicsPage() {
  const user = await requireUser(["student"]);
  const [a, goals] = await Promise.all([getStudentAcademics(user), listGoals(user)]);
  const today = todayIn(user.timezone);
  const hasDemo = a.grades.some((g) => g.is_demo);

  return (
    <div className="animate-fade-up">
      <PageHeader eyebrow={a.className ? `Class ${a.className}` : "Learning"} title="Academics" description="Your subjects, averages, attendance and what's coming up." actions={hasDemo ? <DemoBadge /> : undefined} />
      <AcademicsNav />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Overall average" value={a.overall ?? "—"} hint="mean of subject averages" icon={GraduationCap} />
        <Stat label="Attendance" value={a.attendanceRate !== null ? `${a.attendanceRate}%` : "—"} hint="present or late" icon={ClipboardCheck} tone="green" />
        <Stat label="Coming up" value={a.upcoming.length} hint="tests & projects in 30 days" icon={CalendarClock} tone="amber" />
        <Stat label="Goals" value={`${goals.filter((g) => g.done).length}/${goals.length}`} hint="completed" icon={Target} tone="pink" />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Subject averages" icon={GraduationCap} action={<Link href="/student/academics/grades" className="text-sm font-semibold text-brand-700 hover:underline">Details</Link>} />
          {a.subjects.every((s) => s.average === null) ? (
            <EmptyState title="No grades yet" />
          ) : (
            <BarsChart title="Average per subject" data={a.subjects.map((s) => ({ label: s.name.replace(" Language", ""), value: s.average }))} domain={[0, 10]} threshold={5} />
          )}
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {a.subjects.map((s) => (
              <li key={s.subjectId} className="flex items-center justify-between rounded-xl bg-ink-50 px-3 py-2 text-sm">
                <span className="font-semibold">{s.name}</span>
                <Badge tone={gradeTone(s.average)}>{s.average ?? "—"}</Badge>
              </li>
            ))}
          </ul>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Coming up" icon={CalendarClock} />
            {a.upcoming.length === 0 ? (
              <p className="text-sm text-ink-500">Nothing scheduled in the next 30 days.</p>
            ) : (
              <ul className="space-y-2.5">
                {a.upcoming.slice(0, 6).map((u) => {
                  const d = daysBetween(today, u.due_date);
                  return (
                    <li key={u.id} className="flex items-start justify-between gap-2">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{u.title}</span>
                        <span className="block text-xs text-ink-500">{formatDate(u.due_date, { weekday: "short", day: "numeric", month: "short" })} · {u.kind}</span>
                      </span>
                      <Badge tone={d <= 3 ? "red" : d <= 7 ? "amber" : "neutral"}>{d === 0 ? "today" : d === 1 ? "tomorrow" : `in ${d} d`}</Badge>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
          <Card>
            <CardHeader title="Where to practise" icon={Lightbulb} />
            {a.recommendations.length === 0 ? (
              <p className="text-sm text-ink-500">You&apos;re doing well across your subjects. Keep it up!</p>
            ) : (
              <ul className="space-y-3">
                {a.recommendations.slice(0, 3).map((r) => (
                  <li key={r.subjectId} className="text-sm">
                    <p className="font-semibold">{r.subjectName}</p>
                    <p className="text-ink-600">{r.reason}</p>
                  </li>
                ))}
              </ul>
            )}
            {a.recommendations.length > 0 && <LinkButton href="/student/tutor" variant="soft" size="sm" className="mt-3">Practise with the AI tutor</LinkButton>}
          </Card>
        </div>

        <Card className="lg:col-span-3">
          <CardHeader title="My learning goals" icon={Target} />
          <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
            {goals.length === 0 ? (
              <EmptyState icon={Target} title="No goals yet">Set a goal like “Reach an 8 in Physics this term”.</EmptyState>
            ) : (
              <ul className="space-y-2">
                {goals.map((g) => (
                  <li key={g.id} className="flex items-center gap-3 rounded-xl bg-ink-50 px-3 py-2.5">
                    <ActionButton action={toggleGoalAction} hidden={{ id: g.id }} variant={g.done ? "primary" : "secondary"} className="size-8 px-0" title={g.done ? "Mark as not done" : "Mark as done"}>
                      <Check className="size-4" aria-hidden />
                      <span className="sr-only">{g.done ? "Mark as not done" : "Mark as done"}</span>
                    </ActionButton>
                    <span className="min-w-0 flex-1">
                      <span className={g.done ? "block text-sm font-semibold text-ink-500 line-through" : "block text-sm font-semibold"}>{g.title}</span>
                      {(g.subject_name || g.target_average) && (
                        <span className="block text-xs text-ink-500">
                          {g.subject_name}
                          {g.target_average ? ` · target ${g.target_average}` : ""}
                        </span>
                      )}
                    </span>
                    <ActionButton action={deleteGoalAction} hidden={{ id: g.id }} variant="ghost" className="size-8 px-0" confirm="Delete this goal?" title="Delete goal">
                      <Trash2 className="size-4" aria-hidden />
                      <span className="sr-only">Delete goal</span>
                    </ActionButton>
                  </li>
                ))}
              </ul>
            )}
            <GoalForm subjects={a.subjects.map((s) => ({ id: s.subjectId, name: s.name }))} />
          </div>
        </Card>
      </div>
    </div>
  );
}
