import Link from "next/link";
import type { Metadata } from "next";
import { BookOpen, CalendarDays, GraduationCap, Plus, School, UsersRound } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getClassDetail, getSchoolDirectory, listClasses, listSubjects } from "@/lib/services/admin";
import { ROLE_LABELS, WEEKDAYS } from "@/lib/constants";
import { Avatar, Badge, Card, CardHeader, EmptyState, PageHeader, cx } from "@/components/ui";
import { ActionButton } from "@/components/forms";
import { AccountStateBadge } from "../_shared";
import { deleteClassAction, deleteSubjectAction, removeAssignmentAction, removeTimetableAction, unenrollAction } from "./actions";
import { AssignmentForm, ClassForm, EnrollForm, SubjectForm, TimetableForm } from "./forms";

export const metadata: Metadata = { title: "Classes & subjects" };

const DOT: Record<string, string> = {
  coral: "bg-brand-500", pink: "bg-blush-400", rose: "bg-rose-500", amber: "bg-amber-500",
  teal: "bg-teal-500", sky: "bg-sky-500", violet: "bg-violet-500", slate: "bg-ink-500",
};

function Dot({ color }: { color: string }) {
  return <span aria-hidden className={cx("inline-block size-2.5 shrink-0 rounded-full", DOT[color] ?? DOT.coral)} />;
}

export default async function ClassesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser(["admin"]);
  const sp = await searchParams;
  const [classes, subjects, dir] = await Promise.all([listClasses(user), listSubjects(user), getSchoolDirectory(user)]);
  const requested = typeof sp.class === "string" ? sp.class : null;
  const selectedId = classes.find((c) => c.id === requested)?.id ?? classes[0]?.id ?? null;
  const detail = selectedId ? await getClassDetail(user, selectedId) : null;

  const teacherOptions = dir.teachers.map((t) => ({ id: t.user_id, label: `${t.display_name} (${ROLE_LABELS[t.role]})` }));
  const subjectOptions = dir.subjects.map((s) => ({ id: s.id, label: s.name }));
  const enrolledIds = new Set(detail?.students.map((s) => s.user_id) ?? []);
  const studentOptions = dir.students.filter((s) => !enrolledIds.has(s.user_id)).map((s) => ({ id: s.user_id, label: s.display_name }));

  return (
    <div className="space-y-6 animate-fade-up">
      <PageHeader title="Classes & subjects" description="Set up classes, who teaches what, enrolments and the weekly timetable." />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)]">
        <div className="space-y-5">
          <Card>
            <CardHeader title="Classes" icon={School} subtitle={`${classes.length} this year`} />
            {classes.length === 0 ? (
              <EmptyState title="No classes yet">Create your first class below.</EmptyState>
            ) : (
              <nav aria-label="Classes">
                <ul className="space-y-1">
                  {classes.map((c) => (
                    <li key={c.id}>
                      <Link
                        href={`/admin/classes?class=${c.id}`}
                        aria-current={c.id === selectedId ? "page" : undefined}
                        className={cx(
                          "flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm transition-colors",
                          c.id === selectedId ? "bg-brand-600 text-white" : "text-ink-700 hover:bg-ink-50",
                        )}
                      >
                        <span className="min-w-0">
                          <span className="block font-bold">{c.name}</span>
                          <span className={cx("block truncate text-xs", c.id === selectedId ? "text-white/80" : "text-ink-500")}>
                            Grade {c.grade_level} · {c.homeroom_name ?? "no homeroom teacher"}
                          </span>
                        </span>
                        <span className={cx("shrink-0 text-xs font-semibold", c.id === selectedId ? "text-white" : "text-ink-500")}>{c.students} students</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            )}
          </Card>
          <Card>
            <CardHeader title="New class" icon={Plus} />
            <ClassForm teachers={teacherOptions} />
          </Card>
        </div>

        <div className="min-w-0 space-y-5">
          {!detail ? (
            <Card>
              <EmptyState icon={School} title="Select or create a class">Class details, teachers, students and the timetable appear here.</EmptyState>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader
                  title={`Class ${detail.cls.name}`}
                  icon={School}
                  subtitle={`Grade ${detail.cls.grade_level} · ${detail.cls.academic_year}`}
                  action={
                    <ActionButton action={deleteClassAction} hidden={{ id: detail.cls.id }} variant="danger" confirm={`Delete class ${detail.cls.name}? Enrolments, teaching assignments and timetable entries for it will be removed.`}>
                      Delete class
                    </ActionButton>
                  }
                />
                <ClassForm
                  key={detail.cls.id}
                  teachers={teacherOptions}
                  initial={{ id: detail.cls.id, name: detail.cls.name, gradeLevel: detail.cls.grade_level, academicYear: detail.cls.academic_year, homeroomTeacherId: detail.cls.homeroom_teacher_id }}
                />
              </Card>

              <Card>
                <CardHeader title="Teaching assignments" icon={BookOpen} subtitle="Teachers can grade and take attendance only for subjects they're assigned to" />
                {detail.assignments.length === 0 ? (
                  <p className="mb-4 text-sm text-ink-500">No teachers assigned yet.</p>
                ) : (
                  <ul className="mb-4 divide-y divide-ink-50">
                    {detail.assignments.map((a) => (
                      <li key={a.id} className="flex items-center justify-between gap-3 py-2">
                        <span className="flex min-w-0 items-center gap-2 text-sm">
                          <Dot color={a.subject_color} />
                          <span className="font-semibold text-ink-900">{a.subject_name}</span>
                          <span className="truncate text-ink-500">— {a.teacher_name}</span>
                        </span>
                        <ActionButton action={removeAssignmentAction} hidden={{ id: a.id }} variant="ghost" confirm={`Remove ${a.teacher_name} from ${a.subject_name}?`}>Remove</ActionButton>
                      </li>
                    ))}
                  </ul>
                )}
                <AssignmentForm key={`a-${detail.cls.id}`} classId={detail.cls.id} subjects={subjectOptions} teachers={teacherOptions} />
              </Card>

              <Card>
                <CardHeader title="Students" icon={UsersRound} subtitle={`${detail.students.length} enrolled`} />
                {detail.students.length === 0 ? (
                  <p className="mb-4 text-sm text-ink-500">No students in this class yet.</p>
                ) : (
                  <ul className="mb-4 grid gap-2 sm:grid-cols-2">
                    {detail.students.map((s) => (
                      <li key={s.user_id} className="flex items-center gap-2 rounded-xl bg-ink-50 px-3 py-2">
                        <Avatar name={s.display_name} color={s.avatar_color} size="sm" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">{s.display_name}</span>
                          {s.account_state !== "active" && <AccountStateBadge state={s.account_state} />}
                        </span>
                        <ActionButton action={unenrollAction} hidden={{ classId: detail.cls.id, studentId: s.user_id }} variant="ghost" confirm={`Remove ${s.display_name} from ${detail.cls.name}?`}>
                          Remove
                        </ActionButton>
                      </li>
                    ))}
                  </ul>
                )}
                <EnrollForm key={`e-${detail.cls.id}`} classId={detail.cls.id} students={studentOptions} />
              </Card>

              <Card>
                <CardHeader title="Weekly timetable" icon={CalendarDays} subtitle={`${detail.timetable.length} lessons`} />
                {detail.timetable.length === 0 ? (
                  <p className="mb-4 text-sm text-ink-500">No lessons scheduled yet.</p>
                ) : (
                  <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {[1, 2, 3, 4, 5, 6, 7]
                      .filter((d) => detail.timetable.some((t) => t.weekday === d))
                      .map((d) => (
                        <div key={d} className="rounded-xl bg-ink-50 p-3">
                          <h3 className="mb-2 text-sm font-bold text-ink-900">{WEEKDAYS[d]}</h3>
                          <ul className="space-y-1.5">
                            {detail.timetable.filter((t) => t.weekday === d).map((t) => (
                              <li key={t.id} className="flex items-center justify-between gap-2 rounded-lg bg-white px-2 py-1.5 text-xs ring-1 ring-ink-100">
                                <span className="min-w-0">
                                  <span className="flex items-center gap-1.5 font-semibold text-ink-800">
                                    <Dot color={t.subject_color} /> {t.start_time}–{t.end_time} {t.subject_name}
                                  </span>
                                  <span className="block truncate text-ink-500">{t.teacher_name ?? "No teacher"}{t.room && ` · Room ${t.room}`}</span>
                                </span>
                                <ActionButton action={removeTimetableAction} hidden={{ id: t.id }} variant="ghost" title="Remove lesson" confirm="Remove this lesson from the timetable?">
                                  <span aria-hidden>×</span><span className="sr-only">Remove {t.subject_name} on {WEEKDAYS[d]} at {t.start_time}</span>
                                </ActionButton>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                  </div>
                )}
                <TimetableForm key={`t-${detail.cls.id}`} classId={detail.cls.id} subjects={subjectOptions} teachers={teacherOptions} />
              </Card>
            </>
          )}
        </div>
      </div>

      <Card>
        <CardHeader title="Subjects" icon={GraduationCap} subtitle="Shared by every class in the school" />
        {subjects.length === 0 ? (
          <p className="mb-4 text-sm text-ink-500">No subjects yet.</p>
        ) : (
          <ul className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {subjects.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-2 rounded-xl bg-ink-50 px-3 py-2">
                <span className="flex min-w-0 items-center gap-2 text-sm">
                  <Dot color={s.color} />
                  <span className="truncate font-semibold">{s.name}</span>
                  <Badge>{s.classes} class{s.classes === 1 ? "" : "es"}</Badge>
                </span>
                {s.grades === 0 ? (
                  <ActionButton action={deleteSubjectAction} hidden={{ id: s.id }} variant="ghost" confirm={`Delete ${s.name}? Teaching assignments and lessons for it will be removed.`}>Delete</ActionButton>
                ) : (
                  <span className="text-xs text-ink-500" title="Subjects with recorded grades can't be deleted">In use</span>
                )}
              </li>
            ))}
          </ul>
        )}
        <SubjectForm />
      </Card>
    </div>
  );
}
