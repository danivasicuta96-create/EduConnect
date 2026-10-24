import type { Metadata } from "next";
import { CalendarClock, ClipboardList, Info, Lock, ShieldCheck, UserRound } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getChildren, type ChildOverview } from "@/lib/services/parent";
import { CONSENT_LABELS } from "@/lib/constants";
import { formatDate } from "@/lib/dates";
import { Avatar, Badge, Card, CardHeader, EmptyState, Notice, PageHeader, Stat, Table, Td, Th, gradeTone } from "@/components/ui";
import { GuardianConsentForm } from "./forms";

export const metadata: Metadata = { title: "My child's progress" };

const STATE: Record<ChildOverview["accountState"], { label: string; tone: "green" | "amber" | "red" }> = {
  active: { label: "Account active", tone: "green" },
  pending_guardian_consent: { label: "Waiting for your consent", tone: "amber" },
  suspended: { label: "Account suspended", tone: "red" },
};

const KIND: Record<string, string> = { test: "Test", quiz: "Quiz", homework: "Homework", project: "Project", oral: "Oral", exam: "Exam" };

function Academics({ child }: { child: ChildOverview }) {
  const a = child.academics;
  if (!a) {
    return (
      <Notice tone="blue" icon={Lock} title="Academic records aren't shared yet">
        {child.linkStatus !== "active"
          ? "Your link to this student is still being confirmed by the school."
          : <>Grades and attendance are shown only after the school records <strong>{CONSENT_LABELS.guardian_access.toLowerCase()}</strong> consent — usually from a signed form. Please contact the school office if you expected to see them.</>}
      </Notice>
    );
  }
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Overall average" value={a.overall ?? "—"} icon={ClipboardList} tone={gradeTone(a.overall)} hint="Romanian 1–10 scale" />
        <Stat label="Attendance" value={a.attendanceRate === null ? "—" : `${a.attendanceRate}%`} icon={UserRound} tone="blue" hint={`${a.attendance.filter((x) => x.status === "absent").length} absences recorded`} />
        <Stat label="Coming up" value={a.upcoming.length} icon={CalendarClock} tone="amber" hint="Assessments in the next 30 days" />
      </div>

      <div>
        <h3 className="mb-2 text-sm font-bold text-ink-900">Grades by subject</h3>
        {a.subjects.length === 0 ? (
          <EmptyState icon={ClipboardList} title="No subjects yet">Subjects appear once your child is enrolled in a class.</EmptyState>
        ) : (
          <Table>
            <thead>
              <tr><Th>Subject</Th><Th>Average</Th><Th>Recent grades</Th><Th>Attendance</Th></tr>
            </thead>
            <tbody>
              {a.subjects.map((s) => (
                <tr key={s.subjectId}>
                  <Td className="font-semibold">{s.name}</Td>
                  <Td>{s.average === null ? <span className="text-ink-400">—</span> : <Badge tone={gradeTone(s.average)} className="text-sm">{s.average}</Badge>}</Td>
                  <Td>
                    {s.grades.length === 0 ? (
                      <span className="text-xs text-ink-400">No grades yet</span>
                    ) : (
                      <span className="flex flex-wrap gap-1">
                        {s.grades.slice(0, 5).map((g) => (
                          <span key={g.id} title={`${g.assessment_title ?? KIND[g.kind] ?? g.kind} · ${formatDate(g.graded_on)}`} className="rounded-md bg-ink-50 px-1.5 py-0.5 text-xs font-semibold text-ink-800 ring-1 ring-ink-100">
                            {g.score}
                          </span>
                        ))}
                        {s.grades.length > 5 && <span className="text-xs text-ink-500">+{s.grades.length - 5}</span>}
                      </span>
                    )}
                  </Td>
                  <Td className="text-xs text-ink-600">
                    {s.attendance.rate === null ? "—" : `${s.attendance.rate}%`}
                    {(s.attendance.absent > 0 || s.attendance.late > 0) && (
                      <span className="block text-ink-500">{s.attendance.absent} absent · {s.attendance.late} late</span>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </div>

      <div>
        <h3 className="mb-2 text-sm font-bold text-ink-900">Upcoming assessments</h3>
        {a.upcoming.length === 0 ? (
          <p className="text-sm text-ink-500">Nothing scheduled in the next 30 days.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {a.upcoming.map((u) => (
              <li key={u.id} className="rounded-xl bg-amber-50 px-3 py-2.5 text-sm">
                <p className="font-semibold text-amber-950">{u.title}</p>
                <p className="text-xs text-amber-900">
                  {u.subject_name} · {KIND[u.kind] ?? u.kind} · {formatDate(u.due_date, { weekday: "short", day: "numeric", month: "short" })}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default async function ParentHome() {
  const user = await requireUser(["parent"]);
  const children = await getChildren(user);

  return (
    <div className="space-y-6 animate-fade-up">
      <PageHeader
        eyebrow={user.schoolName}
        title={children.length === 1 ? `${children[0].displayName.split(" ")[0]}'s progress` : "My children's progress"}
        description="Grades, attendance and upcoming assessments shared by the school."
      />

      {children.length === 0 ? (
        <EmptyState icon={UserRound} title="No linked students yet">
          The school links your account to your child. If you expected to see someone here, please contact the school office.
        </EmptyState>
      ) : (
        children.map((child) => (
          <div key={child.id} className="space-y-5">
            <Card>
              <CardHeader
                title={
                  <span className="flex items-center gap-3">
                    <Avatar name={child.displayName} color={child.avatarColor} emoji={child.avatarEmoji} />
                    <span>
                      {child.displayName}
                      <span className="block text-sm font-normal text-ink-500">
                        {child.academics?.className ? `Class ${child.academics.className}` : child.gradeLevel ? `Grade ${child.gradeLevel}` : "Student"}
                      </span>
                    </span>
                  </span>
                }
                action={<Badge tone={STATE[child.accountState].tone}>{STATE[child.accountState].label}</Badge>}
              />
              <Academics child={child} />
            </Card>

            <Card>
              <CardHeader title={`Your consent choices for ${child.displayName.split(" ")[0]}`} icon={ShieldCheck} />
              {child.accountState === "pending_guardian_consent" && !child.selfConsent && (
                <div className="mb-4">
                  <Notice tone="amber" icon={Info} title="Your consent is needed">
                    Your child&apos;s account is limited until you allow the use of EduConnect AI. Other features stay off unless you allow them.
                  </Notice>
                </div>
              )}
              {child.linkStatus !== "active" ? (
                <p className="text-sm text-ink-600">You can record choices once the school has confirmed your link.</p>
              ) : child.selfConsent ? (
                <div className="space-y-3">
                  <Notice tone="blue" icon={Info}>Your child is 16 or older and manages these choices in their own account.</Notice>
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {(["platform", "wellbeing_checkins", "matchmaking", "ai_features"] as const).map((t) => (
                      <li key={t} className="flex items-center justify-between gap-2 rounded-xl bg-ink-50 px-3 py-2 text-sm">
                        <span>{CONSENT_LABELS[t]}</span>
                        <Badge tone={child.consents[t].granted ? "green" : "neutral"}>{child.consents[t].granted ? "On" : "Off"}</Badge>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <GuardianConsentForm
                  studentId={child.id}
                  childName={child.displayName}
                  current={Object.fromEntries(
                    (["platform", "wellbeing_checkins", "matchmaking", "ai_features"] as const).map((t) => [t, child.consents[t].recordedAt ? child.consents[t].granted : null]),
                  )}
                />
              )}
            </Card>
          </div>
        ))
      )}

      <Notice tone="neutral" icon={Lock} title="Your child's privacy">
        Wellbeing check-ins and journal notes belong to your child and are never shown to parents or teachers. If school staff
        have a concern, they will contact you through the usual school channels.
      </Notice>
    </div>
  );
}
