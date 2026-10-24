import Link from "next/link";
import type { Metadata } from "next";
import { CalendarClock, CalendarPlus, History } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { daysBetween, formatDate, todayIn } from "@/lib/dates";
import { getAssignments, listTeacherAssessments, GRADE_KIND_LABELS, type TeacherAssessment } from "@/lib/services/teacher";
import { Badge, Card, CardHeader, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui";
import { param, type SearchParams } from "../_components/selection";
import { CreateAssessmentForm, DeleteAssessmentButton } from "./forms";

export const metadata: Metadata = { title: "Assessments" };

function dueLabel(today: string, due: string) {
  const d = daysBetween(today, due);
  if (d === 0) return "Today";
  if (d === 1) return "Tomorrow";
  return `In ${d} days`;
}

export default async function AssessmentsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser(["teacher"]);
  const sp = await searchParams;
  const today = todayIn(user.timezone);
  const [assignments, { upcoming, recent }] = await Promise.all([getAssignments(user), listTeacherAssessments(user)]);
  const options = assignments.map((a) => ({ value: `${a.class_id}:${a.subject_id}`, label: `${a.class_name} · ${a.subject_name}` }));
  const requested = `${param(sp, "class")}:${param(sp, "subject")}`;
  const defaultAssignment = options.some((o) => o.value === requested) ? requested : undefined;

  const row = (a: TeacherAssessment, past: boolean) => (
    <tr key={a.id}>
      <Td>
        <span className="block font-semibold text-ink-900">{a.title}</span>
        {a.description && <span className="block max-w-md truncate text-xs text-ink-500" title={a.description}>{a.description}</span>}
      </Td>
      <Td className="whitespace-nowrap">{a.class_name} · {a.subject_name}</Td>
      <Td>{GRADE_KIND_LABELS[a.kind]}</Td>
      <Td className="whitespace-nowrap">
        {formatDate(a.due_date, { weekday: "short", day: "numeric", month: "short" })}
        {!past && <span className="block text-xs text-ink-500">{dueLabel(today, a.due_date)}</span>}
      </Td>
      <Td className="whitespace-nowrap">
        {a.graded_count === 0 ? (
          past ? <Badge tone="amber">Not graded</Badge> : <span className="text-ink-400">—</span>
        ) : (
          <Badge tone={a.graded_count >= a.student_count ? "green" : "blue"}>{a.graded_count}/{a.student_count} graded</Badge>
        )}
      </Td>
      <Td className="whitespace-nowrap text-right">
        <span className="inline-flex items-center gap-1">
          <Link href={`/teacher/gradebook?class=${a.class_id}&subject=${a.subject_id}`} className="text-sm font-semibold text-brand-700 hover:underline">Grades</Link>
          {a.graded_count === 0 && <DeleteAssessmentButton id={a.id} title={a.title} />}
        </span>
      </Td>
    </tr>
  );

  const head = (
    <thead>
      <tr>
        <Th>Assessment</Th>
        <Th>Class</Th>
        <Th>Type</Th>
        <Th>Due</Th>
        <Th>Grades</Th>
        <Th><span className="sr-only">Actions</span></Th>
      </tr>
    </thead>
  );

  return (
    <div className="animate-fade-up">
      <PageHeader title="Assessments" description="Schedule tests, quizzes and projects for your classes. Students are notified automatically." />
      <div className="grid gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          <Card>
            <CardHeader title="Upcoming" icon={CalendarClock} subtitle={`${upcoming.length} scheduled`} />
            {upcoming.length === 0 ? (
              <EmptyState icon={CalendarClock} title="Nothing scheduled">Use the form to schedule the next test or project.</EmptyState>
            ) : (
              <Table>{head}<tbody>{upcoming.map((a) => row(a, false))}</tbody></Table>
            )}
          </Card>
          <Card>
            <CardHeader title="Recent" icon={History} subtitle="Due in the last 30 days" />
            {recent.length === 0 ? (
              <p className="text-sm text-ink-500">No assessments in the last 30 days.</p>
            ) : (
              <Table>{head}<tbody>{recent.map((a) => row(a, true))}</tbody></Table>
            )}
          </Card>
        </div>
        <Card className="h-fit">
          <CardHeader title="Schedule an assessment" icon={CalendarPlus} />
          {options.length === 0 ? (
            <p className="text-sm text-ink-500">You don&apos;t teach a subject in any class yet.</p>
          ) : (
            <CreateAssessmentForm assignments={options} defaultAssignment={defaultAssignment} today={today} />
          )}
        </Card>
      </div>
    </div>
  );
}
