// Matchmaking, connections, blocking and reporting for students.
//
// Visibility rules (formerly enforced by RLS, now enforced here):
// - students only ever see other *students* of their own school (tenant scope);
// - a student profile is visible in suggestions only if discoverable, active,
//   consented to matchmaking and not blocked in either direction;
// - students can only contact other active students of the same school.

import { z } from "zod";
import { tenant, type Tenant } from "@/lib/db/tenant";
import { canContact, hasConsent, isBlockedBetween, isConnected, pairKey } from "@/lib/authz";
import { recommendGroups, recommendPeers, type MatchResult } from "@/lib/engines/matching";
import { UserFacingError } from "@/lib/action-state";
import { LIMITS, rateLimit } from "@/lib/rate-limit";
import type { Actor } from "./actor";
import { assertRole } from "./actor";
import { audit } from "./audit";
import { notify } from "./notify";
import { studentAccess } from "./consent";

export interface PeerCard {
  id: string;
  displayName: string;
  avatarColor: string;
  avatarEmoji: string | null;
  gradeLevel: number | null;
  bio: string | null;
  interests: string[];
}

export interface Recommendation extends PeerCard {
  match: MatchResult;
}

async function interestLabels(t: Tenant): Promise<Map<number, string>> {
  return new Map((await t.interests()).map((i) => [Number(i._id), String(i.label)]));
}

async function requireMatchmaking(actor: Actor) {
  const access = await studentAccess(actor, actor.id);
  if (!access.matchmaking) throw new UserFacingError("Matchmaking is switched off for your account. You can review this in Settings.");
}

async function displayName(t: Tenant, id: string): Promise<string> {
  return String((await t.profiles.findOne({ _id: id }, { projection: { display_name: 1 } }))?.display_name ?? "A classmate");
}

export async function getRecommendations(actor: Actor, limit = 12): Promise<Recommendation[]> {
  assertRole(actor, "student");
  const access = await studentAccess(actor, actor.id);
  if (!access.matchmaking) return [];
  const t = tenant(actor);
  const labels = await interestLabels(t);
  const [me, mySp] = await Promise.all([t.profiles.findOne({ _id: actor.id }), t.studentProfiles.findOne({ _id: actor.id })]);

  const students = await t.profiles.find({ role: "student", account_state: "active", _id: { $ne: actor.id } });
  const studentIds = students.map((s) => String(s._id));
  const [sps, consentRows, blocks, conns, dismissed] = await Promise.all([
    t.studentProfiles.find({ _id: { $in: studentIds }, discoverable: true }),
    t.consents.find({ subject_id: { $in: studentIds }, consent_type: "matchmaking" }, { sort: { recorded_at: -1 } }),
    t.blocks.find({ $or: [{ blocker_id: actor.id }, { blocked_id: actor.id }] }),
    t.connections.find({ $or: [{ requester_id: actor.id }, { addressee_id: actor.id }] }),
    t.dismissals.find({ user_id: actor.id }),
  ]);
  const consented = new Set<string>();
  const seenConsent = new Set<string>();
  for (const c of consentRows) {
    const sid = String(c.subject_id);
    if (seenConsent.has(sid)) continue;
    seenConsent.add(sid);
    if (c.granted) consented.add(sid);
  }
  const blocked = new Set(blocks.map((b) => (b.blocker_id === actor.id ? String(b.blocked_id) : String(b.blocker_id))));
  const existing = new Set(conns.map((c) => (c.requester_id === actor.id ? String(c.addressee_id) : String(c.requester_id))));
  const dismissedSet = new Set(dismissed.map((d) => String(d.dismissed_id)));
  const profileById = new Map(students.map((s) => [String(s._id), s]));
  const candidates = sps.filter((sp) => consented.has(String(sp._id)) && !blocked.has(String(sp._id)));

  const results = recommendPeers(
    { id: actor.id, gradeLevel: me?.grade_level ?? null, interests: (mySp?.interest_ids ?? []).map(Number), goals: mySp?.goals ?? [], learningStyle: mySp?.learning_style ?? null, openTo: mySp?.open_to ?? [] },
    candidates.map((c) => ({
      id: String(c._id), gradeLevel: profileById.get(String(c._id))?.grade_level ?? null, interests: (c.interest_ids ?? []).map(Number),
      goals: c.goals ?? [], learningStyle: c.learning_style ?? null, openTo: c.open_to ?? [], discoverable: Boolean(c.discoverable),
    })),
    { blocked, existing, dismissed: dismissedSet },
    { limit, interestLabel: (id) => labels.get(id) ?? "?" },
  );
  const spById = new Map(candidates.map((c) => [String(c._id), c]));
  return results.map((m) => {
    const p = profileById.get(m.id)!;
    const sp = spById.get(m.id)!;
    return {
      id: m.id, displayName: p.display_name, avatarColor: p.avatar_color, avatarEmoji: p.avatar_emoji ?? null,
      gradeLevel: sp.show_class ? p.grade_level ?? null : null, bio: sp.bio ?? null, interests: (sp.interest_ids ?? []).map((i: number) => labels.get(Number(i)) ?? "?"), match: m,
    };
  });
}

export const connectionRequestSchema = z.object({
  addresseeId: z.string().uuid(),
  message: z.string().trim().max(200).optional().transform((v) => v || null),
});

export async function sendConnectionRequest(actor: Actor, input: z.infer<typeof connectionRequestSchema>): Promise<void> {
  assertRole(actor, "student");
  if (!rateLimit(`conn:${actor.id}`, LIMITS.connectionRequest.limit, LIMITS.connectionRequest.windowMs).ok) {
    throw new UserFacingError("You've sent a lot of requests recently. Please wait a while.");
  }
  await requireMatchmaking(actor);
  const t = tenant(actor);
  if (!(await canContact(t, actor, input.addresseeId)) || !(await hasConsent(t, input.addresseeId, "matchmaking"))) {
    throw new UserFacingError("You can't send a request to this person.");
  }
  const pair = pairKey(actor.id, input.addresseeId);
  const existing = await t.connections.findOne({ pair });
  if (existing) {
    if (existing.status === "accepted") throw new UserFacingError("You're already connected.");
    if (existing.status === "pending") throw new UserFacingError("There's already a pending request between you.");
    // Someone whose request was declined can't keep re-sending it; the person
    // who declined can change their mind and send one themselves.
    if (existing.requester_id === actor.id) throw new UserFacingError("This person isn't accepting a request from you right now.");
    await t.connections.deleteOne({ _id: existing._id });
  }
  try {
    await t.connections.insertOne({ requester_id: actor.id, addressee_id: input.addresseeId, pair, status: "pending", message: input.message, responded_at: null });
  } catch (err) {
    if ((err as { code?: number }).code === 11000) throw new UserFacingError("There's already a pending request between you.");
    throw err;
  }
  await audit({ schoolId: actor.schoolId, actorId: actor.id, action: "connection.requested", resourceType: "profile", resourceId: input.addresseeId });
  const name = await displayName(t, actor.id);
  await notify(actor.schoolId, [input.addresseeId], { type: "connection_request", title: `${name} wants to connect`, body: input.message ?? undefined, link: "/student/connections" });
}

export async function respondToRequest(actor: Actor, connectionId: string, accept: boolean): Promise<void> {
  assertRole(actor, "student");
  const t = tenant(actor);
  const row = await t.connections.findOneAndUpdate(
    { _id: connectionId, addressee_id: actor.id, status: "pending" },
    { $set: { status: accept ? "accepted" : "declined", responded_at: new Date() } },
  );
  if (!row) throw new UserFacingError("That request is no longer available.");
  if (accept) {
    const name = await displayName(t, actor.id);
    await notify(actor.schoolId, [String(row.requester_id)], { type: "connection_accepted", title: `${name} accepted your request`, link: "/student/connections" });
  }
}

export async function removeConnection(actor: Actor, connectionId: string): Promise<void> {
  await tenant(actor).connections.deleteOne({ _id: connectionId, $or: [{ requester_id: actor.id }, { addressee_id: actor.id }] });
}

export async function dismissRecommendation(actor: Actor, otherId: string): Promise<void> {
  assertRole(actor, "student");
  await tenant(actor).dismissals.updateOne({ user_id: actor.id, dismissed_id: otherId }, { $setOnInsert: { _id: crypto.randomUUID(), created_at: new Date() } }, { upsert: true });
}

export async function blockStudent(actor: Actor, otherId: string): Promise<void> {
  assertRole(actor, "student");
  const t = tenant(actor);
  if (!(await t.profiles.count({ _id: otherId }))) throw new UserFacingError("That person isn't at your school.");
  await t.blocks.updateOne({ blocker_id: actor.id, blocked_id: otherId }, { $setOnInsert: { _id: crypto.randomUUID(), created_at: new Date() } }, { upsert: true });
  // Blocking removes any connection or pending request between the two.
  await t.connections.deleteMany({ pair: pairKey(actor.id, otherId) });
  await t.groupMembers.deleteMany({ user_id: actor.id, status: "invited", invited_by: otherId });
  await audit({ schoolId: actor.schoolId, actorId: actor.id, action: "student.blocked", resourceType: "profile", resourceId: otherId });
}

export async function unblockStudent(actor: Actor, otherId: string): Promise<void> {
  await tenant(actor).blocks.deleteOne({ blocker_id: actor.id, blocked_id: otherId });
}

export const reportSchema = z.object({
  reportedId: z.string().uuid(),
  reason: z.enum(["harassment", "bullying", "inappropriate", "spam", "other"]),
  details: z.string().trim().max(1000).optional().transform((v) => v || null),
  alsoBlock: z.boolean(),
});

export async function reportStudent(actor: Actor, input: z.infer<typeof reportSchema>): Promise<void> {
  if (!rateLimit(`report:${actor.id}`, LIMITS.report.limit, LIMITS.report.windowMs).ok) throw new UserFacingError("Please wait before sending another report.");
  const t = tenant(actor);
  if (!(await t.profiles.count({ _id: input.reportedId }))) throw new UserFacingError("That person isn't at your school.");
  const reportId = await t.reports.insertOne({ reporter_id: actor.id, reported_id: input.reportedId, reason: input.reason, details: input.details, status: "open" });
  await audit({ schoolId: actor.schoolId, actorId: actor.id, action: "report.created", resourceType: "report", resourceId: reportId, metadata: { reason: input.reason } });
  if (input.alsoBlock && actor.role === "student") await blockStudent(actor, input.reportedId);
  const staff = await t.staffPermissions.find({ permission: "safeguarding.reports" });
  await notify(actor.schoolId, staff.map((s) => String(s.user_id)), { type: "counselor_alert", title: "New safety report", body: "A student submitted a report.", link: `/counselor/safeguarding#${reportId}`, sensitive: true });
}

export interface ConnectionsView {
  incoming: Array<PeerCard & { connectionId: string; message: string | null; createdAt: string }>;
  outgoing: Array<PeerCard & { connectionId: string; createdAt: string }>;
  connected: Array<PeerCard & { connectionId: string; since: string }>;
  blocked: Array<{ id: string; displayName: string }>;
}

export async function getConnections(actor: Actor): Promise<ConnectionsView> {
  assertRole(actor, "student");
  const t = tenant(actor);
  const labels = await interestLabels(t);
  const rows = await t.connections.find({ $or: [{ requester_id: actor.id }, { addressee_id: actor.id }] }, { sort: { created_at: -1 } });
  const otherIds = rows.map((r) => (r.requester_id === actor.id ? String(r.addressee_id) : String(r.requester_id)));
  const blocks = await t.blocks.find({ blocker_id: actor.id });
  const [profiles, sps, blockedProfiles] = await Promise.all([
    t.profiles.find({ _id: { $in: otherIds } }),
    t.studentProfiles.find({ _id: { $in: otherIds } }),
    t.profiles.find({ _id: { $in: blocks.map((b) => String(b.blocked_id)) } }, { projection: { display_name: 1 } }),
  ]);
  const pById = new Map(profiles.map((p) => [String(p._id), p]));
  const spById = new Map(sps.map((p) => [String(p._id), p]));
  const card = (otherId: string): PeerCard => {
    const p = pById.get(otherId);
    const sp = spById.get(otherId);
    return {
      id: otherId, displayName: p?.display_name ?? "Former student", avatarColor: p?.avatar_color ?? "slate", avatarEmoji: p?.avatar_emoji ?? null,
      gradeLevel: p?.grade_level ?? null, bio: sp?.bio ?? null, interests: (sp?.interest_ids ?? []).map((i: number) => labels.get(Number(i)) ?? "?"),
    };
  };
  const other = (r: (typeof rows)[number]) => (r.requester_id === actor.id ? String(r.addressee_id) : String(r.requester_id));
  return {
    incoming: rows.filter((r) => r.status === "pending" && r.addressee_id === actor.id).map((r) => ({ ...card(other(r)), connectionId: String(r._id), message: r.message ?? null, createdAt: new Date(r.created_at).toISOString() })),
    outgoing: rows.filter((r) => r.status === "pending" && r.requester_id === actor.id).map((r) => ({ ...card(other(r)), connectionId: String(r._id), createdAt: new Date(r.created_at).toISOString() })),
    connected: rows.filter((r) => r.status === "accepted").map((r) => ({ ...card(other(r)), connectionId: String(r._id), since: new Date(r.responded_at ?? r.created_at).toISOString() })),
    blocked: blockedProfiles.map((b) => ({ id: String(b._id), displayName: String(b.display_name) })),
  };
}

// ───────────── Study groups & activities ─────────────

export interface GroupView {
  id: string;
  name: string;
  description: string | null;
  subjectName: string | null;
  meetingInfo: string | null;
  maxMembers: number;
  members: Array<{ id: string; displayName: string; avatarColor: string; avatarEmoji: string | null; role: string }>;
  myStatus: "member" | "invited" | null;
  isOwner: boolean;
  interests: string[];
  reasons: string[];
}

export async function getGroups(actor: Actor): Promise<{ mine: GroupView[]; invited: GroupView[]; suggested: GroupView[]; others: GroupView[] }> {
  assertRole(actor, "student");
  const t = tenant(actor);
  const labels = await interestLabels(t);
  const [groups, members, subjects, mySp] = await Promise.all([
    t.groups.find({}, { sort: { created_at: -1 } }),
    t.groupMembers.find({}),
    t.subjects.find({}),
    t.studentProfiles.findOne({ _id: actor.id }),
  ]);
  const memberProfiles = new Map((await t.profiles.find({ _id: { $in: [...new Set(members.map((m) => String(m.user_id)))] } })).map((p) => [String(p._id), p]));
  const subjectName = new Map(subjects.map((s) => [String(s._id), String(s.name)]));
  const practice = await practiceSubjects(t, actor.id);
  const views: GroupView[] = groups.map((g) => {
    const gm = members.filter((m) => m.group_id === g._id);
    const mine = gm.find((m) => m.user_id === actor.id);
    return {
      id: String(g._id), name: g.name, description: g.description ?? null, subjectName: g.subject_id ? subjectName.get(String(g.subject_id)) ?? null : null,
      meetingInfo: g.meeting_info ?? null, maxMembers: g.max_members,
      members: gm.filter((m) => m.status === "member").map((m) => {
        const p = memberProfiles.get(String(m.user_id));
        return { id: String(m.user_id), displayName: p?.display_name ?? "Student", avatarColor: p?.avatar_color ?? "slate", avatarEmoji: p?.avatar_emoji ?? null, role: m.role };
      }),
      myStatus: (mine?.status as GroupView["myStatus"]) ?? null,
      isOwner: g.created_by === actor.id,
      interests: (g.interest_ids ?? []).map((i: number) => labels.get(Number(i)) ?? "?"),
      reasons: [],
    };
  });
  const joined = new Set(views.filter((v) => v.myStatus !== null).map((v) => v.id));
  const recs = recommendGroups(
    (mySp?.interest_ids ?? []).map(Number),
    practice,
    groups.map((g) => ({ id: String(g._id), interestIds: (g.interest_ids ?? []).map(Number), subjectId: g.subject_id ?? null, memberCount: views.find((v) => v.id === g._id)!.members.length, maxMembers: g.max_members })),
    joined,
    (id) => labels.get(id) ?? "?",
    (sid) => subjectName.get(sid) ?? "this subject",
  );
  const suggested = recs.map((r) => ({ ...views.find((v) => v.id === r.id)!, reasons: r.reasons }));
  const suggestedIds = new Set(suggested.map((s) => s.id));
  return {
    mine: views.filter((v) => v.myStatus === "member"),
    invited: views.filter((v) => v.myStatus === "invited"),
    suggested,
    others: views.filter((v) => v.myStatus === null && !suggestedIds.has(v.id)),
  };
}

/** Subjects where the student's weighted average is below 7.5 (own data only). */
async function practiceSubjects(t: Tenant, studentId: string): Promise<string[]> {
  const sums = new Map<string, { s: number; w: number }>();
  for (const g of await t.grades.find({ student_id: studentId }, { projection: { subject_id: 1, score: 1, weight: 1 } })) {
    const e = sums.get(String(g.subject_id)) ?? { s: 0, w: 0 };
    e.s += Number(g.score) * Number(g.weight ?? 1);
    e.w += Number(g.weight ?? 1);
    sums.set(String(g.subject_id), e);
  }
  return [...sums.entries()].filter(([, v]) => v.s / v.w < 7.5).map(([k]) => k);
}

export async function joinGroup(actor: Actor, groupId: string): Promise<void> {
  assertRole(actor, "student");
  const t = tenant(actor);
  const g = await t.groups.findOne({ _id: groupId });
  if (!g) throw new UserFacingError("Group not found.");
  if ((await t.groupMembers.count({ group_id: groupId, status: "member" })) >= g.max_members) throw new UserFacingError("This group is full.");
  const invited = await t.groupMembers.findOne({ group_id: groupId, user_id: actor.id });
  if (invited?.status === "member") return;
  if (invited) await t.groupMembers.updateOne({ _id: invited._id }, { $set: { status: "member", joined_at: new Date() } });
  else await t.groupMembers.insertOne({ group_id: groupId, user_id: actor.id, status: "member", role: "member", invited_by: null, joined_at: new Date() });
}

export async function leaveGroup(actor: Actor, groupId: string): Promise<void> {
  await tenant(actor).groupMembers.deleteOne({ group_id: groupId, user_id: actor.id });
}

export const groupSchema = z.object({
  name: z.string().trim().min(2, "Give the group a name.").max(80),
  description: z.string().trim().max(500).optional().transform((v) => v || null),
  subjectId: z.string().uuid().nullable(),
  meetingInfo: z.string().trim().max(160).optional().transform((v) => v || null),
  maxMembers: z.coerce.number().int().min(2).max(40),
  interestIds: z.array(z.coerce.number().int().positive()).max(5),
});

export async function createGroup(actor: Actor, input: z.infer<typeof groupSchema>): Promise<string> {
  assertRole(actor, "student", "teacher");
  const t = tenant(actor);
  if (input.subjectId && !(await t.subjects.count({ _id: input.subjectId }))) throw new UserFacingError("Unknown subject.");
  const id = await t.groups.insertOne({
    name: input.name, description: input.description, subject_id: input.subjectId, meeting_info: input.meetingInfo, max_members: input.maxMembers,
    interest_ids: input.interestIds, created_by: actor.id,
  });
  await t.groupMembers.insertOne({ group_id: id, user_id: actor.id, status: "member", role: "owner", invited_by: null, joined_at: new Date() });
  return id;
}

export async function inviteToGroup(actor: Actor, groupId: string, inviteeId: string): Promise<void> {
  assertRole(actor, "student");
  const t = tenant(actor);
  if (!(await t.groupMembers.count({ group_id: groupId, user_id: actor.id, status: "member" }))) throw new UserFacingError("Only members can invite people.");
  if (!(await isConnected(t, actor.id, inviteeId))) throw new UserFacingError("You can invite people you're connected with.");
  if (await isBlockedBetween(t, actor.id, inviteeId)) throw new UserFacingError("You can't invite this person.");
  await t.groupMembers.updateOne(
    { group_id: groupId, user_id: inviteeId },
    { $setOnInsert: { _id: crypto.randomUUID(), status: "invited", role: "member", invited_by: actor.id, joined_at: new Date(), created_at: new Date() } },
    { upsert: true },
  );
  const group = await t.groups.findOne({ _id: groupId });
  const me = await displayName(t, actor.id);
  await notify(actor.schoolId, [inviteeId], { type: "group_invite", title: `You're invited to ${group?.name}`, body: `${me} invited you to join the study group.`, link: "/student/groups" });
}

export async function getActivities(actor: Actor, limit = 6) {
  const t = tenant(actor);
  const labels = await interestLabels(t);
  const mySp = actor.role === "student" ? await t.studentProfiles.findOne({ _id: actor.id }) : null;
  const mine = new Set<number>((mySp?.interest_ids ?? []).map(Number));
  const rows = await t.activities.find({ $or: [{ starts_at: null }, { starts_at: { $gt: new Date() } }] }, { sort: { starts_at: 1 } });
  return rows
    .map((r) => ({
      id: String(r._id), title: String(r.title), description: (r.description as string | null) ?? null, location: (r.location as string | null) ?? null,
      startsAt: r.starts_at ? new Date(r.starts_at).toISOString() : null,
      shared: ((r.interest_ids ?? []) as number[]).filter((i) => mine.has(Number(i))).map((i) => labels.get(Number(i)) ?? "?"),
    }))
    .sort((a, b) => b.shared.length - a.shared.length)
    .slice(0, limit);
}
