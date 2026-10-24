import type { Metadata } from "next";
import { MailPlus, Mails, UsersRound, UserX } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getSchoolDirectory, listInvitations, listUsers, userFilterSchema } from "@/lib/services/admin";
import { PERMISSION_LABELS, ROLE_LABELS } from "@/lib/constants";
import { formatDate, timeAgo } from "@/lib/dates";
import { Avatar, Badge, Card, CardHeader, EmptyState, PageHeader, type Tone } from "@/components/ui";
import { ActionButton } from "@/components/forms";
import { AccountStateBadge } from "../_shared";
import { revokeInvite } from "./actions";
import { InviteForm, ManageUser, UserFilter } from "./forms";

export const metadata: Metadata = { title: "Users & roles" };

const ROLE_TONE: Record<string, Tone> = { student: "brand", teacher: "blue", counselor: "violet", admin: "neutral", parent: "amber" };

export default async function UsersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser(["admin"]);
  const sp = await searchParams;
  const filter = userFilterSchema.parse({ role: sp.role, q: typeof sp.q === "string" ? sp.q : "" });
  const [users, invitations, dir] = await Promise.all([listUsers(user, filter), listInvitations(user), getSchoolDirectory(user)]);
  const pending = invitations.filter((i) => i.status === "pending");
  const past = invitations.filter((i) => i.status !== "pending").slice(0, 8);
  const filtered = filter.role !== "all" || filter.q !== "";

  return (
    <div className="space-y-6 animate-fade-up">
      <PageHeader title="Users & roles" description="Invite people, manage staff permissions, change staff roles and suspend accounts. Every change is audited." />

      <div className="grid gap-5 lg:grid-cols-5">
        <Card className="lg:col-span-3" id="invite">
          <CardHeader title="Invite a user" icon={MailPlus} subtitle="A one-time code is emailed with a registration link" />
          <InviteForm
            classes={dir.classes.map((c) => ({ id: c.id, label: `${c.name} (grade ${c.grade_level})` }))}
            students={dir.students.map((s) => ({ id: s.user_id, label: s.display_name }))}
          />
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Invitations" icon={Mails} subtitle={`${pending.length} pending`} />
          {invitations.length === 0 ? (
            <EmptyState title="No invitations yet">Invitations you create appear here until they&apos;re used or expire.</EmptyState>
          ) : (
            <ul className="divide-y divide-ink-50">
              {[...pending, ...past].map((i) => (
                <li key={i.id} className="flex items-start justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink-900">{i.email}</p>
                    <p className="text-xs text-ink-500">
                      {ROLE_LABELS[i.role]}
                      {i.class_name && <> · {i.class_name}</>}
                      {i.student_name && <> · for {i.student_name}</>}
                      {" · "}
                      {i.status === "pending" ? `expires ${formatDate(i.expires_at)}` : i.status === "accepted" ? `accepted ${formatDate(i.accepted_at!)}` : "expired / revoked"}
                    </p>
                  </div>
                  {i.status === "pending" ? (
                    <ActionButton action={revokeInvite} hidden={{ id: i.id }} variant="danger" confirm="Revoke this invitation? The code will stop working.">Revoke</ActionButton>
                  ) : (
                    <Badge tone={i.status === "accepted" ? "green" : "neutral"}>{i.status === "accepted" ? "Accepted" : "Inactive"}</Badge>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader title="People" icon={UsersRound} subtitle={`${users.length} ${filtered ? "matching" : "in your school"}`} />
        <div className="mb-4">
          <UserFilter role={filter.role} q={filter.q} />
        </div>
        {users.length === 0 ? (
          <EmptyState icon={UserX} title="No users found">{filtered ? "Try a different role or search term." : "Invite your first users above."}</EmptyState>
        ) : (
          <ul className="divide-y divide-ink-100">
            {users.map((u) => (
              <li key={u.user_id} className="py-3">
                <details className="group">
                  <summary className="flex cursor-pointer list-none items-center gap-3 rounded-xl p-1 hover:bg-ink-50 focus-visible:outline-2 focus-visible:outline-brand-500 [&::-webkit-details-marker]:hidden">
                    <Avatar name={u.display_name} color={u.avatar_color} emoji={u.avatar_emoji} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="font-semibold text-ink-900">{u.display_name}</span>
                        {u.user_id === user.id && <Badge tone="violet">You</Badge>}
                        <Badge tone={ROLE_TONE[u.role]}>{ROLE_LABELS[u.role]}</Badge>
                        {u.account_state !== "active" && <AccountStateBadge state={u.account_state} />}
                      </span>
                      <span className="block truncate text-xs text-ink-500">
                        {u.email ?? "—"}
                        {u.class_names && <> · {u.class_names}</>}
                        {u.children && <> · parent of {u.children}</>}
                        {u.permissions.length > 0 && <> · {u.permissions.length} permission{u.permissions.length === 1 ? "" : "s"}</>}
                      </span>
                    </span>
                    <span className="hidden shrink-0 text-xs text-ink-500 sm:block">
                      {u.last_login_at ? `Signed in ${timeAgo(u.last_login_at)}` : "Never signed in"}
                    </span>
                    <span className="shrink-0 text-sm font-semibold text-brand-700 group-open:hidden">Manage</span>
                    <span className="hidden shrink-0 text-sm font-semibold text-ink-500 group-open:inline">Close</span>
                  </summary>
                  <div className="mt-3 rounded-2xl bg-ink-50 p-4">
                    {u.permissions.length > 0 && (
                      <p className="mb-3 text-xs text-ink-600">Current: {u.permissions.map((p) => PERMISSION_LABELS[p] ?? p).join(" · ")}</p>
                    )}
                    <ManageUser userId={u.user_id} role={u.role} accountState={u.account_state} permissions={u.permissions} isSelf={u.user_id === user.id} />
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
