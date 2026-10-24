import type { Metadata } from "next";
import clsx from "clsx";
import { CalendarDays } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { isoWeekday, todayIn } from "@/lib/dates";
import { getTimetable } from "@/lib/services/academics";
import { EmptyState, PageHeader } from "@/components/ui";
import { WEEKDAYS } from "@/lib/constants";
import { AcademicsNav } from "../nav";

export const metadata: Metadata = { title: "Timetable" };

export default async function TimetablePage() {
  const user = await requireUser(["student"]);
  const entries = await getTimetable(user);
  const today = isoWeekday(todayIn(user.timezone));
  const days = [1, 2, 3, 4, 5];

  return (
    <div className="animate-fade-up">
      <PageHeader eyebrow="Academics" title="Timetable" description="Your weekly schedule." />
      <AcademicsNav />
      {entries.length === 0 ? (
        <EmptyState icon={CalendarDays} title="No timetable yet">Your school hasn&apos;t published a timetable for your class.</EmptyState>
      ) : (
        <div className="grid gap-4 md:grid-cols-5">
          {days.map((d) => (
            <section key={d} aria-labelledby={`day-${d}`} className={clsx("rounded-2xl bg-white p-3 ring-1", d === today ? "ring-2 ring-brand-500" : "ring-ink-100")}>
              <h2 id={`day-${d}`} className="mb-2 flex items-center justify-between px-1 text-sm font-bold">
                {WEEKDAYS[d]}
                {d === today && <span className="rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white">Today</span>}
              </h2>
              <ol className="space-y-1.5">
                {entries.filter((e) => e.weekday === d).map((e) => (
                  <li key={e.id} className="rounded-xl bg-ink-50 px-2.5 py-2">
                    <p className="text-[11px] font-semibold text-ink-500">{e.start_time}–{e.end_time}</p>
                    <p className="text-sm font-bold leading-tight text-ink-900">{e.subject_name}</p>
                    <p className="text-[11px] text-ink-500">{e.room ? `Room ${e.room}` : ""}{e.teacher_name ? ` · ${e.teacher_name}` : ""}</p>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
