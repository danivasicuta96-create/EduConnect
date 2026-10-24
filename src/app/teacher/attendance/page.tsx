import type { Metadata } from "next";
import { ClipboardCheck, History, Info, CalendarDays, UsersRound } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { formatDate, todayIn } from "@/lib/dates";
import { getAssignments, getAttendanceSheet, isIsoDate } from "@/lib/services/teacher";
import Link from "next/link";
import { Badge, Card, CardHeader, EmptyState, Notice, PageHeader, Table, Td, Th, buttonClass } from "@/components/ui";
import { Input, Label } from "@/components/forms";
import { AssignmentPicker, fmt, param, resolveAssignment, type SearchParams } from "../_components/selection";
import { AttendanceForm } from "./forms";

export const metadata: Metadata = { title: "Attendance" };

export default async function AttendancePage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser(["teacher"]);
  const sp = await searchParams;
  const today = todayIn(user.timezone);
  const assignments = await getAssignments(user);
  const { selected, invalid } = resolveAssignment(assignments, param(sp, "class"), param(sp, "subject"));
  const requested = param(sp, "date");
  const date = requested && isIsoDate(requested) && requested <= today ? requested : today;
  const dateAdjusted = Boolean(requested) && requested !== date;

  if (!selected) {
    return (
      <div className="animate-fade-up">
        <PageHeader title="Attendance" />
        <EmptyState icon={ClipboardCheck} title="No subject assignments">You don&apos;t teach a subject in any class yet.</EmptyState>
      </div>
    );
  }

  const sheet = await getAttendanceSheet(user, selected.class_id, selected.subject_id, date);

  return (
    <div className="animate-fade-up">
      <PageHeader title="Attendance" description="Mark each student once per lesson. Saving again for the same date updates the existing record." />
      <AssignmentPicker assignments={assignments} selected={selected} basePath="/teacher/attendance" extra={{ date }} />

      {(invalid || dateAdjusted) && (
        <div className="mb-4">
          <Notice tone="amber" icon={Info}>
            {invalid && <>You can only take attendance for classes and subjects you teach. Showing {selected.class_name} · {selected.subject_name}. </>}
            {dateAdjusted && <>Attendance can&apos;t be recorded for future or invalid dates, so today is shown.</>}
          </Notice>
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title={`${sheet.className} · ${sheet.subjectName}`}
            icon={ClipboardCheck}
            subtitle={formatDate(date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            action={sheet.recorded > 0 ? <Badge tone="green">Recorded</Badge> : <Badge tone="amber">Not recorded</Badge>}
          />
          <form method="get" action="/teacher/attendance" className="mb-4 flex flex-wrap items-end gap-2">
            <input type="hidden" name="class" value={sheet.classId} />
            <input type="hidden" name="subject" value={sheet.subjectId} />
            <div>
              <Label htmlFor="att-date">Date</Label>
              <Input id="att-date" type="date" name="date" defaultValue={date} max={today} className="w-44" />
            </div>
            <button type="submit" className={buttonClass("secondary", "md")}>Show</button>
          </form>
          <p className="mb-4 flex items-center gap-2 text-sm text-ink-600">
            <CalendarDays className="size-4 text-ink-400" aria-hidden />
            {sheet.lessons.length > 0
              ? `Timetable: ${sheet.lessons.map((l) => `${l.start_time}–${l.end_time}${l.room ? ` (room ${l.room})` : ""}`).join(", ")}`
              : "No lesson on the timetable for this day — you can still record attendance, e.g. for a rescheduled lesson."}
          </p>
          {sheet.students.length === 0 ? (
            <EmptyState icon={UsersRound} title="No students enrolled">Students appear here once the school enrols them in this class.</EmptyState>
          ) : (
            <AttendanceForm
              key={`${sheet.classId}:${sheet.subjectId}:${date}`}
              classId={sheet.classId}
              subjectId={sheet.subjectId}
              date={date}
              alreadyRecorded={sheet.recorded > 0}
              students={sheet.students.map((s) => ({
                id: s.id, name: s.display_name, avatarColor: s.avatar_color, avatarEmoji: s.avatar_emoji,
                status: s.status, note: s.note, recentRate: s.recentRate,
              }))}
            />
          )}
        </Card>

        <Card>
          <CardHeader title="Recent lessons" icon={History} subtitle={`Last 30 days · overall ${fmt(sheet.overallRate, "%")} attended`} />
          {sheet.summary.length === 0 ? (
            <p className="text-sm text-ink-500">No attendance recorded in the last 30 days.</p>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Date</Th>
                  <Th className="text-right">Present</Th>
                  <Th className="text-right">Late</Th>
                  <Th className="text-right">Absent</Th>
                  <Th className="text-right">Excused</Th>
                  <Th className="text-right">Rate</Th>
                </tr>
              </thead>
              <tbody>
                {sheet.summary.map((d) => (
                  <tr key={d.date}>
                    <Td>
                      <Link href={`/teacher/attendance?class=${sheet.classId}&subject=${sheet.subjectId}&date=${d.date}`} className="font-semibold text-brand-700 hover:underline">
                        {formatDate(d.date, { weekday: "short", day: "numeric", month: "short" })}
                      </Link>
                    </Td>
                    <Td className="text-right">{d.present}</Td>
                    <Td className="text-right">{d.late}</Td>
                    <Td className="text-right">{d.absent}</Td>
                    <Td className="text-right">{d.excused}</Td>
                    <Td className="text-right font-semibold">{fmt(d.rate, "%")}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
          <p className="mt-3 text-xs text-ink-500">Rate = (present + late) ÷ students marked.</p>
        </Card>
      </div>
    </div>
  );
}
