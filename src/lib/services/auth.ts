// Account lifecycle. Privileged because it runs before a user identity
// exists; every input is validated here.

import { z } from "zod";
import { col, COLLECTIONS as C, newId } from "@/lib/db/mongo";
import { DIGITAL_CONSENT_AGE, type Role } from "@/lib/constants";
import { UserFacingError } from "@/lib/action-state";
import { hashPassword, passwordProblem, randomToken, sha256, verifyPassword } from "@/lib/auth/crypto";
import { audit } from "./audit";

const LOCK_AFTER = 5;
const LOCK_MINUTES = 15;

export async function authenticate(emailRaw: string, password: string): Promise<{ userId: string } | { error: string }> {
  const email = emailRaw.trim().toLowerCase();
  const generic = { error: "Email or password is incorrect." };
  const users = await col(C.users);
  const user = await users.findOne({ email });
  if (!user) {
    await verifyPassword(password, "!timing-equaliser");
    return generic;
  }
  if (user.locked_until && new Date(user.locked_until) > new Date()) return { error: `Too many attempts. Try again in ${LOCK_MINUTES} minutes.` };
  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    const failed = (user.failed_logins ?? 0) + 1;
    await users.updateOne(
      { _id: user._id },
      { $set: { failed_logins: failed, locked_until: failed >= LOCK_AFTER ? new Date(Date.now() + LOCK_MINUTES * 60_000) : user.locked_until ?? null } },
    );
    return generic;
  }
  if (user.status !== "active") return { error: "This account is not active. Please contact your school." };
  return { userId: String(user._id) };
}

export const registerSchema = z
  .object({
    displayName: z.string().trim().min(2, "Please enter your name.").max(60),
    email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(200),
    password: z.string().min(1, "Choose a password."),
    code: z.string().trim().min(4, "Enter your invitation or school code.").max(80),
    birthYear: z.coerce.number().int().min(1900).max(new Date().getFullYear()).optional(),
    acceptTerms: z.literal("on", { message: "Please accept the terms and privacy notice." }),
  })
  .superRefine((v, ctx) => {
    const p = passwordProblem(v.password);
    if (p) ctx.addIssue({ code: "custom", path: ["password"], message: p });
  });

export type RegisterInput = z.infer<typeof registerSchema>;

export interface RegisterResult {
  userId: string;
  role: Role;
  needsGuardianConsent: boolean;
}

/**
 * Register with either an invitation code (any role, issued by a school
 * administrator) or a school join code (students only).
 */
export async function registerAccount(input: RegisterInput): Promise<RegisterResult> {
  const hash = await hashPassword(input.password);
  const users = await col(C.users);
  if (await users.findOne({ email: input.email })) throw new UserFacingError("An account with this email already exists. Try signing in.");

  const invite = await (await col(C.invitations)).findOne({
    token_hash: sha256(input.code.toUpperCase()), accepted_at: null, expires_at: { $gt: new Date() },
  });

  let schoolId: string;
  let role: Role;
  let classId: string | null = null;
  let guardianOf: string | null = null;
  if (invite) {
    if (invite.email !== input.email) throw new UserFacingError("This invitation was issued for a different email address.");
    schoolId = String(invite.school_id);
    role = invite.role;
    classId = invite.class_id ?? null;
    guardianOf = invite.student_id ?? null;
  } else {
    const school = await (await col(C.schools)).findOne({ join_code: input.code.toUpperCase() });
    if (!school) throw new UserFacingError("That code isn't valid. Check with your school.");
    schoolId = String(school._id);
    role = "student";
  }

  let needsGuardianConsent = false;
  if (role === "student") {
    if (!input.birthYear) throw new UserFacingError("Please enter your year of birth.");
    const age = new Date().getFullYear() - input.birthYear;
    if (age < 10 || age > 21) throw new UserFacingError("EduConnect AI accounts are for students aged 10–21.");
    // Conservative: the youngest possible age for that birth year.
    needsGuardianConsent = age - 1 < DIGITAL_CONSENT_AGE;
  }

  const userId = newId();
  const now = new Date();
  try {
    await users.insertOne({ _id: userId as never, email: input.email, password_hash: hash, status: "active", is_demo: false, failed_logins: 0, locked_until: null, created_at: now, last_login_at: null });
  } catch (err) {
    if ((err as { code?: number }).code === 11000) throw new UserFacingError("An account with this email already exists. Try signing in.");
    throw err;
  }
  const cls = classId ? await (await col(C.classes)).findOne({ _id: classId as never, school_id: schoolId }) : null;
  await (await col(C.profiles)).insertOne({
    _id: userId as never, school_id: schoolId, role, display_name: input.displayName, avatar_color: "coral", avatar_emoji: null, locale: "en",
    birth_year: role === "student" ? input.birthYear : null, grade_level: cls?.grade_level ?? null, onboarded: false,
    account_state: needsGuardianConsent ? "pending_guardian_consent" : "active", is_demo: false, created_at: now,
  });
  if (role === "student") {
    await (await col(C.studentProfiles)).insertOne({
      _id: userId as never, school_id: schoolId, bio: null, learning_style: null, goals: [], clubs: [], open_to: ["study_partner", "project", "club"],
      discoverable: false, show_class: true, interest_ids: [], updated_at: now,
    });
    if (cls) await (await col(C.enrollments)).updateOne({ class_id: classId, student_id: userId }, { $setOnInsert: { _id: newId(), school_id: schoolId, enrolled_at: now } }, { upsert: true });
    if (!needsGuardianConsent) {
      await (await col(C.consents)).insertOne({
        _id: newId() as never, school_id: schoolId, subject_id: userId, consent_type: "platform", granted: true, given_by: userId, given_by_role: "student", method: "in_app", recorded_at: now,
      });
    }
  }
  if (role === "counselor") await grantCounselorDefaults(schoolId, userId);
  if (role === "parent" && guardianOf) {
    const child = await (await col(C.profiles)).findOne({ _id: guardianOf as never, school_id: schoolId, role: "student" });
    if (child) {
      await (await col(C.guardianLinks)).updateOne(
        { guardian_id: userId, student_id: guardianOf },
        { $setOnInsert: { _id: newId(), school_id: schoolId, relationship: "parent", status: "active", created_at: now } },
        { upsert: true },
      );
    }
  }
  if (invite) await (await col(C.invitations)).updateOne({ _id: invite._id }, { $set: { accepted_at: now } });
  await audit({ schoolId, actorId: userId, action: "account.registered", resourceType: "user", resourceId: userId, metadata: { role, via: invite ? "invitation" : "school_code" } });
  return { userId, role, needsGuardianConsent };
}

export async function grantCounselorDefaults(schoolId: string, userId: string) {
  const perms = await col(C.staffPermissions);
  for (const p of ["wellbeing.alerts", "wellbeing.rules", "wellbeing.aggregate", "safeguarding.reports"]) {
    await perms.updateOne({ user_id: userId, permission: p }, { $setOnInsert: { _id: newId(), school_id: schoolId, granted_by: null, granted_at: new Date() } }, { upsert: true });
  }
}

/** Creates a reset token if the account exists. Always behaves the same to the caller. */
export async function createPasswordReset(emailRaw: string): Promise<{ email: string; token: string } | null> {
  const email = emailRaw.trim().toLowerCase();
  const user = await (await col(C.users)).findOne({ email, status: "active" });
  if (!user) return null;
  const token = randomToken(32);
  const resets = await col(C.passwordResets);
  await resets.deleteMany({ user_id: String(user._id) });
  await resets.insertOne({ _id: sha256(token) as never, user_id: String(user._id), expires_at: new Date(Date.now() + 30 * 60_000), used_at: null, created_at: new Date() });
  return { email, token };
}

export async function completePasswordReset(token: string, password: string): Promise<string> {
  const problem = passwordProblem(password);
  if (problem) throw new UserFacingError(problem);
  const hash = await hashPassword(password);
  const resets = await col(C.passwordResets);
  const row = await resets.findOneAndUpdate(
    { _id: sha256(token) as never, used_at: null, expires_at: { $gt: new Date() } },
    { $set: { used_at: new Date() } },
  );
  if (!row) throw new UserFacingError("This reset link has expired or was already used. Request a new one.");
  const userId = String(row.user_id);
  await (await col(C.users)).updateOne({ _id: userId as never }, { $set: { password_hash: hash, failed_logins: 0, locked_until: null } });
  await (await col(C.sessions)).deleteMany({ user_id: userId });
  const profile = await (await col(C.profiles)).findOne({ _id: userId as never });
  await audit({ schoolId: profile ? String(profile.school_id) : null, actorId: userId, action: "account.password_reset", resourceType: "user", resourceId: userId });
  return userId;
}

export async function listDemoAccounts() {
  const school = await (await col(C.schools)).findOne({ join_code: "AURORA-DEMO", is_demo: true });
  if (!school) return [];
  const profiles = await (await col(C.profiles)).find({ school_id: String(school._id), is_demo: true }).toArray();
  const users = new Map((await (await col(C.users)).find({ _id: { $in: profiles.map((p) => p._id) }, is_demo: true, status: "active" }).toArray()).map((u) => [String(u._id), u]));
  const order: Role[] = ["student", "teacher", "counselor", "admin", "parent"];
  return profiles
    .filter((p) => users.has(String(p._id)))
    .filter((p) => p.role !== "student" || ["Maria Georgescu", "Alex Pop", "Sara Oprea"].includes(p.display_name))
    .filter((p) => p.role !== "teacher" || p.display_name === "Mihai Ionescu")
    .sort((a, b) => order.indexOf(a.role) - order.indexOf(b.role) || String(a.display_name).localeCompare(b.display_name))
    .map((p) => ({
      email: String(users.get(String(p._id))!.email), display_name: String(p.display_name), role: p.role as Role, school: String(school.name),
      grade_level: (p.grade_level as number | null) ?? null, avatar_color: String(p.avatar_color),
    }));
}

export async function demoUserId(email: string): Promise<string | null> {
  const row = await (await col(C.users)).findOne({ email: email.toLowerCase(), is_demo: true, status: "active" });
  return row ? String(row._id) : null;
}
