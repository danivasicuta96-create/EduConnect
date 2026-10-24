import Link from "next/link";
import type { Metadata } from "next";
import {
  CalendarDays, ClipboardList, HeartPulse, Handshake, UsersRound, Sparkles, Bot, NotebookPen, LifeBuoy, ChevronRight, Info, PartyPopper,
} from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { todayIn, formatDate, isSchoolDay } from "@/lib/dates";
import { getStudentAcademics, getTimetable, todaysLessons } from "@/lib/services/academics";
import { getActivities, getGroups, getRecommendations } from "@/lib/services/connect";
import { getCheckin } from "@/lib/services/wellbeing";
import { studentAccess } from "@/lib/services/consent";
import { Avatar, Badge, Card, CardHeader, EmptyState, LinkButton, Notice, gradeTone, moodTone } from "@/components/ui";
import { EXPERIENCE_OPTIONS } from "@/lib/constants";

export const metadata: Metadata = { title: "Home" };

const MESSAGES = [
  "Small steps every day add up to big progress.",
  "Asking for help is a strength, not a weakness.",
  "You don't have to be perfect to make progress.",
  "Rest is part of learning too.",
  "Be as kind to yourself as you are to your friends.",
  "Curiosity is a superpower — ask one extra question today.",
  "Mistakes are proof that you're trying.",
];

function greeting(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default async function StudentHome() {
  const user = await requireUser(["student"]);
  const today = todayIn(user.timezone);
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: user.timezone, hour: "numeric", hour12: false }).format(new Date()));
  const access = await studentAccess(user, user.id);

  const [academics, timetable, checkin, peers, groups, activities] = await Promise.all([
    getStudentAcademics(user),
    getTimetable(user),
    access.checkins ? getCheckin(user, today) : Promise.resolve(null),
    access.matchmaking ? getRecommendations(user, 3) : Promise.resolve([]),
    access.matchmaking ? getGroups(user) : Promise.resolve(null),
    getActivities(user, 3),
  ]);
  const lessons = todaysLessons(timetable, today);
  const recent = academics.grades.slice(0, 5);
  const message = MESSAGES[Number(today.replaceAll("-", "")) % MESSAGES.length];
  const firstName = user.displayName.split(" ")[0];

  return (
    <div className="space-y-6 animate-fade-up">
      <section className="relative overflow-hidden rounded-3xl bg-brand-gradient p-6 text-white shadow-[var(--shadow-pop)] sm:p-8">
        <p className="text-sm font-semibold text-white/85">{formatDate(today, { weekday: "long", day: "numeric", month: "long" })}</p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight sm:text-4xl">
          {greeting(hour)}, {firstName}!
        </h1>
        <p className="mt-2 max-w-xl text-white/90">{message}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <LinkButton href="/student/tutor" variant="secondary" size="sm"><Bot className="size-4" aria-hidden /> AI tutor</LinkButton>
          <LinkButton href="/student/wellbeing/history#journal" variant="secondary" size="sm"><NotebookPen className="size-4" aria-hidden /> My journal</LinkButton>
          <LinkButton href="/student/wellbeing/support" variant="secondary" size="sm"><LifeBuoy className="size-4" aria-hidden /> Wellbeing resources</LinkButton>
        </div>
        <div aria-hidden className="absolute -right-10 -top-10 size-48 rounded-full bg-white/10" />
      </section>

      {!access.active && (
        <Notice tone="amber" icon={Info} title="Some features are waiting for consent">
          Your school is waiting for a parent or guardian&apos;s consent before switching on check-ins, matchmaking and AI features.
          You can already see your grades, attendance and timetable.
        </Notice>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Wellbeing check-in */}
        <Card className="lg:col-span-1">
          <CardHeader title="Daily check-in" icon={HeartPulse} subtitle="About one minute" />
          {!access.checkins ? (
            <p className="text-sm text-ink-500">Check-ins are switched off for your account.</p>
          ) : checkin ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-3xl" aria-hidden>{EXPERIENCE_OPTIONS[checkin.experience ?? "mixed"]?.emoji ?? "🙂"}</span>
                <div>
                  <p className="font-bold">Done for today</p>
                  <p className="text-sm text-ink-500">You rated your day <Badge tone={moodTone(checkin.mood)}>{checkin.mood}/10</Badge></p>
                </div>
              </div>
              <LinkButton href="/student/wellbeing" variant="soft" size="sm">Update check-in</LinkButton>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-ink-600">{isSchoolDay(today) ? "How was school today?" : "How are you feeling today?"}</p>
              <div className="grid grid-cols-5 gap-1.5" aria-label="Quick mood">
                {[2, 4, 6, 8, 10].map((m) => (
                  <Link key={m} href={`/student/wellbeing?mood=${m}`} className="grid h-12 place-items-center rounded-xl bg-blush-50 text-2xl ring-1 ring-blush-200 transition hover:bg-blush-100" aria-label={`Mood ${m} out of 10`}>
                    {["😣", "😕", "😐", "🙂", "🌟"][m / 2 - 1]}
                  </Link>
                ))}
              </div>
              <LinkButton href="/student/wellbeing" size="sm">Start check-in</LinkButton>
            </div>
          )}
        </Card>

        {/* Timetable */}
        <Card className="lg:col-span-2">
          <CardHeader title="Today's classes" icon={CalendarDays} action={<Link href="/student/academics/timetable" className="text-sm font-semibold text-brand-700 hover:underline">Full week</Link>} />
          {lessons.length === 0 ? (
            <EmptyState icon={PartyPopper} title="No classes today">Enjoy your free time — and get some rest.</EmptyState>
          ) : (
            <ol className="grid gap-2 sm:grid-cols-2">
              {lessons.map((l) => (
                <li key={l.id} className="flex items-center gap-3 rounded-xl bg-ink-50 px-3 py-2.5">
                  <span className="w-12 shrink-0 text-xs font-bold text-ink-500">{l.start_time}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-ink-900">{l.subject_name}</span>
                    <span className="block truncate text-xs text-ink-500">{l.teacher_name} · Room {l.room}</span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Card>

        {/* Grades */}
        <Card className="lg:col-span-2">
          <CardHeader
            title="Recent grades"
            icon={ClipboardList}
            subtitle={academics.overall !== null ? <>Overall average <strong className="text-ink-900">{academics.overall}</strong></> : undefined}
            action={<Link href="/student/academics/grades" className="text-sm font-semibold text-brand-700 hover:underline">All grades</Link>}
          />
          {recent.length === 0 ? (
            <EmptyState icon={ClipboardList} title="No grades yet">Grades appear here once your teachers add them.</EmptyState>
          ) : (
            <ul className="divide-y divide-ink-50">
              {recent.map((g) => (
                <li key={g.id} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{g.subject_name}</span>
                    <span className="block truncate text-xs text-ink-500">{g.assessment_title ?? g.kind} · {formatDate(g.graded_on)}</span>
                  </span>
                  <Badge tone={gradeTone(g.score)} className="text-sm">{g.score}</Badge>
                </li>
              ))}
            </ul>
          )}
          {academics.upcoming.length > 0 && (
            <div className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
              <strong>Coming up:</strong> {academics.upcoming[0].title} on {formatDate(academics.upcoming[0].due_date, { weekday: "short", day: "numeric", month: "short" })}
              {academics.upcoming.length > 1 && <> and {academics.upcoming.length - 1} more</>}.{" "}
              <Link href="/student/academics" className="font-semibold underline">See all</Link>
            </div>
          )}
        </Card>

        {/* Peers */}
        <Card>
          <CardHeader title="People you might click with" icon={Handshake} />
          {!access.matchmaking ? (
            <p className="text-sm text-ink-500">Matchmaking is switched off for your account.</p>
          ) : peers.length === 0 ? (
            <EmptyState title="No suggestions yet">Add a few interests to your profile to get suggestions.</EmptyState>
          ) : (
            <ul className="space-y-3">
              {peers.map((p) => (
                <li key={p.id} className="flex items-start gap-3">
                  <Avatar name={p.displayName} color={p.avatarColor} emoji={p.avatarEmoji} size="sm" />
                  <div className="min-w-0">
                    <p className="text-sm font-bold">{p.displayName}</p>
                    <p className="text-xs text-ink-500">{p.match.reasons[0]}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {access.matchmaking && (
            <Link href="/student/connect" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">
              Discover more <ChevronRight className="size-4" aria-hidden />
            </Link>
          )}
        </Card>

        {/* Groups & activities */}
        <Card className="lg:col-span-3">
          <CardHeader title="Study groups & activities for you" icon={UsersRound} />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {groups?.invited.map((g) => (
              <Link key={g.id} href="/student/groups" className="rounded-xl bg-blush-50 p-4 ring-1 ring-blush-200 transition hover:ring-brand-300">
                <Badge tone="pink">Invitation</Badge>
                <p className="mt-2 font-bold">{g.name}</p>
                <p className="text-sm text-ink-600">{g.description}</p>
              </Link>
            ))}
            {groups?.suggested.slice(0, 2).map((g) => (
              <Link key={g.id} href="/student/groups" className="rounded-xl bg-ink-50 p-4 ring-1 ring-ink-100 transition hover:ring-brand-300">
                <Badge tone="brand">Study group</Badge>
                <p className="mt-2 font-bold">{g.name}</p>
                <p className="text-sm text-ink-600">{g.reasons[0]}</p>
              </Link>
            ))}
            {activities.map((a) => (
              <div key={a.id} className="rounded-xl bg-ink-50 p-4 ring-1 ring-ink-100">
                <Badge tone="blue">Activity{a.startsAt ? ` · ${formatDate(a.startsAt, { weekday: "short", day: "numeric", month: "short" })}` : ""}</Badge>
                <p className="mt-2 font-bold">{a.title}</p>
                <p className="text-sm text-ink-600">{a.shared.length ? `Matches your interest in ${a.shared.join(", ")}` : a.description}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="flex items-center gap-4 bg-ink-900 text-white ring-0">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white/10"><Sparkles className="size-5" aria-hidden /></span>
        <div className="min-w-0 flex-1">
          <p className="font-bold">Stuck on homework?</p>
          <p className="text-sm text-white/75">The AI tutor explains the ideas step by step, so you can solve it yourself.</p>
        </div>
        <LinkButton href="/student/tutor" size="sm">Ask the tutor</LinkButton>
      </Card>
    </div>
  );
}
