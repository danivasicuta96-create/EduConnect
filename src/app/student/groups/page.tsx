import type { Metadata } from "next";
import { UsersRound, Mail, Sparkles, Lock, MapPin } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { studentAccess } from "@/lib/services/consent";
import { getGroups, type GroupView } from "@/lib/services/connect";
import { getStudentAcademics } from "@/lib/services/academics";
import { listInterests } from "@/lib/services/profile";
import { Avatar, Badge, Card, CardHeader, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { ActionButton } from "@/components/forms";
import { ConnectNav } from "../connect/nav";
import { joinGroupAction, leaveGroupAction } from "../connect/actions";
import { CreateGroupForm } from "./create-form";

export const metadata: Metadata = { title: "Study groups" };

function GroupCard({ g, children, highlight }: { g: GroupView; children?: React.ReactNode; highlight?: boolean }) {
  return (
    <Card as="article" className={highlight ? "flex h-full flex-col gap-3 bg-blush-50 ring-blush-200" : "flex h-full flex-col gap-3"}>
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-bold">{g.name}</h3>
        {g.subjectName && <Badge tone="brand">{g.subjectName}</Badge>}
      </div>
      {g.description && <p className="text-sm text-ink-600">{g.description}</p>}
      {g.reasons.length > 0 && <p className="flex items-center gap-1.5 text-xs font-semibold text-brand-700"><Sparkles className="size-3.5" aria-hidden /> {g.reasons.join(" · ")}</p>}
      {g.meetingInfo && <p className="flex items-center gap-1.5 text-xs text-ink-500"><MapPin className="size-3.5" aria-hidden /> {g.meetingInfo}</p>}
      <div className="flex items-center gap-2">
        <div className="flex -space-x-2">
          {g.members.slice(0, 5).map((m) => (
            <span key={m.id} className="rounded-full ring-2 ring-white" title={m.displayName}><Avatar name={m.displayName} color={m.avatarColor} emoji={m.avatarEmoji} size="sm" /></span>
          ))}
        </div>
        <span className="text-xs text-ink-500">{g.members.length}/{g.maxMembers} members</span>
      </div>
      {g.interests.length > 0 && <div className="flex flex-wrap gap-1">{g.interests.map((i) => <Badge key={i}>{i}</Badge>)}</div>}
      <div className="mt-auto flex flex-wrap gap-2 pt-1">{children}</div>
    </Card>
  );
}

export default async function GroupsPage() {
  const user = await requireUser(["student"]);
  const access = await studentAccess(user, user.id);
  if (!access.matchmaking) {
    return (
      <>
        <PageHeader title="Study groups" />
        <ConnectNav />
        <EmptyState icon={Lock} title="Social features are switched off" action={<LinkButton href="/settings" variant="soft">Review in Settings</LinkButton>} />
      </>
    );
  }
  const [g, academics, interests] = await Promise.all([getGroups(user), getStudentAcademics(user), listInterests(user)]);

  return (
    <div className="animate-fade-up">
      <PageHeader eyebrow="Connect" title="Study groups" description="Learn together with classmates who share your subjects and interests." />
      <ConnectNav />

      <div className="space-y-6">
        {g.invited.length > 0 && (
          <section aria-labelledby="inv">
            <h2 id="inv" className="mb-3 flex items-center gap-2 font-bold"><Mail className="size-4 text-brand-600" aria-hidden /> Invitations</h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {g.invited.map((x) => (
                <GroupCard key={x.id} g={x} highlight>
                  <ActionButton action={joinGroupAction} hidden={{ groupId: x.id }} variant="primary">Join</ActionButton>
                  <ActionButton action={leaveGroupAction} hidden={{ groupId: x.id }}>Decline</ActionButton>
                </GroupCard>
              ))}
            </div>
          </section>
        )}

        <section aria-labelledby="mine">
          <h2 id="mine" className="mb-3 flex items-center gap-2 font-bold"><UsersRound className="size-4 text-brand-600" aria-hidden /> My groups</h2>
          {g.mine.length === 0 ? (
            <p className="text-sm text-ink-500">You haven&apos;t joined a group yet.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {g.mine.map((x) => (
                <GroupCard key={x.id} g={x}>
                  {x.isOwner ? <Badge tone="violet">You created this group</Badge> : <ActionButton action={leaveGroupAction} hidden={{ groupId: x.id }} variant="ghost" confirm={`Leave ${x.name}?`}>Leave group</ActionButton>}
                </GroupCard>
              ))}
            </div>
          )}
        </section>

        {g.suggested.length > 0 && (
          <section aria-labelledby="sugg">
            <h2 id="sugg" className="mb-3 flex items-center gap-2 font-bold"><Sparkles className="size-4 text-brand-600" aria-hidden /> Suggested for you</h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {g.suggested.map((x) => (
                <GroupCard key={x.id} g={x}>
                  <ActionButton action={joinGroupAction} hidden={{ groupId: x.id }} variant="primary">Join group</ActionButton>
                </GroupCard>
              ))}
            </div>
          </section>
        )}

        <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
          <section aria-labelledby="all">
            <h2 id="all" className="mb-3 font-bold">All groups at your school</h2>
            {g.others.length === 0 ? (
              <p className="text-sm text-ink-500">No other groups yet — start one!</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {g.others.map((x) => (
                  <GroupCard key={x.id} g={x}>
                    {x.members.length >= x.maxMembers ? <Badge>Full</Badge> : <ActionButton action={joinGroupAction} hidden={{ groupId: x.id }} variant="soft">Join group</ActionButton>}
                  </GroupCard>
                ))}
              </div>
            )}
          </section>
          <Card className="self-start">
            <CardHeader title="Start a study group" />
            <CreateGroupForm subjects={academics.subjects.map((s) => ({ id: s.subjectId, name: s.name }))} interests={interests.map((i) => ({ id: i.id, label: i.label }))} />
          </Card>
        </div>
      </div>
    </div>
  );
}
