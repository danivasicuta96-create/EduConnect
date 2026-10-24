import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, UsersRound, Info, BookOpenCheck, ClipboardCheck } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getClassRoster } from "@/lib/services/teacher";
import { Avatar, Badge, Card, CardHeader, EmptyState, LinkButton, Notice, PageHeader, Table, Td, Th, gradeTone } from "@/components/ui";
import { fmt } from "../../_components/selection";

export const metadata: Metadata = { title: "Class roster" };

export default async function ClassRosterPage({ params }: { params: Promise<{ classId: string }> }) {
  const user = await requireUser(["teacher"]);
  const { classId } = await params;
  const roster = await getClassRoster(user, classId);
  if (!roster) notFound();

  const first = roster.subjects[0];
  return (
    <div className="animate-fade-up">
      <Link href="/teacher/classes" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-ink-600 hover:text-ink-900">
        <ArrowLeft className="size-4" aria-hidden /> All classes
      </Link>
      <PageHeader
        title={`Class ${roster.name}`}
        eyebrow={roster.is_homeroom ? "You are the homeroom teacher" : `Homeroom: ${roster.homeroom_teacher ?? "not assigned"}`}
        description={`Grade ${roster.grade_level} · ${roster.students.length} students · ${roster.subjects.length ? `You teach ${roster.subjects.map((s) => s.name).join(" and ")}` : "Homeroom only"}`}
        actions={
          first && (
            <>
              <LinkButton href={`/teacher/gradebook?class=${roster.id}&subject=${first.id}`} size="sm"><BookOpenCheck className="size-4" aria-hidden /> Gradebook</LinkButton>
              <LinkButton href={`/teacher/attendance?class=${roster.id}&subject=${first.id}`} variant="secondary" size="sm"><ClipboardCheck className="size-4" aria-hidden /> Attendance</LinkButton>
            </>
          )
        }
      />

      <Card>
        <CardHeader
          title="Students"
          icon={UsersRound}
          subtitle={roster.subjects.length ? "Weighted averages in your subjects; attendance in your lessons" : "Attendance across all subjects of this class"}
        />
        {roster.students.length === 0 ? (
          <EmptyState icon={UsersRound} title="No students enrolled">Students appear here once the school enrols them in this class.</EmptyState>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Student</Th>
                {roster.subjects.map((s) => <Th key={s.id} className="text-right">{s.name}</Th>)}
                {roster.subjects.length > 1 && <Th className="text-right">Overall</Th>}
                <Th className="text-right">Attendance</Th>
                <Th className="text-right">Absences</Th>
              </tr>
            </thead>
            <tbody>
              {roster.students.map((s) => (
                <tr key={s.id}>
                  <Td>
                    <span className="flex items-center gap-2.5">
                      <Avatar name={s.display_name} color={s.avatar_color} emoji={s.avatar_emoji} size="sm" />
                      <span className="min-w-0">
                        <span className="block font-semibold text-ink-900">{s.display_name}</span>
                        {s.account_state !== "active" && <span className="block text-xs text-amber-700">Account pending consent</span>}
                      </span>
                    </span>
                  </Td>
                  {roster.subjects.map((sub) => {
                    const avg = s.subjectAverages[sub.id];
                    return (
                      <Td key={sub.id} className="text-right">
                        {avg === null ? <span className="text-ink-400">—</span> : <Badge tone={gradeTone(avg)}>{avg}</Badge>}
                      </Td>
                    );
                  })}
                  {roster.subjects.length > 1 && <Td className="text-right font-bold">{fmt(s.average)}</Td>}
                  <Td className="text-right">{fmt(s.attendanceRate, "%")}<span className="block text-xs text-ink-400">{s.attendanceRecords} records</span></Td>
                  <Td className="text-right">{s.absences}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        <div className="mt-4">
          <Notice tone="neutral" icon={Info}>
            Subject average = Σ(score × weight) ÷ Σ(weight). Overall = the plain mean of your subject averages.
            Attendance rate counts present and late as attended.
          </Notice>
        </div>
      </Card>
    </div>
  );
}
