import type { Metadata } from "next";
import { BookOpenCheck, Info, UsersRound, Sigma } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { formatDate, todayIn } from "@/lib/dates";
import { getAssignments, getGradebook, GRADE_KIND_LABELS, type GradeEntry } from "@/lib/services/teacher";
import { Avatar, Badge, Card, CardHeader, EmptyState, Notice, PageHeader, Table, Td, Th, gradeTone } from "@/components/ui";
import { AssignmentPicker, fmt, param, resolveAssignment, type SearchParams } from "../_components/selection";
import { AddGradeDialog, GradeChip } from "./forms";

export const metadata: Metadata = { title: "Gradebook" };

export default async function GradebookPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser(["teacher"]);
  const sp = await searchParams;
  const assignments = await getAssignments(user);
  const { selected, invalid } = resolveAssignment(assignments, param(sp, "class"), param(sp, "subject"));

  if (!selected) {
    return (
      <div className="animate-fade-up">
        <PageHeader title="Gradebook" />
        <EmptyState icon={BookOpenCheck} title="No subject assignments">You don&apos;t teach a subject in any class yet. Your school administrator assigns classes and subjects.</EmptyState>
      </div>
    );
  }

  const today = todayIn(user.timezone);
  const book = await getGradebook(user, selected.class_id, selected.subject_id);
  const columnIds = new Set(book.columns.map((c) => c.id));
  const common = {
    classId: book.classId,
    subjectId: book.subjectId,
    today,
    assessments: book.assessments.map((a) => ({ id: a.id, title: a.title, due_date: a.due_date })),
  };
  const students = book.students.map((s) => ({ id: s.id, name: s.display_name }));
  const example = book.students.find((s) => s.grades.length >= 2);
  const chip = (g: GradeEntry, name: string) => (
    <GradeChip
      key={g.id}
      grade={{ id: g.id, score: g.score, weight: g.weight, kind: g.kind, assessment_id: g.assessment_id, graded_on: g.graded_on, comment: g.comment }}
      studentName={name}
      kindLabel={GRADE_KIND_LABELS[g.kind]}
      common={common}
    />
  );

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Gradebook"
        description="Add, edit or remove grades on the 1–10 scale. Click a grade to edit it."
        actions={book.students.length > 0 && <AddGradeDialog students={students} common={common} variant="primary" />}
      />
      <AssignmentPicker assignments={assignments} selected={selected} basePath="/teacher/gradebook" />
      {invalid && (
        <div className="mb-4">
          <Notice tone="amber" icon={Info}>You can only open gradebooks for classes and subjects you teach. Showing {selected.class_name} · {selected.subject_name} instead.</Notice>
        </div>
      )}

      <Card>
        <CardHeader
          title={`${book.className} · ${book.subjectName}`}
          icon={BookOpenCheck}
          subtitle={<>{book.students.length} students · {book.gradeCount} grades · class average <strong className="text-ink-900">{fmt(book.classAverage)}</strong></>}
        />
        {book.students.length === 0 ? (
          <EmptyState icon={UsersRound} title="No students enrolled">Students appear here once the school enrols them in this class.</EmptyState>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Student</Th>
                {book.columns.map((c) => (
                  <Th key={c.id} className="min-w-28">
                    <span className="block max-w-36 truncate normal-case tracking-normal text-ink-700" title={c.title}>{c.title}</span>
                    <span className="block font-normal normal-case tracking-normal">{GRADE_KIND_LABELS[c.kind]} · {formatDate(c.due_date)}</span>
                  </Th>
                ))}
                <Th className="min-w-28">Other grades</Th>
                <Th className="text-right">Average</Th>
                <Th><span className="sr-only">Add grade</span></Th>
              </tr>
            </thead>
            <tbody>
              {book.students.map((s) => {
                const other = s.grades.filter((g) => !g.assessment_id || !columnIds.has(g.assessment_id));
                return (
                  <tr key={s.id}>
                    <Td>
                      <span className="flex items-center gap-2.5">
                        <Avatar name={s.display_name} color={s.avatar_color} emoji={s.avatar_emoji} size="sm" />
                        <span className="whitespace-nowrap font-semibold text-ink-900">{s.display_name}</span>
                      </span>
                    </Td>
                    {book.columns.map((c) => {
                      const gs = s.grades.filter((g) => g.assessment_id === c.id);
                      return (
                        <Td key={c.id}>
                          {gs.length === 0 ? <span className="text-ink-300" aria-label="No grade">—</span> : <span className="flex flex-wrap gap-1">{gs.map((g) => chip(g, s.display_name))}</span>}
                        </Td>
                      );
                    })}
                    <Td>
                      {other.length === 0 ? <span className="text-ink-300" aria-label="No grade">—</span> : <span className="flex flex-wrap gap-1">{other.map((g) => chip(g, s.display_name))}</span>}
                    </Td>
                    <Td className="text-right">
                      {s.average === null ? (
                        <span className="text-ink-400">—</span>
                      ) : (
                        <details className="group inline-block text-right">
                          <summary className="cursor-pointer list-none">
                            <Badge tone={gradeTone(s.average)} className="text-sm">{s.average}</Badge>
                            <span className="block text-[11px] font-semibold text-brand-700 group-open:hidden">How?</span>
                          </summary>
                          <p className="mt-1 max-w-56 text-left text-[11px] leading-snug text-ink-600">{s.formula}</p>
                        </details>
                      )}
                    </Td>
                    <Td className="text-right">
                      <AddGradeDialog student={{ id: s.id, name: s.display_name }} common={common} />
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>

      <div className="mt-5">
        <Notice tone="blue" icon={Sigma} title="How averages are calculated">
          <p>
            Each student&apos;s subject average is the <strong>weighted mean</strong>: Σ(score × weight) ÷ Σ(weight), rounded to two decimals.
            A test with weight 2 counts twice as much as an oral answer with weight 1. The class average uses the same formula over every grade in the class.
          </p>
          {example && <p className="mt-1">Example — {example.display_name}: {example.formula}.</p>}
          <p className="mt-1">Small ×2 marks on a grade show its weight when it isn&apos;t 1.</p>
        </Notice>
      </div>
    </div>
  );
}
