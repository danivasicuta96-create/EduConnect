import type { Metadata } from "next";
import { BadgeCheck, Globe, LifeBuoy, Lock, Phone, Plus, School } from "lucide-react";
import { requirePermission, requireUser } from "@/lib/auth/session";
import { daysBetween, formatDate, todayIn } from "@/lib/dates";
import { PERMS, RESOURCE_CATEGORY_LABELS, listResources, type ResourceItem } from "@/lib/services/counselor";
import { ActionButton } from "@/components/forms";
import { Badge, Card, CardHeader, EmptyState, Notice, PageHeader } from "@/components/ui";
import { deleteResourceAction, verifyResourceAction } from "./actions";
import { ResourceForm } from "./forms";

export const metadata: Metadata = { title: "Support resources" };

function Verified({ date, today }: { date: string | null; today: string }) {
  if (!date) return <Badge tone="amber">Never verified</Badge>;
  const age = daysBetween(date, today);
  return <Badge tone={age > 180 ? "amber" : "green"}>Verified {formatDate(date, { day: "numeric", month: "short", year: "numeric" })}{age > 180 ? " · review due" : ""}</Badge>;
}

function ResourceSummary({ r, today }: { r: ResourceItem; today: string }) {
  return (
    <div className="min-w-0">
      <p className="flex flex-wrap items-center gap-2 font-bold text-ink-900">
        {r.name}
        <Badge tone={r.category === "emergency" ? "red" : "neutral"}>{RESOURCE_CATEGORY_LABELS[r.category] ?? r.category}</Badge>
      </p>
      <p className="mt-1 text-sm text-ink-600">{r.description}</p>
      <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-500">
        {r.phone && <span className="inline-flex items-center gap-1"><Phone className="size-3.5" aria-hidden /> {r.phone}</span>}
        {r.url && <span className="inline-flex items-center gap-1 break-all"><Globe className="size-3.5" aria-hidden /> {r.url}</span>}
        {r.hours && <span>{r.hours}</span>}
      </p>
      <div className="mt-2"><Verified date={r.lastVerified} today={today} /></div>
    </div>
  );
}

export default async function ResourcesPage() {
  await requireUser(["counselor"]);
  const user = await requirePermission(PERMS.alerts);
  const today = todayIn(user.timezone);
  const { school, platform } = await listResources(user);

  return (
    <div className="space-y-6 animate-fade-up">
      <PageHeader
        title="Support resources"
        description="What students see on their “Get support” page. Keep phone numbers and hours checked — out-of-date help is no help."
      />

      <section aria-labelledby="school-res" className="space-y-3">
        <h2 id="school-res" className="flex items-center gap-2 text-lg font-bold text-ink-900"><School className="size-5 text-brand-600" aria-hidden /> Your school&apos;s resources</h2>
        {school.length === 0 ? (
          <EmptyState icon={LifeBuoy} title="No school resources yet">Add your office hours, room and how students can reach you.</EmptyState>
        ) : (
          <ul className="space-y-3">
            {school.map((r) => (
              <li key={r.id}>
                <Card>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <ResourceSummary r={r} today={today} />
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <ActionButton action={verifyResourceAction} hidden={{ resourceId: r.id }} variant="soft">
                        <BadgeCheck className="size-4" aria-hidden /> Verified today
                      </ActionButton>
                      <ActionButton action={deleteResourceAction} hidden={{ resourceId: r.id }} variant="ghost" confirm={`Remove "${r.name}"? Students will no longer see it.`}>
                        Remove
                      </ActionButton>
                    </div>
                  </div>
                  <details className="mt-4 border-t border-ink-100 pt-3">
                    <summary className="cursor-pointer text-sm font-semibold text-brand-700 hover:underline">Edit</summary>
                    <div className="mt-4"><ResourceForm resource={r} today={today} /></div>
                  </details>
                </Card>
              </li>
            ))}
          </ul>
        )}
        <Card>
          <CardHeader title="Add a school resource" icon={Plus} />
          <ResourceForm today={today} />
        </Card>
      </section>

      <section aria-labelledby="platform-res" className="space-y-3">
        <h2 id="platform-res" className="flex items-center gap-2 text-lg font-bold text-ink-900"><Lock className="size-5 text-ink-500" aria-hidden /> Platform defaults (read-only)</h2>
        <Notice tone="neutral">
          National helplines maintained by EduConnect for every school in the country. If one looks out of date, tell your administrator so it
          can be reported to the platform team.
        </Notice>
        {platform.length === 0 ? (
          <EmptyState icon={LifeBuoy} title="No platform resources" />
        ) : (
          <ul className="space-y-3">
            {platform.map((r) => (
              <li key={r.id}><Card><ResourceSummary r={r} today={today} /></Card></li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
