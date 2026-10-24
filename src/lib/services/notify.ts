import { col, COLLECTIONS, newId } from "@/lib/db/mongo";

export type NotificationType =
  | "connection_request"
  | "connection_accepted"
  | "group_invite"
  | "academic_event"
  | "grade_update"
  | "counselor_alert"
  | "support_session"
  | "announcement"
  | "account";

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  connection_request: "New connection requests",
  connection_accepted: "Accepted connections",
  group_invite: "Study group invitations",
  academic_event: "Upcoming tests & assignments",
  grade_update: "New grades",
  counselor_alert: "Support follow-ups (authorised staff)",
  support_session: "Support conversation invitations",
  announcement: "School announcements",
  account: "Account & security",
};

/** Types that cannot be switched off, because they are safety- or security-relevant. */
const ALWAYS_ON: NotificationType[] = ["counselor_alert", "account", "support_session"];

/**
 * Create in-app notifications. Privileged: the caller must have authorised the
 * action and must only target users in `schoolId`. Sensitive notifications
 * always use neutral wording (no scores, no conditions) so previews leak nothing.
 */
export async function notify(
  schoolId: string,
  userIds: string[],
  n: { type: NotificationType; title: string; body?: string; link?: string; sensitive?: boolean },
): Promise<void> {
  if (userIds.length === 0) return;
  // Only deliver to users of the same school.
  const profiles = await col(COLLECTIONS.profiles);
  const valid = new Set((await profiles.find({ _id: { $in: userIds as never[] }, school_id: schoolId }, { projection: { _id: 1 } }).toArray()).map((p) => String(p._id)));
  const optedOut = ALWAYS_ON.includes(n.type)
    ? new Set<string>()
    : new Set(
        (await (await col(COLLECTIONS.notificationPrefs)).find({ type: n.type, in_app: false, user_id: { $in: userIds } }).toArray()).map((r) => String(r.user_id)),
      );
  const docs = userIds
    .filter((id) => valid.has(id) && !optedOut.has(id))
    .map((id) => ({
      _id: newId() as never,
      school_id: schoolId,
      user_id: id,
      type: n.type,
      title: n.title,
      body: n.body ?? null,
      link: n.link ?? null,
      sensitive: n.sensitive ?? false,
      read_at: null,
      created_at: new Date(),
    }));
  if (docs.length) await (await col(COLLECTIONS.notifications)).insertMany(docs);
}
