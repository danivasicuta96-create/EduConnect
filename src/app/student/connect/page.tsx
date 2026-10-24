import type { Metadata } from "next";
import { Handshake, Lock, Info, Sparkles } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { studentAccess } from "@/lib/services/consent";
import { getConnections, getRecommendations } from "@/lib/services/connect";
import { GOAL_OPTIONS } from "@/lib/constants";
import { WEIGHTS } from "@/lib/engines/matching";
import { Avatar, Badge, Card, EmptyState, LinkButton, Notice, PageHeader, ProgressBar } from "@/components/ui";
import { ConnectNav } from "./nav";
import { ConnectButton, DismissButton, SafetyMenu } from "./peer-actions";

export const metadata: Metadata = { title: "Discover" };

export default async function DiscoverPage() {
  const user = await requireUser(["student"]);
  const access = await studentAccess(user, user.id);
  if (!access.matchmaking) {
    return (
      <>
        <PageHeader title="Connect" />
        <ConnectNav />
        <EmptyState icon={Lock} title="Matchmaking is switched off" action={<LinkButton href="/settings" variant="soft">Review in Settings</LinkButton>}>
          {access.active ? "Turn matchmaking on in Settings to discover classmates with similar interests." : "Your school is waiting for a parent or guardian's consent."}
        </EmptyState>
      </>
    );
  }
  const [recs, conns] = await Promise.all([getRecommendations(user, 12), getConnections(user)]);

  return (
    <div className="animate-fade-up">
      <PageHeader eyebrow="Connect" title="Discover classmates" description="Students at your school who share your interests and goals." />
      <ConnectNav incoming={conns.incoming.length} />

      {recs.length === 0 ? (
        <EmptyState icon={Handshake} title="No suggestions right now" action={<LinkButton href="/student/profile" variant="soft">Update my interests</LinkButton>}>
          Add more interests or goals to your profile, or check back later as more classmates join.
        </EmptyState>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {recs.map((r) => (
            <li key={r.id}>
              <Card as="article" className="flex h-full flex-col gap-3">
                <div className="flex items-start gap-3">
                  <Avatar name={r.displayName} color={r.avatarColor} emoji={r.avatarEmoji} />
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate font-bold">{r.displayName}</h2>
                    <p className="text-xs text-ink-500">{r.gradeLevel ? `Grade ${r.gradeLevel}` : "Student"}</p>
                  </div>
                  <Badge tone="brand" className="shrink-0"><Sparkles className="size-3" aria-hidden /> {r.match.score}% match</Badge>
                </div>
                {r.bio && <p className="text-sm text-ink-600">{r.bio}</p>}
                <ul className="space-y-1 text-sm text-ink-700">
                  {r.match.reasons.map((reason) => <li key={reason}>• {reason}</li>)}
                </ul>
                <details className="text-xs text-ink-500">
                  <summary className="cursor-pointer font-semibold text-ink-600">Why this match?</summary>
                  <div className="mt-2 space-y-1.5">
                    {([
                      ["Shared interests", r.match.breakdown.interests, WEIGHTS.interestJaccard + WEIGHTS.interestCount],
                      ["Shared goals", r.match.breakdown.goals, WEIGHTS.goals],
                      ["Learning style", r.match.breakdown.learningStyle, WEIGHTS.learningStyle],
                      ["Open to the same things", r.match.breakdown.openTo, WEIGHTS.openTo],
                      ["Grade level", r.match.breakdown.grade, WEIGHTS.grade],
                    ] as const).map(([label, v, max]) => (
                      <div key={label}>
                        <div className="flex justify-between"><span>{label}</span><span>{v}/{max}</span></div>
                        <ProgressBar value={v} max={max} label={`${label}: ${v} of ${max}`} />
                      </div>
                    ))}
                    <p className="pt-1">Based only on what you both chose to share. Never on grades, check-ins or personal characteristics.</p>
                  </div>
                </details>
                {r.match.sharedGoals.length > 0 && (
                  <div className="flex flex-wrap gap-1">{r.match.sharedGoals.map((g) => <Badge key={g} tone="pink">{GOAL_OPTIONS[g]}</Badge>)}</div>
                )}
                <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
                  <ConnectButton otherId={r.id} name={r.displayName} />
                  <DismissButton otherId={r.id} />
                </div>
                <SafetyMenu otherId={r.id} name={r.displayName} />
              </Card>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-6">
        <Notice tone="blue" icon={Info} title="How suggestions work">
          Suggestions only include students at your school, within two grade levels of you, who have chosen to be discoverable.
          The match score adds up shared interests (up to 66 points), goals (16), learning style (6), what you&apos;re open to (6) and grade (6).
          You can hide yourself any time in your <a href="/student/profile">profile</a>.
        </Notice>
      </div>
    </div>
  );
}
