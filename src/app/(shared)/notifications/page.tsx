import Link from "next/link";
import type { Metadata } from "next";
import clsx from "clsx";
import { Bell, Lock, Trash2, CheckCheck, Settings } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { listNotifications } from "@/lib/services/account";
import { timeAgo } from "@/lib/dates";
import { Card, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { ActionButton } from "@/components/forms";
import { deleteNotificationAction, markReadAction } from "./actions";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const user = await requireUser();
  const items = await listNotifications(user);
  const unread = items.filter((n) => !n.read_at).length;

  return (
    <div className="mx-auto max-w-3xl animate-fade-up">
      <PageHeader
        title="Notifications"
        description={unread ? `${unread} unread` : "You're all caught up."}
        actions={
          <>
            {unread > 0 && <ActionButton action={markReadAction} variant="secondary" size="md"><CheckCheck className="size-4" aria-hidden /> Mark all as read</ActionButton>}
            <LinkButton href="/settings#notifications" variant="ghost"><Settings className="size-4" aria-hidden /> Preferences</LinkButton>
          </>
        }
      />
      {items.length === 0 ? (
        <EmptyState icon={Bell} title="No notifications yet">Connection requests, new grades and school announcements will show up here.</EmptyState>
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-ink-50">
            {items.map((n) => (
              <li key={n.id} className={clsx("flex items-start gap-3 px-5 py-4", !n.read_at && "bg-blush-50/60")}>
                <span className={clsx("mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl", n.sensitive ? "bg-ink-100 text-ink-600" : "bg-brand-50 text-brand-600")}>
                  {n.sensitive ? <Lock className="size-4" aria-hidden /> : <Bell className="size-4" aria-hidden />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-ink-900">
                    {!n.read_at && <span className="mr-1.5 inline-block size-2 rounded-full bg-brand-600 align-middle" aria-label="Unread" />}
                    {n.title}
                  </p>
                  {n.body && !n.sensitive && <p className="mt-0.5 text-sm text-ink-600">{n.body}</p>}
                  {n.sensitive && <p className="mt-0.5 text-xs text-ink-500">Details are only shown inside the app.</p>}
                  <div className="mt-1.5 flex items-center gap-3 text-xs text-ink-500">
                    <span>{timeAgo(n.created_at)}</span>
                    {n.link && <Link href={n.link} className="font-semibold text-brand-700 hover:underline">Open</Link>}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {!n.read_at && <ActionButton action={markReadAction} hidden={{ id: n.id }} variant="ghost" title="Mark as read"><CheckCheck className="size-4" aria-hidden /><span className="sr-only">Mark as read</span></ActionButton>}
                  <ActionButton action={deleteNotificationAction} hidden={{ id: n.id }} variant="ghost" title="Delete"><Trash2 className="size-4" aria-hidden /><span className="sr-only">Delete</span></ActionButton>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
