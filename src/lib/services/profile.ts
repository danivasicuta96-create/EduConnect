import { z } from "zod";
import { tenant } from "@/lib/db/tenant";
import { AVATAR_COLORS, GOAL_OPTIONS, LEARNING_STYLES, OPEN_TO } from "@/lib/constants";
import type { Actor } from "./actor";
import { assertRole } from "./actor";
import { audit } from "./audit";

export interface Interest {
  id: number;
  slug: string;
  label: string;
  category: string;
}

export async function listInterests(actor: Actor): Promise<Interest[]> {
  return (await tenant(actor).interests()).map((i) => ({ id: Number(i._id), slug: i.slug, label: i.label, category: i.category }));
}

export interface StudentProfileView {
  displayName: string;
  avatarColor: string;
  avatarEmoji: string | null;
  gradeLevel: number | null;
  className: string | null;
  bio: string | null;
  learningStyle: string | null;
  goals: string[];
  clubs: string[];
  openTo: string[];
  discoverable: boolean;
  showClass: boolean;
  interestIds: number[];
}

export async function getStudentProfile(actor: Actor): Promise<StudentProfileView> {
  assertRole(actor, "student");
  const t = tenant(actor);
  const [p, sp, enrollment] = await Promise.all([
    t.profiles.findOne({ _id: actor.id }),
    t.studentProfiles.findOne({ _id: actor.id }),
    t.enrollments.findOne({ student_id: actor.id }),
  ]);
  const cls = enrollment ? await t.classes.findOne({ _id: enrollment.class_id }) : null;
  return {
    displayName: p!.display_name,
    avatarColor: p!.avatar_color,
    avatarEmoji: p!.avatar_emoji ?? null,
    gradeLevel: p!.grade_level ?? null,
    className: cls?.name ?? null,
    bio: sp?.bio ?? null,
    learningStyle: sp?.learning_style ?? null,
    goals: sp?.goals ?? [],
    clubs: sp?.clubs ?? [],
    openTo: sp?.open_to ?? [],
    discoverable: sp?.discoverable ?? false,
    showClass: sp?.show_class ?? true,
    interestIds: (sp?.interest_ids ?? []).map(Number),
  };
}

const emoji = z
  .string()
  .trim()
  .max(8)
  .refine((v) => v === "" || /^\p{Extended_Pictographic}/u.test(v), "Pick a single emoji.")
  .transform((v) => (v === "" ? null : v));

export const basicProfileSchema = z.object({
  displayName: z.string().trim().min(2, "Your display name needs at least 2 characters.").max(60),
  avatarColor: z.enum(AVATAR_COLORS),
  avatarEmoji: emoji.optional().default(""),
});

export const studentProfileSchema = basicProfileSchema.extend({
  bio: z.string().trim().max(280).optional().transform((v) => v || null),
  learningStyle: z.enum(Object.keys(LEARNING_STYLES) as [string, ...string[]]).nullable().optional(),
  goals: z.array(z.enum(Object.keys(GOAL_OPTIONS) as [string, ...string[]])).max(4, "Choose up to 4 goals."),
  clubs: z.array(z.string().trim().min(1).max(40)).max(6),
  openTo: z.array(z.enum(Object.keys(OPEN_TO) as [string, ...string[]])),
  discoverable: z.boolean(),
  showClass: z.boolean(),
  interestIds: z.array(z.coerce.number().int().positive()).max(10, "Choose up to 10 interests."),
});

export type StudentProfileInput = z.infer<typeof studentProfileSchema>;

export async function updateStudentProfile(actor: Actor, input: StudentProfileInput): Promise<void> {
  assertRole(actor, "student");
  const t = tenant(actor);
  const valid = new Set((await t.interests()).map((i) => Number(i._id)));
  const interestIds = [...new Set(input.interestIds)].filter((id) => valid.has(id));
  await t.profiles.updateOne({ _id: actor.id }, { $set: { display_name: input.displayName, avatar_color: input.avatarColor, avatar_emoji: input.avatarEmoji } });
  await t.studentProfiles.updateOne(
    { _id: actor.id },
    {
      $set: {
        bio: input.bio, learning_style: input.learningStyle ?? null, goals: input.goals, clubs: input.clubs, open_to: input.openTo,
        discoverable: input.discoverable, show_class: input.showClass, interest_ids: interestIds, updated_at: new Date(),
      },
    },
    { upsert: true },
  );
  await audit({ schoolId: actor.schoolId, actorId: actor.id, action: "profile.updated", resourceType: "profile", resourceId: actor.id, metadata: { discoverable: input.discoverable } });
}

/** Only cosmetic fields — role, school and account state are never user-editable. */
export async function updateBasicProfile(actor: Actor, input: z.infer<typeof basicProfileSchema>): Promise<void> {
  await tenant(actor).profiles.updateOne({ _id: actor.id }, { $set: { display_name: input.displayName, avatar_color: input.avatarColor, avatar_emoji: input.avatarEmoji } });
}

export async function markOnboarded(actor: Actor): Promise<void> {
  await tenant(actor).profiles.updateOne({ _id: actor.id }, { $set: { onboarded: true } });
  await audit({ schoolId: actor.schoolId, actorId: actor.id, action: "account.onboarded", resourceType: "user", resourceId: actor.id });
}

/** Parse the shared student profile form (used by onboarding and the profile page). */
export function parseStudentProfileForm(formData: FormData) {
  return studentProfileSchema.safeParse({
    displayName: formData.get("displayName"),
    avatarColor: formData.get("avatarColor") ?? "coral",
    avatarEmoji: formData.get("avatarEmoji") ?? "",
    bio: formData.get("bio") ?? "",
    learningStyle: formData.get("learningStyle") || null,
    goals: formData.getAll("goals").map(String),
    clubs: String(formData.get("clubs") ?? "").split(",").map((s) => s.trim()).filter(Boolean),
    openTo: formData.getAll("openTo").map(String),
    discoverable: formData.get("discoverable") === "on",
    showClass: formData.get("showClass") === "on",
    interestIds: formData.getAll("interests").map(String),
  });
}
