import type { Metadata } from "next";
import { Lock, Eye, ShieldCheck, Users, Phone } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { todayIn, formatDate } from "@/lib/dates";
import { studentAccess } from "@/lib/services/consent";
import { getCheckin } from "@/lib/services/wellbeing";
import { Card, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { WellbeingNav } from "./nav";
import { CheckinForm } from "./checkin-form";

export const metadata: Metadata = { title: "Daily check-in" };

export default async function CheckinPage({ searchParams }: PageProps<"/student/wellbeing">) {
  const user = await requireUser(["student"]);
  const access = await studentAccess(user, user.id);
  const today = todayIn(user.timezone);
  const sp = await searchParams;
  const existing = access.checkins ? await getCheckin(user, today) : null;
  const quickMood = Number(sp.mood);

  return (
    <div className="animate-fade-up">
      <PageHeader eyebrow={formatDate(today, { weekday: "long", day: "numeric", month: "long" })} title="Daily check-in" description="About one minute. There are no right or wrong answers." />
      <WellbeingNav />
      {!access.checkins ? (
        <EmptyState icon={Lock} title="Check-ins are switched off" action={<LinkButton href="/settings" variant="soft">Review in Settings</LinkButton>}>
          {access.active ? "You can turn daily check-ins on in Settings whenever you like." : "Your school is waiting for a parent or guardian's consent."}
        </EmptyState>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
          <Card className="p-6">
            <CheckinForm
              isUpdate={Boolean(existing)}
              defaults={{
                mood: existing?.mood ?? (quickMood >= 1 && quickMood <= 10 ? quickMood : null),
                experience: existing?.experience ?? null,
                factors: existing?.factors ?? [],
                note: existing?.note ?? null,
                shareNote: existing?.shared_with_counselor ?? false,
              }}
            />
          </Card>
          <aside className="space-y-4">
            <Card>
              <h2 className="font-bold">Who sees what</h2>
              <ul className="mt-3 space-y-3 text-sm text-ink-600">
                <li className="flex gap-2.5"><Lock className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden /><span><strong className="text-ink-900">Your notes</strong> are private to you, unless you choose to share one with the counselor.</span></li>
                <li className="flex gap-2.5"><Eye className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden /><span><strong className="text-ink-900">Your scores</strong> power your own trends. Teachers only see anonymous class averages, and only for groups of 5 or more students.</span></li>
                <li className="flex gap-2.5"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden /><span><strong className="text-ink-900">If your scores stay low</strong> for a while (for example, a 7-day average below 5), a trained school counselor may be told, so they can offer a friendly chat. It&apos;s not a diagnosis, and nobody gets in trouble.</span></li>
                <li className="flex gap-2.5"><Users className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden /><span><strong className="text-ink-900">Classmates</strong> never see anything about your check-ins.</span></li>
              </ul>
            </Card>
            <Card className="bg-red-50 ring-red-100">
              <p className="flex items-center gap-2 font-bold text-red-900"><Phone className="size-4" aria-hidden /> Need help right now?</p>
              <p className="mt-1 text-sm text-red-900">Call <a href="tel:112" className="font-bold underline">112</a> in an emergency, or <a href="tel:116111" className="font-bold underline">116 111</a> (Telefonul Copilului, free).</p>
              <LinkButton href="/student/wellbeing/support" variant="secondary" size="sm" className="mt-3">More support options</LinkButton>
            </Card>
          </aside>
        </div>
      )}
    </div>
  );
}
