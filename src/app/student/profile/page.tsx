import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { getStudentProfile, listInterests } from "@/lib/services/profile";
import { Avatar, Badge, Card, LinkButton, PageHeader } from "@/components/ui";
import { GOAL_OPTIONS } from "@/lib/constants";
import { ProfileForm } from "./form";

export const metadata: Metadata = { title: "My profile" };

export default async function ProfilePage() {
  const user = await requireUser(["student"]);
  const [profile, interests] = await Promise.all([getStudentProfile(user), listInterests(user)]);
  const labels = new Map(interests.map((i) => [i.id, i.label]));

  return (
    <div className="animate-fade-up">
      <PageHeader title="My profile" description="How classmates see you, and what we use to suggest people and groups." actions={<LinkButton href="/settings" variant="secondary">Privacy & settings</LinkButton>} />
      <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Card className="text-center">
            <div className="flex justify-center"><Avatar name={profile.displayName} color={profile.avatarColor} emoji={profile.avatarEmoji} size="lg" /></div>
            <p className="mt-3 text-lg font-bold">{profile.displayName}</p>
            <p className="text-sm text-ink-500">{[profile.showClass && profile.gradeLevel ? `Grade ${profile.gradeLevel}` : null, user.schoolName].filter(Boolean).join(" · ")}</p>
            {profile.bio && <p className="mt-2 text-sm text-ink-700">{profile.bio}</p>}
            <div className="mt-3 flex flex-wrap justify-center gap-1">
              {profile.interestIds.map((id) => <Badge key={id}>{labels.get(id)}</Badge>)}
            </div>
            {profile.goals.length > 0 && (
              <div className="mt-2 flex flex-wrap justify-center gap-1">{profile.goals.map((g) => <Badge key={g} tone="pink">{GOAL_OPTIONS[g]}</Badge>)}</div>
            )}
            <p className="mt-4 text-xs text-ink-500">
              {profile.discoverable ? "Visible to students at your school in suggestions." : "Hidden from suggestions. Only your connections can see your profile."}
            </p>
          </Card>
          {profile.className && <p className="px-2 text-xs text-ink-500">Your class ({profile.className}) is managed by your school and only visible to staff.</p>}
        </aside>
        <Card className="p-6">
          <ProfileForm profile={profile} interests={interests} />
        </Card>
      </div>
    </div>
  );
}
