import Link from "next/link";
import type { Metadata } from "next";
import {
  BookOpenCheck, CalendarDays, CalendarClock, ClipboardCheck, ClipboardList, Bell, School, UsersRound, Gauge, ListTodo, CircleCheck, ChevronRight,
} from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { formatDate, timeAgo } from "@/lib/dates";
import { getTeacherDashboard, GRADE_KIND_LABELS } from "@/lib/services/teacher";
import { Badge, Card, CardHeader, EmptyState, LinkButton, Stat, gradeTone } from "@/components/ui";
import { fmt } from "../_components/selection";

export const metadata: Metadata = { title: "Teacher dashboard" };

function greeting(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default async function TeacherDashboard() {
  const user = await requireUser(["teacher"]);
  const d = await getTeacherDashboard(user);
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: user.timezone, hour: "numeric", hour12: false }).format(new Date()));
  const homeroom = d.classes.filter((c) => c.is_homeroom).map((c) => c.name);

  return (
    <div className="space-y-6 animate-fade-up">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-sm font-semibold text-brand-600">{formatDate(d.today, { weekday: "long", day: "numeric", month: "long" })}</p>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink-900 sm:text-3xl">
            {greeting(hour)}, {user.displayName.split(" ")[0]}
          </h1>
          <p className="mt-1.5 text-ink-500">
            {d.lessons.length === 0 ? "No lessons on your timetable today." : `${d.lessons.length} lesson${d.lessons.length === 1 ? "" : "s"} today.`}{" "}
            {d.tasks.length > 0 ? `${d.tasks.length} follow-up${d.tasks.length === 1 ? "" : "s"} waiting.` : "You're all caught up."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <LinkButton href="/teacher/attendance" variant="secondary" size="sm"><ClipboardCheck className="size-4" aria-hidden /> Take attendance</LinkButton>
          <LinkButton href="/teacher/gradebook" size="sm"><BookOpenCheck className="size-4" aria-hidden /> Open gradebook</LinkButton>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Classes" value={d.classes.length} icon={School} hint={homeroom.length ? `Homeroom: ${homeroom.join(", ")}` : `${d.assignments.length} subject assignments`} />
        <Stat label="Students taught" value={d.stats.studentsTaught} icon={UsersRound} tone="blue" hint="Across your subject classes" />
        <Stat
          label="Average grade"
          value={fmt(d.stats.averageGrade)}
          icon={Gauge}
          tone={gradeTone(d.stats.averageGrade)}
          hint={`Weighted, ${d.stats.gradeCount} grades in your subjects`}
        />
        <Stat
          label="Attendance (2 weeks)"
          value={fmt(d.stats.attendanceRate, "%")}
          icon={ClipboardCheck}
          tone="green"
          hint={`${d.stats.attendanceRecords} records · present or late`}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Today's lessons" icon={CalendarDays} subtitle="From the school timetable" />
          {d.lessons.length === 0 ? (
            <EmptyState icon={CalendarDays} title="No lessons today">Use the time to plan ahead or catch up on grading.</EmptyState>
          ) : (
            <ol className="grid gap-2 sm:grid-cols-2">
              {d.lessons.map((l) => (
                <li key={l.id} className="flex items-center gap-3 rounded-xl bg-ink-50 px-3 py-2.5">
                  <span className="w-12 shrink-0 text-xs font-bold text-ink-500">{l.start_time}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-ink-900">{l.class_name} · {l.subject_name}</span>
                    <span className="block truncate text-xs text-ink-500">{l.start_time}–{l.end_time}{l.room ? ` · Room ${l.room}` : ""}</span>
                  </span>
                  {l.attendance_taken ? (
                    <Badge tone="green"><CircleCheck className="size-3" aria-hidden /> Taken</Badge>
                  ) : (
                    <Link href={`/teacher/attendance?class=${l.class_id}&subject=${l.subject_id}&date=${d.today}`} className="text-xs font-semibold text-brand-700 hover:underline">
                      Take attendance
                    </Link>
                  )}
                </li>
              ))}
            </ol>
          )}
        </Card>

        <Card>
          <CardHeader title="Follow-ups" icon={ListTodo} subtitle="Things that need your attention" />
          {d.tasks.length === 0 ? (
            <EmptyState icon={CircleCheck} title="All caught up">Attendance and grades are up to date.</EmptyState>
          ) : (
            <ul className="space-y-2">
              {d.tasks.slice(0, 8).map((t, i) => (
                <li key={i}>
                  <Link href={t.href} className="flex items-start gap-3 rounded-xl px-3 py-2.5 ring-1 ring-ink-100 transition hover:bg-ink-50 hover:ring-brand-200">
                    <span className={t.kind === "attendance_missing" ? "mt-0.5 text-sky-700" : "mt-0.5 text-amber-700"}>
                      {t.kind === "attendance_missing" ? <ClipboardCheck className="size-4" aria-hidden /> : <ClipboardList className="size-4" aria-hidden />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-ink-900">{t.title}</span>
                      <span className="block text-xs text-ink-500">{t.detail}</span>
                    </span>
                    <ChevronRight className="mt-0.5 size-4 shrink-0 text-ink-400" aria-hidden />
                  </Link>
                </li>
              ))}
              {d.tasks.length > 8 && <li className="px-3 text-xs text-ink-500">and {d.tasks.length - 8} more…</li>}
            </ul>
          )}
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader
            title="Upcoming assessments"
            icon={CalendarClock}
            subtitle="Next 14 days"
            action={<Link href="/teacher/assessments" className="text-sm font-semibold text-brand-700 hover:underline">Manage</Link>}
          />
          {d.upcoming.length === 0 ? (
            <EmptyState icon={CalendarClock} title="Nothing scheduled" action={<LinkButton href="/teacher/assessments" variant="soft" size="sm">Schedule an assessment</LinkButton>}>
              No tests or projects in the next two weeks.
            </EmptyState>
          ) : (
            <ul className="divide-y divide-ink-50">
              {d.upcoming.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-ink-900">{a.title}</span>
                    <span className="block truncate text-xs text-ink-500">{a.class_name} · {a.subject_name} · {GRADE_KIND_LABELS[a.kind]}</span>
                  </span>
                  <Badge tone="amber">{formatDate(a.due_date, { weekday: "short", day: "numeric", month: "short" })}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Recent notifications" icon={Bell} action={<Link href="/notifications" className="text-sm font-semibold text-brand-700 hover:underline">All</Link>} />
          {d.notifications.length === 0 ? (
            <p className="text-sm text-ink-500">No notifications yet.</p>
          ) : (
            <ul className="space-y-3">
              {d.notifications.map((n) => (
                <li key={n.id} className="flex items-start gap-2.5">
                  <span className={n.read_at ? "mt-1.5 size-2 shrink-0 rounded-full bg-ink-200" : "mt-1.5 size-2 shrink-0 rounded-full bg-brand-500"} aria-label={n.read_at ? undefined : "Unread"} />
                  <span className="min-w-0">
                    {n.link ? (
                      <Link href={n.link} className="block text-sm font-semibold text-ink-900 hover:underline">{n.title}</Link>
                    ) : (
                      <span className="block text-sm font-semibold text-ink-900">{n.title}</span>
                    )}
                    {n.body && <span className="block text-xs text-ink-500">{n.body}</span>}
                    <span className="block text-xs text-ink-400">{timeAgo(n.created_at)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader title="Your classes" icon={School} action={<Link href="/teacher/classes" className="text-sm font-semibold text-brand-700 hover:underline">All classes</Link>} />
          {d.classes.length === 0 ? (
            <EmptyState icon={School} title="No classes assigned yet">Your school administrator assigns classes and subjects.</EmptyState>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {d.classes.map((c) => (
                <Link key={c.id} href={`/teacher/classes/${c.id}`} className="rounded-xl bg-ink-50 p-4 ring-1 ring-ink-100 transition hover:ring-brand-300">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-lg font-extrabold text-ink-900">{c.name}</p>
                    {c.is_homeroom && <Badge tone="pink">Homeroom</Badge>}
                  </div>
                  <p className="text-sm text-ink-600">{c.student_count} students · Grade {c.grade_level}</p>
                  <p className="mt-1 truncate text-xs text-ink-500">{c.subjects.map((s) => s.name).join(", ") || "Homeroom only"}</p>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
