import type { Metadata } from "next";
import { ClipboardCheck, CircleX, Clock, FileCheck } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { formatDate } from "@/lib/dates";
import { getStudentAcademics } from "@/lib/services/academics";
import { Badge, Card, CardHeader, EmptyState, PageHeader, Stat, Table, Td, Th } from "@/components/ui";
import { BarsChart } from "@/components/charts";
import { AcademicsNav } from "../nav";

export const metadata: Metadata = { title: "Attendance" };

const statusTone = { absent: "red", late: "amber", excused: "blue", present: "green" } as const;

export default async function AttendancePage() {
  const user = await requireUser(["student"]);
  const a = await getStudentAcademics(user);
  const absent = a.attendance.filter((r) => r.status === "absent").length;
  const late = a.attendance.filter((r) => r.status === "late").length;
  const excused = a.attendance.filter((r) => r.status === "excused").length;
  const notable = a.attendance.filter((r) => r.status !== "present");

  return (
    <div className="animate-fade-up">
      <PageHeader eyebrow="Academics" title="Attendance" description="Attendance recorded by your teachers." />
      <AcademicsNav />
      {a.attendance.length === 0 ? (
        <EmptyState icon={ClipboardCheck} title="No attendance recorded yet" />
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat label="Attendance rate" value={`${a.attendanceRate}%`} hint="present or late" icon={ClipboardCheck} tone="green" />
            <Stat label="Absences" value={absent} hint="unexcused" icon={CircleX} tone="red" />
            <Stat label="Late" value={late} icon={Clock} tone="amber" />
            <Stat label="Excused" value={excused} icon={FileCheck} tone="blue" />
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader title="By subject" subtitle="Attendance rate (%)" />
              <BarsChart title="Attendance rate by subject" suffix="%" domain={[0, 100]} threshold={90}
                data={a.subjects.filter((s) => s.attendance.total > 0).map((s) => ({ label: s.name.replace(" Language", ""), value: s.attendance.rate }))} />
            </Card>
            <Card>
              <CardHeader title="Absences, lates & excused" />
              {notable.length === 0 ? (
                <p className="text-sm text-ink-500">Perfect attendance — nice!</p>
              ) : (
                <Table>
                  <thead><tr><Th>Date</Th><Th>Subject</Th><Th>Status</Th></tr></thead>
                  <tbody>
                    {notable.map((r, i) => (
                      <tr key={i}>
                        <Td>{formatDate(r.date, { weekday: "short", day: "numeric", month: "short" })}</Td>
                        <Td>{r.subject_name}</Td>
                        <Td><Badge tone={statusTone[r.status as keyof typeof statusTone]}>{r.status}</Badge></Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
