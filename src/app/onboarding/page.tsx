import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { ROLE_HOME } from "@/lib/constants";
import { getStudentProfile, listInterests } from "@/lib/services/profile";
import { canSelfConsent } from "@/lib/services/consent";
import { tenant } from "@/lib/db/tenant";
import { Logo } from "@/components/shell/app-shell";
import { StudentOnboarding, StaffOnboarding } from "./forms";

export const metadata: Metadata = { title: "Set up your account" };

export default async function OnboardingPage() {
  const user = await requireUser();
  if (user.onboarded) redirect(ROLE_HOME[user.role]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-blush-50 to-ink-50">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-4 py-6">
        <Logo />
        <span className="text-sm text-ink-500">{user.schoolName}</span>
      </header>
      <main id="main" className="mx-auto max-w-3xl px-4 pb-16">
        {user.role === "student" ? (
          <StudentStep userId={user.id} actor={user} pending={user.accountState === "pending_guardian_consent"} />
        ) : (
          <StaffOnboarding role={user.role} defaults={{ displayName: user.displayName, avatarColor: user.avatarColor, avatarEmoji: user.avatarEmoji }} />
        )}
      </main>
    </div>
  );
}

async function StudentStep({ userId, actor, pending }: { userId: string; actor: Awaited<ReturnType<typeof requireUser>>; pending: boolean }) {
  const [profile, interests, birthYear] = await Promise.all([
    getStudentProfile(actor),
    listInterests(actor),
    tenant(actor).profiles.findOne({ _id: userId }).then((p) => (p?.birth_year as number | null) ?? null),
  ]);
  return <StudentOnboarding profile={profile} interests={interests} canConsent={!pending && canSelfConsent(birthYear)} pending={pending} />;
}
