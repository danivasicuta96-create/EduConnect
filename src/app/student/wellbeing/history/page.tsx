import type { Metadata } from "next";
import { Activity, Flame, NotebookPen, CalendarCheck, Lock } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { formatDate } from "@/lib/dates";
import { studentAccess } from "@/lib/services/consent";
import { getHistory } from "@/lib/services/wellbeing";
import { CHECKIN_FACTORS, EXPERIENCE_OPTIONS } from "@/lib/constants";
import { Badge, Card, CardHeader, EmptyState, LinkButton, PageHeader, ProgressBar, Stat, moodTone } from "@/components/ui";
import { TrendChart } from "@/components/charts";
import { WellbeingNav } from "../nav";

export const metadata: Metadata = { title: "My wellbeing trends" };

export default async function HistoryPage() {
  const user = await requireUser(["student"]);
  const access = await studentAccess(user, user.id);
  if (!access.checkins) {
    return (
      <>
        <PageHeader title="My trends" />
        <WellbeingNav />
        <EmptyState icon={Lock} title="Check-ins are switched off" action={<LinkButton href="/settings" variant="soft">Review in Settings</LinkButton>} />
      </>
    );
  }
  const h = await getHistory(user, 60);
  const factors = Object.entries(h.factorCounts).sort((a, b) => b[1] - a[1]);
  const maxFactor = factors[0]?.[1] ?? 1;
  const journal = [...h.rows].reverse().filter((r) => r.note);

  return (
    <div className="animate-fade-up">
      <PageHeader eyebrow="Wellbeing" title="My trends" description="Only you can see this page. It shows the last 60 days." />
      <WellbeingNav />
      {h.rows.length === 0 ? (
        <EmptyState icon={Activity} title="No check-ins yet" action={<LinkButton href="/student/wellbeing">Do your first check-in</LinkButton>}>
          After a few check-ins you&apos;ll see how your days are going over time.
        </EmptyState>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat label="Last 7 days" value={h.average7 ?? "—"} hint="average mood" icon={Activity} />
            <Stat label="Last 30 days" value={h.average30 ?? "—"} hint="average mood" icon={Activity} tone="pink" />
            <Stat label="Check-in streak" value={`${h.streak} day${h.streak === 1 ? "" : "s"}`} hint="school days in a row" icon={Flame} tone="amber" />
            <Stat label="Check-ins" value={h.rows.length} hint="in 60 days" icon={CalendarCheck} tone="green" />
          </div>
          <Card>
            <CardHeader title="Mood over time" icon={Activity} subtitle="Your daily rating from 1 to 10" />
            <TrendChart title="Daily mood" data={h.rows.map((r) => ({ label: formatDate(r.date), value: r.mood }))} domain={[1, 10]} />
          </Card>
          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader title="What's been affecting your days" />
              {factors.length === 0 ? (
                <p className="text-sm text-ink-500">You haven&apos;t tagged any factors yet.</p>
              ) : (
                <ul className="space-y-3">
                  {factors.map(([f, n]) => (
                    <li key={f}>
                      <div className="mb-1 flex justify-between text-sm"><span className="font-medium">{CHECKIN_FACTORS[f] ?? f}</span><span className="text-ink-500">{n}×</span></div>
                      <ProgressBar value={n} max={maxFactor} label={`${CHECKIN_FACTORS[f] ?? f}: ${n} times`} />
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card id="journal">
              <CardHeader title="My journal" icon={NotebookPen} subtitle="Private notes from your check-ins" />
              {journal.length === 0 ? (
                <p className="text-sm text-ink-500">Notes you add to check-ins will appear here.</p>
              ) : (
                <ul className="max-h-96 space-y-3 overflow-y-auto pr-1">
                  {journal.map((r) => (
                    <li key={r.id} className="rounded-xl bg-ink-50 p-3">
                      <div className="mb-1 flex items-center gap-2 text-xs text-ink-500">
                        <span>{formatDate(r.date, { weekday: "short", day: "numeric", month: "short" })}</span>
                        <Badge tone={moodTone(r.mood)}>{r.mood}/10</Badge>
                        {r.experience && <span aria-hidden>{EXPERIENCE_OPTIONS[r.experience]?.emoji}</span>}
                        {r.shared_with_counselor && <Badge tone="blue">Shared with counselor</Badge>}
                      </div>
                      <p className="text-sm text-ink-800">{r.note}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
          <p className="text-xs text-ink-500">
            These trends are for your own reflection — they aren&apos;t a diagnosis. If you notice a run of hard days, talking to someone you trust can help.
          </p>
        </div>
      )}
    </div>
  );
}
