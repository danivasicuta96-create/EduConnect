import type { Metadata } from "next";
import { BellRing, Database, FlaskConical, Globe2, KeyRound, School, ShieldCheck } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { DEFAULT_RETENTION, getSchoolSettings, listAlertRules } from "@/lib/services/admin";
import { demoModeEnabled } from "@/lib/request";
import { formatDateTime } from "@/lib/dates";
import { Badge, Card, CardHeader, EmptyState, Notice, PageHeader } from "@/components/ui";
import { AlertRuleForm, CleanupForm, RegenerateCodeForm, RetentionForm, SchoolInfoForm } from "./forms";

export const metadata: Metadata = { title: "System configuration" };

const REGION_LABELS: Record<string, string> = { eu: "European Union (EU)" };

function timeZones(current: string): string[] {
  let all: string[] = [];
  try {
    all = Intl.supportedValuesOf("timeZone").filter((tz) => tz.startsWith("Europe/"));
  } catch {
    all = ["Europe/Bucharest", "Europe/London", "Europe/Berlin", "Europe/Paris"];
  }
  return Array.from(new Set([current, "UTC", ...all])).sort();
}

export default async function SettingsPage() {
  const user = await requireUser(["admin"]);
  const [school, rules] = await Promise.all([getSchoolSettings(user), listAlertRules(user)]);
  if (!school) return <EmptyState title="School not found" />;
  const wDays = Number(school.settings.wellbeing_retention_days ?? DEFAULT_RETENTION.wellbeing_retention_days);
  const aDays = Number(school.settings.audit_retention_days ?? DEFAULT_RETENTION.audit_retention_days);
  const demo = demoModeEnabled();

  return (
    <div className="space-y-6 animate-fade-up">
      <PageHeader
        title="System configuration"
        description="School details, data protection settings and wellbeing alert thresholds."
        actions={demo || school.is_demo ? <Badge tone="violet"><FlaskConical className="size-3.5" aria-hidden /> Demo mode{school.is_demo ? " · fictional school" : ""}</Badge> : undefined}
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="School" icon={School} />
          <SchoolInfoForm name={school.name} timezone={school.timezone} timezones={timeZones(school.timezone)} />
        </Card>

        <Card>
          <CardHeader title="School join code" icon={KeyRound} subtitle="Students can register with this code (invitation codes are separate)" />
          <p className="mb-4">
            <code className="select-all rounded-xl bg-ink-50 px-3 py-2 text-lg font-bold tracking-widest text-ink-900 ring-1 ring-ink-100">{school.join_code}</code>
          </p>
          <p className="mb-3 text-sm text-ink-600">
            Regenerate the code if it has been shared outside the school. Students already registered aren&apos;t affected.
          </p>
          <RegenerateCodeForm />
        </Card>

        <Card>
          <CardHeader title="Data retention" icon={Database} subtitle="How long sensitive data is kept" />
          <RetentionForm wellbeingDays={wDays} auditDays={aDays} />
          <hr className="my-5 border-ink-100" />
          <h3 className="text-sm font-bold text-ink-900">Clean up now</h3>
          <p className="mb-3 mt-1 text-sm text-ink-600">
            Deletes check-ins (with their private notes) older than {wDays} days and audit events older than {aDays} days.
            Only counts are reported and logged.
          </p>
          <CleanupForm />
        </Card>

        <Card>
          <CardHeader title="Data protection" icon={ShieldCheck} />
          <dl className="space-y-3 text-sm">
            <div className="flex items-start gap-3">
              <Globe2 className="mt-0.5 size-4 shrink-0 text-ink-500" aria-hidden />
              <div>
                <dt className="font-semibold text-ink-800">Data region</dt>
                <dd className="text-ink-600">{REGION_LABELS[school.data_region] ?? school.data_region.toUpperCase()} — data is stored and processed in the EU.</dd>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-ink-500" aria-hidden />
              <div>
                <dt className="font-semibold text-ink-800">Wellbeing data</dt>
                <dd className="text-ink-600">
                  Kept separate from academic data. Administrators don&apos;t see check-ins, notes or alerts unless granted a wellbeing permission on the Users page.
                </dd>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <FlaskConical className="mt-0.5 size-4 shrink-0 text-ink-500" aria-hidden />
              <div>
                <dt className="font-semibold text-ink-800">Demo mode</dt>
                <dd className="text-ink-600">
                  {demo ? "On — demo sign-in shortcuts are available and the seeded schools are fictional." : "Off."}
                  {school.is_demo && " This school contains only fictional demo data."}
                </dd>
              </div>
            </div>
          </dl>
        </Card>
      </div>

      <Card>
        <CardHeader title="Wellbeing alert rules" icon={BellRing} subtitle="Thresholds that suggest a counselor follow-up" />
        <Notice tone="blue" title="How rules work">
          Rules look only at check-in scores and create a support suggestion for staff with the <em>Review wellbeing alerts</em> permission.
          They are configurable examples, not clinically validated thresholds, and never produce a diagnosis. Counselors manage them day to day
          in their own portal; you can adjust them here, but you won&apos;t see who triggered them.
        </Notice>
        {rules.length === 0 ? (
          <div className="mt-4"><EmptyState icon={BellRing} title="No rules configured">Counselors can add rules in the counselor portal.</EmptyState></div>
        ) : (
          <ul className="mt-4 grid gap-4 lg:grid-cols-2">
            {rules.map((r) => (
              <li key={r.id} className="rounded-2xl bg-ink-50 p-4">
                <AlertRuleForm rule={r} />
                <p className="mt-2 text-xs text-ink-500">Last updated {formatDateTime(r.updated_at)}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
