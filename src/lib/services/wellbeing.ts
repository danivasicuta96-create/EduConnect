// Student-facing wellbeing: daily check-ins, personal trends, support requests.

import { z } from "zod";
import { tenant } from "@/lib/db/tenant";
import { decryptField, encryptField } from "@/lib/db/field-crypto";
import { addDays, todayIn } from "@/lib/dates";
import { CHECKIN_FACTORS, EXPERIENCE_OPTIONS } from "@/lib/constants";
import { UserFacingError } from "@/lib/action-state";
import type { Actor } from "./actor";
import { assertRole } from "./actor";
import { audit } from "./audit";
import { notifyCounselors, runAlertEngine } from "./alert-engine";
import { studentAccess } from "./consent";
import { notify } from "./notify";

export const checkinSchema = z.object({
  mood: z.coerce.number().int().min(1, "Choose how you feel from 1 to 10.").max(10),
  experience: z.enum(Object.keys(EXPERIENCE_OPTIONS) as [string, ...string[]]).nullable(),
  factors: z.array(z.enum(Object.keys(CHECKIN_FACTORS) as [string, ...string[]])).max(9),
  note: z.string().trim().max(2000).optional().transform((v) => v || null),
  shareNote: z.boolean(),
});

export type CheckinInput = z.infer<typeof checkinSchema>;

export interface CheckinRow {
  id: string;
  date: string;
  mood: number;
  experience: string | null;
  factors: string[];
  note: string | null;
  shared_with_counselor: boolean | null;
}

function toCheckinRow(c: Record<string, unknown>): CheckinRow {
  return {
    id: String(c._id), date: String(c.date), mood: Number(c.mood), experience: (c.experience as string | null) ?? null,
    factors: (c.factors as string[]) ?? [], note: decryptField(c.note_enc as string | null), shared_with_counselor: c.note_enc ? Boolean(c.note_shared) : null,
  };
}

/** The student's own check-in for a date. */
export async function getCheckin(actor: Actor, date: string): Promise<CheckinRow | null> {
  assertRole(actor, "student");
  const c = await tenant(actor).checkins.findOne({ student_id: actor.id, date });
  return c ? toCheckinRow(c) : null;
}

/** Save today's check-in (one per day; editing replaces it), then evaluate alert rules. */
export async function submitCheckin(actor: Actor, input: CheckinInput): Promise<{ date: string; suggestions: Suggestion[] }> {
  assertRole(actor, "student");
  const today = todayIn(actor.timezone);
  const access = await studentAccess(actor, actor.id);
  if (!access.checkins) throw new UserFacingError("Check-ins are switched off for your account. You can review this in Settings.");
  await tenant(actor).checkins.updateOne(
    { student_id: actor.id, date: today },
    {
      $set: {
        mood: input.mood, experience: input.experience, factors: input.factors,
        note_enc: encryptField(input.note), note_shared: Boolean(input.note) && input.shareNote, updated_at: new Date(),
      },
      $setOnInsert: { _id: crypto.randomUUID(), created_at: new Date() },
    },
    { upsert: true },
  );
  // Rule evaluation needs privileges the student doesn't have (rules, alerts).
  await runAlertEngine(actor.id, today);
  return { date: today, suggestions: suggestionsFor(input) };
}

export interface Suggestion {
  key: string;
  title: string;
  body: string;
  href?: string;
}

/** Supportive, non-clinical suggestions chosen by simple, transparent rules. */
export function suggestionsFor(input: Pick<CheckinInput, "mood" | "factors">): Suggestion[] {
  const s: Suggestion[] = [];
  if (input.mood <= 4) {
    s.push({ key: "talk", title: "Talk to someone you trust", body: "A friend, family member, teacher or the school counselor. You can also ask the counselor to reach out to you.", href: "/student/wellbeing/support" });
    s.push({ key: "breathe", title: "Try a 1-minute breathing exercise", body: "Box breathing: in for 4, hold for 4, out for 4, hold for 4.", href: "/student/wellbeing/assistant?exercise=breathing" });
  }
  if (input.factors.includes("tests") || input.factors.includes("workload")) {
    s.push({ key: "plan", title: "Break the work into small steps", body: "Pick one task, set a 25-minute timer, then take a 5-minute break.", href: "/student/academics" });
  }
  if (input.factors.includes("sleep")) {
    s.push({ key: "sleep", title: "Protect your sleep tonight", body: "Screens off 30 minutes before bed and aim for 8–10 hours." });
  }
  if (input.factors.includes("friendships")) {
    s.push({ key: "friends", title: "Friendships can be tricky", body: "If something is upsetting you, it's okay to talk about it with a trusted adult." });
  }
  if (input.mood >= 7) s.push({ key: "journal", title: "Notice what went well", body: "Writing down one good thing from today helps you remember it." });
  if (s.length < 2) s.push({ key: "break", title: "Take a proper break", body: "A short walk, some water and a stretch can reset your focus.", href: "/student/wellbeing/assistant?exercise=grounding" });
  return s.slice(0, 3);
}

export async function getHistory(actor: Actor, days = 60) {
  assertRole(actor, "student");
  const today = todayIn(actor.timezone);
  const rows = (await tenant(actor).checkins.find({ student_id: actor.id, date: { $gte: addDays(today, -days) } }, { sort: { date: 1 } })).map(toCheckinRow);
  const factorCounts: Record<string, number> = {};
  for (const r of rows) for (const f of r.factors) factorCounts[f] = (factorCounts[f] ?? 0) + 1;
  const avg = (list: CheckinRow[]) => (list.length ? Math.round((list.reduce((a, r) => a + r.mood, 0) / list.length) * 10) / 10 : null);
  return {
    today,
    rows,
    average7: avg(rows.filter((r) => r.date > addDays(today, -7))),
    average30: avg(rows.filter((r) => r.date > addDays(today, -30))),
    factorCounts,
    streak: streakOf(rows.map((r) => r.date), today),
  };
}

/** Consecutive school days (Mon–Fri) with a check-in, ending today or the last school day. */
export function streakOf(dates: string[], today: string): number {
  const set = new Set(dates);
  let streak = 0;
  let d = today;
  let skippedToday = false;
  for (let i = 0; i < 400; i++) {
    const wd = new Date(`${d}T00:00:00Z`).getUTCDay();
    const school = wd >= 1 && wd <= 5;
    if (school) {
      if (set.has(d)) streak++;
      else if (d === today && !skippedToday) skippedToday = true; // today's check-in may still come
      else break;
    }
    d = addDays(d, -1);
  }
  return streak;
}

/** Student asks a counselor to reach out. Creates a self-referral alert. */
export async function requestCounselorContact(actor: Actor, message: string | null, urgent: boolean): Promise<void> {
  assertRole(actor, "student");
  const t = tenant(actor);
  const open = await t.alerts.findOne({ student_id: actor.id, source: "self_referral", status: { $ne: "resolved" } });
  if (open) throw new UserFacingError("Your request has already been sent. A counselor will get back to you soon.");
  const now = new Date();
  const id = await t.alerts.insertOne({
    student_id: actor.id, rule_id: null, source: "self_referral", severity: urgent ? "urgent" : "attention", status: "open",
    summary: "Student asked a counselor to reach out.", message_enc: encryptField(message), observed: {},
    window_start: null, window_end: null, assigned_to: null, acknowledged_by: null, acknowledged_at: null, resolved_at: null, resolution_enc: null, updated_at: now,
  });
  await audit({ schoolId: actor.schoolId, actorId: actor.id, action: "wellbeing.self_referral", resourceType: "wellbeing_alert", resourceId: id });
  await notifyCounselors(actor.schoolId, id, urgent ? "urgent" : "attention");
}

export async function getSupportOverview(actor: Actor) {
  assertRole(actor, "student");
  const t = tenant(actor);
  const [request, sessions, ownResources, platformResources, counselors] = await Promise.all([
    t.alerts.findOne({ student_id: actor.id, source: "self_referral" }, { sort: { created_at: -1 } }),
    t.supportSessions.find({ student_id: actor.id }, { sort: { proposed_at: -1 }, limit: 10 }),
    t.supportResources.find({}),
    platformSupportResources(),
    t.profiles.find({ role: "counselor" }, { sort: { display_name: 1 }, projection: { display_name: 1 } }),
  ]);
  const counselorName = new Map(counselors.map((c) => [String(c._id), String(c.display_name)]));
  const resources = [...platformResources, ...ownResources]
    .sort((a, b) => Number(a.sort_order ?? 100) - Number(b.sort_order ?? 100) || String(a.name).localeCompare(String(b.name)))
    .map((r) => ({ id: String(r._id), category: String(r.category), name: String(r.name), phone: r.phone ?? null, url: r.url ?? null, description: String(r.description), hours: r.hours ?? null }));
  return {
    request: request ? { id: String(request._id), status: String(request.status), createdAt: new Date(request.created_at).toISOString() } : null,
    sessions: sessions.map((x) => ({
      id: String(x._id), proposed_at: new Date(x.proposed_at).toISOString(), location: x.location ?? null, status: String(x.status),
      counselor_name: x.counselor_id ? counselorName.get(String(x.counselor_id)) ?? null : null, student_message: decryptField(x.student_message_enc ?? null),
    })),
    resources,
    counselors: counselors.map((c) => String(c.display_name)),
  };
}

/** Platform-wide default resources (no school), readable by everyone. */
export async function platformSupportResources() {
  const { col, COLLECTIONS } = await import("@/lib/db/mongo");
  return (await col(COLLECTIONS.supportResources)).find({ school_id: null }).toArray();
}

export async function respondToSession(actor: Actor, sessionId: string, accept: boolean, message: string | null): Promise<void> {
  assertRole(actor, "student");
  const row = await tenant(actor).supportSessions.findOneAndUpdate(
    { _id: sessionId, student_id: actor.id, status: "proposed" },
    { $set: { status: accept ? "accepted" : "declined", student_message_enc: encryptField(message), responded_at: new Date() } },
  );
  if (!row) throw new UserFacingError("This invitation is no longer open.");
  if (row.counselor_id) {
    await notify(actor.schoolId, [String(row.counselor_id)], {
      type: "support_session",
      title: accept ? "A support conversation was accepted" : "A support conversation invite was declined",
      link: "/counselor/sessions",
      sensitive: true,
    });
  }
}
