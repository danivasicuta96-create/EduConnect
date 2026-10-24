// Parent / guardian portal (MongoDB).
//
// Academic data is visible only with an active guardian link AND a recorded
// guardian_access consent (`isGuardianOf`, enforced again inside
// `loadStudentAcademics` via `canReadAcademics`). Guardians never see any
// wellbeing data — this module doesn't touch check-ins, alerts or notes.
// Every query runs through `tenant(actor)` and is constrained to the
// guardian's own links (`guardian_id: actor.id`).

import { z } from "zod";
import { col, COLLECTIONS as C } from "@/lib/db/mongo";
import { tenant } from "@/lib/db/tenant";
import { isLinkedGuardian } from "@/lib/authz";
import { todayIn } from "@/lib/dates";
import { UserFacingError } from "@/lib/action-state";
import type { Actor } from "./actor";
import { assertRole } from "./actor";
import { audit } from "./audit";
import { canSelfConsent, consentMap, type ConsentMap, type ConsentType } from "./consent";
import { loadStudentAcademics, type StudentAcademics } from "./academics";
import { syncStudentAccountState } from "./admin";

export const GUARDIAN_CONSENTS: ConsentType[] = ["platform", "wellbeing_checkins", "matchmaking", "ai_features"];

export interface ChildOverview {
  id: string;
  displayName: string;
  avatarColor: string;
  avatarEmoji: string | null;
  gradeLevel: number | null;
  relationship: string;
  linkStatus: "pending" | "active" | "revoked";
  accountState: "active" | "pending_guardian_consent" | "suspended";
  /** True when the child is old enough to give (and withdraw) consent themselves. */
  selfConsent: boolean;
  consents: ConsentMap;
  /** Null when there's no active link or no guardian_access consent. */
  academics: StudentAcademics | null;
}

export async function getChildren(actor: Actor): Promise<ChildOverview[]> {
  assertRole(actor, "parent");
  const t = tenant(actor);
  const today = todayIn(actor.timezone);
  const links = await t.guardianLinks.find({ guardian_id: actor.id, status: { $ne: "revoked" } });
  const profiles = new Map(
    (await t.profiles.find(
      { _id: { $in: links.map((l) => String(l.student_id)) }, role: "student" },
      { projection: { display_name: 1, avatar_color: 1, avatar_emoji: 1, grade_level: 1, account_state: 1, birth_year: 1 } },
    )).map((p) => [String(p._id), p]),
  );
  const out: ChildOverview[] = [];
  for (const l of links) {
    const id = String(l.student_id);
    const p = profiles.get(id);
    if (!p) continue;
    const consents = await consentMap(t, id);
    const allowed = l.status === "active" && consents.guardian_access.granted;
    out.push({
      id,
      displayName: String(p.display_name),
      avatarColor: String(p.avatar_color),
      avatarEmoji: (p.avatar_emoji as string | null) ?? null,
      gradeLevel: (p.grade_level as number | null) ?? null,
      relationship: String(l.relationship),
      linkStatus: l.status,
      accountState: p.account_state,
      selfConsent: canSelfConsent((p.birth_year as number | null) ?? null),
      consents,
      // loadStudentAcademics re-checks isGuardianOf (link + consent) itself.
      academics: allowed ? await loadStudentAcademics(actor, id, today) : null,
    });
  }
  return out.sort((a, b) => a.displayName.localeCompare(b.displayName));
}

const yesNo = z.enum(["yes", "no", ""]).catch("");
export const guardianConsentSchema = z
  .object({
    studentId: z.string().uuid("Invalid selection."),
    platform: yesNo,
    wellbeing_checkins: yesNo,
    matchmaking: yesNo,
    ai_features: yesNo,
  })
  .transform((v) => {
    const choices: Partial<Record<ConsentType, boolean>> = {};
    for (const t of GUARDIAN_CONSENTS) {
      const c = v[t as keyof typeof v];
      if (c === "yes" || c === "no") choices[t] = c === "yes";
    }
    return { studentId: v.studentId, choices };
  });

/**
 * Record a guardian's in-app consent choices for an actively linked child
 * under the age of digital consent. Only choices that differ from the current
 * state are recorded. When platform consent is granted for a child waiting
 * for guardian consent, the account is activated.
 */
export async function setGuardianConsent(
  actor: Actor,
  input: z.infer<typeof guardianConsentSchema>,
): Promise<{ recorded: number; activated: boolean }> {
  assertRole(actor, "parent");
  const t = tenant(actor);
  // Re-read the guardian's own profile: must still be an active parent of this school.
  const me = await (await col(C.profiles)).findOne({ _id: actor.id }, { projection: { role: 1, school_id: 1, account_state: 1 } });
  const linked = me?.role === "parent" && String(me.school_id) === actor.schoolId && me.account_state !== "suspended" && (await isLinkedGuardian(t, actor, input.studentId));
  const child = linked ? await t.profiles.findOne({ _id: input.studentId, role: "student" }, { projection: { birth_year: 1 } }) : null;
  if (!child) throw new UserFacingError("You can only record choices for a child linked to your account.");
  if (canSelfConsent((child.birth_year as number | null) ?? null)) {
    throw new UserFacingError("Your child is 16 or older and manages these choices in their own account.");
  }
  const current = await consentMap(t, input.studentId);
  const now = new Date();
  const changes = (Object.entries(input.choices) as Array<[ConsentType, boolean]>).filter(
    ([type, granted]) => GUARDIAN_CONSENTS.includes(type) && !(current[type].recordedAt && current[type].granted === granted),
  );
  if (changes.length === 0) return { recorded: 0, activated: false };
  await t.consents.insertMany(
    changes.map(([type, granted]) => ({
      subject_id: input.studentId, consent_type: type, granted, given_by: actor.id, given_by_role: "guardian", method: "in_app", recorded_at: now,
    })),
  );
  await audit({
    schoolId: actor.schoolId, actorId: actor.id, action: "consent.guardian_recorded", resourceType: "consent", resourceId: input.studentId,
    metadata: { changes: changes.length },
  });
  // The active link was verified above; guardians may activate, never deactivate.
  const change = await syncStudentAccountState(input.studentId, { actorId: actor.id, schoolId: actor.schoolId, allowDeactivate: false });
  return { recorded: changes.length, activated: change === "activated" };
}
