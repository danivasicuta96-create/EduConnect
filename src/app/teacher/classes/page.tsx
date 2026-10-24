import Link from "next/link";
import type { Metadata } from "next";
import { School, UsersRound, BookOpenCheck, ClipboardCheck } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getTeacherClasses } from "@/lib/services/teacher";
import { Badge, Card, EmptyState, PageHeader, LinkButton } from "@/components/ui";

export const metadata: Metadata = { title: "Classes & rosters" };

export default async function TeacherClassesPage() {
  const user = await requireUser(["teacher"]);
  const classes = await getTeacherClasses(user);

  return (
    <div className="animate-fade-up">
      <PageHeader title="Classes & rosters" description="Classes where you teach a subject or are the homeroom teacher." />
      {classes.length === 0 ? (
        <EmptyState icon={School} title="No classes assigned yet">Your school administrator assigns classes and subjects to teachers.</EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {classes.map((c) => {
            const first = c.subjects[0];
            return (
              <Card key={c.id} as="article" className="flex flex-col">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="text-xl font-extrabold text-ink-900">
                      <Link href={`/teacher/classes/${c.id}`} className="hover:underline">{c.name}</Link>
                    </h2>
                    <p className="text-sm text-ink-500">Grade {c.grade_level}</p>
                  </div>
                  {c.is_homeroom && <Badge tone="pink">Homeroom</Badge>}
                </div>
                <p className="mt-3 flex items-center gap-2 text-sm text-ink-700">
                  <UsersRound className="size-4 text-ink-400" aria-hidden /> {c.student_count} students
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {c.subjects.length === 0 ? (
                    <span className="text-sm text-ink-500">No subjects — homeroom only</span>
                  ) : (
                    c.subjects.map((s) => <Badge key={s.id} tone="brand">{s.name}</Badge>)
                  )}
                </div>
                <div className="mt-4 flex flex-wrap gap-2 pt-1">
                  <LinkButton href={`/teacher/classes/${c.id}`} size="sm"><UsersRound className="size-4" aria-hidden /> Roster</LinkButton>
                  {first && (
                    <>
                      <LinkButton href={`/teacher/gradebook?class=${c.id}&subject=${first.id}`} variant="secondary" size="sm"><BookOpenCheck className="size-4" aria-hidden /> Gradebook</LinkButton>
                      <LinkButton href={`/teacher/attendance?class=${c.id}&subject=${first.id}`} variant="secondary" size="sm"><ClipboardCheck className="size-4" aria-hidden /> Attendance</LinkButton>
                    </>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
