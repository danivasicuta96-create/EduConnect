import type { Metadata } from "next";
import { Users, Inbox, Send, Ban, Lock } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { studentAccess } from "@/lib/services/consent";
import { getConnections, getGroups } from "@/lib/services/connect";
import { timeAgo, formatDate } from "@/lib/dates";
import { Avatar, Badge, Card, CardHeader, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { ActionButton } from "@/components/forms";
import { ConnectNav } from "../connect/nav";
import { SafetyMenu } from "../connect/peer-actions";
import { removeConnectionAction, respondAction, unblockAction } from "../connect/actions";
import { InviteToGroup } from "./invite";

export const metadata: Metadata = { title: "Connections" };

export default async function ConnectionsPage() {
  const user = await requireUser(["student"]);
  const access = await studentAccess(user, user.id);
  if (!access.matchmaking) {
    return (
      <>
        <PageHeader title="Connections" />
        <ConnectNav />
        <EmptyState icon={Lock} title="Matchmaking is switched off" action={<LinkButton href="/settings" variant="soft">Review in Settings</LinkButton>} />
      </>
    );
  }
  const [c, groups] = await Promise.all([getConnections(user), getGroups(user)]);

  return (
    <div className="animate-fade-up">
      <PageHeader eyebrow="Connect" title="Connections" description="Requests, the people you're connected with, and who you've blocked." />
      <ConnectNav incoming={c.incoming.length} />

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Requests for you" icon={Inbox} subtitle={c.incoming.length ? `${c.incoming.length} waiting` : undefined} />
          {c.incoming.length === 0 ? (
            <p className="text-sm text-ink-500">No new requests.</p>
          ) : (
            <ul className="space-y-3">
              {c.incoming.map((r) => (
                <li key={r.connectionId} className="rounded-xl bg-ink-50 p-3">
                  <div className="flex items-start gap-3">
                    <Avatar name={r.displayName} color={r.avatarColor} emoji={r.avatarEmoji} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold">{r.displayName} <span className="font-normal text-ink-500">· {timeAgo(r.createdAt)}</span></p>
                      {r.message && <p className="mt-0.5 text-sm text-ink-700">“{r.message}”</p>}
                      {r.interests.length > 0 && <p className="mt-0.5 text-xs text-ink-500">Likes {r.interests.slice(0, 4).join(", ")}</p>}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <ActionButton action={respondAction} hidden={{ connectionId: r.connectionId, accept: "yes" }} variant="primary">Accept</ActionButton>
                    <ActionButton action={respondAction} hidden={{ connectionId: r.connectionId, accept: "no" }}>Decline</ActionButton>
                  </div>
                  <div className="mt-2"><SafetyMenu otherId={r.id} name={r.displayName} /></div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Sent requests" icon={Send} />
          {c.outgoing.length === 0 ? (
            <p className="text-sm text-ink-500">You haven&apos;t sent any pending requests.</p>
          ) : (
            <ul className="space-y-2">
              {c.outgoing.map((r) => (
                <li key={r.connectionId} className="flex items-center gap-3 rounded-xl bg-ink-50 p-3">
                  <Avatar name={r.displayName} color={r.avatarColor} emoji={r.avatarEmoji} size="sm" />
                  <p className="min-w-0 flex-1 text-sm"><span className="font-bold">{r.displayName}</span> <span className="text-ink-500">· sent {timeAgo(r.createdAt)}</span></p>
                  <ActionButton action={removeConnectionAction} hidden={{ connectionId: r.connectionId }} variant="ghost">Cancel</ActionButton>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="My connections" icon={Users} subtitle={`${c.connected.length} connected`} />
          {c.connected.length === 0 ? (
            <EmptyState icon={Users} title="No connections yet" action={<LinkButton href="/student/connect" variant="soft">Discover classmates</LinkButton>} />
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {c.connected.map((r) => (
                <li key={r.connectionId} className="space-y-2 rounded-xl bg-ink-50 p-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={r.displayName} color={r.avatarColor} emoji={r.avatarEmoji} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">{r.displayName}</p>
                      <p className="text-xs text-ink-500">Connected since {formatDate(r.since)}</p>
                    </div>
                  </div>
                  {r.interests.length > 0 && (
                    <div className="flex flex-wrap gap-1">{r.interests.slice(0, 4).map((i) => <Badge key={i}>{i}</Badge>)}</div>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    {groups.mine.length > 0 && <InviteToGroup inviteeId={r.id} groups={groups.mine.filter((g) => !g.members.some((m) => m.id === r.id)).map((g) => ({ id: g.id, name: g.name }))} />}
                    <ActionButton action={removeConnectionAction} hidden={{ connectionId: r.connectionId }} variant="ghost" confirm={`Remove ${r.displayName} from your connections?`}>Remove</ActionButton>
                  </div>
                  <SafetyMenu otherId={r.id} name={r.displayName} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        {c.blocked.length > 0 && (
          <Card className="lg:col-span-2">
            <CardHeader title="Blocked" icon={Ban} subtitle="Blocked students can't contact you or see you in suggestions." />
            <ul className="flex flex-wrap gap-2">
              {c.blocked.map((b) => (
                <li key={b.id} className="flex items-center gap-2 rounded-full bg-ink-50 py-1 pl-3 pr-1 text-sm">
                  {b.displayName}
                  <ActionButton action={unblockAction} hidden={{ otherId: b.id }} variant="ghost">Unblock</ActionButton>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}
