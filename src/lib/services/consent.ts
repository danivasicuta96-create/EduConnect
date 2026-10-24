import { tenant, type Tenant } from "@/lib/db/tenant";
import { DIGITAL_CONSENT_AGE } from "@/lib/constants";
import { UserFacingError } from "@/lib/action-state";
import type { ConsentType } from "@/lib/authz";
import type { Actor } from "./actor";
import { assertRole } from "./actor";
import { audit } from "./audit";

export type { ConsentType };
export const STUDENT_CONSENTS: ConsentType[] = ["platform", "wellbeing_checkins", "matchmaking", "ai_features"];

export type ConsentMap = Record<ConsentType, { granted: boolean; recordedAt: string | null; method: string | null; givenByRole: string | null }>;

export async function consentMap(t: Tenant, studentId: string): Promise<ConsentMap> {
  const rows = await t.consents.find({ subject_id: studentId }, { sort: { recorded_at: -1 } });
  const empty = { granted: false, recordedAt: null, method: null, givenByRole: null };
  const map = {
    platform: { ...empty }, wellbeing_checkins: { ...empty }, matchmaking: { ...empty }, ai_features: { ...empty }, guardian_access: { ...empty },
  } as ConsentMap;
  const seen = new Set<string>();
  for (const r of rows) {
    const type = r.consent_type as ConsentType;
    if (seen.has(type) || !(type in map)) continue; // newest record per type wins
    seen.add(type);
    map[type] = { granted: Boolean(r.granted), recordedAt: new Date(r.recorded_at).toISOString(), method: r.method, givenByRole: r.given_by_role };
  }
  return map;
}

/** Feature gates for a student: account active AND the relevant consent recorded. */
export interface StudentAccess {
  active: boolean;
  checkins: boolean;
  matchmaking: boolean;
  ai: boolean;
  canSelfConsent: boolean;
  consents: ConsentMap;
}

/** Access flags for a student in the actor's school. */
export async function studentAccess(actor: { schoolId: string }, studentId: string): Promise<StudentAccess> {
  const t = tenant(actor);
  const p = await t.profiles.findOne({ _id: studentId, role: "student" });
  const consents = await consentMap(t, studentId);
  const active = p?.account_state === "active";
  return {
    active,
    checkins: active && consents.wellbeing_checkins.granted,
    matchmaking: active && consents.matchmaking.granted,
    ai: active && consents.ai_features.granted,
    canSelfConsent: canSelfConsent((p?.birth_year as number | null) ?? null),
    consents,
  };
}

/** Students can give consent themselves only from the age of digital consent (16 in Romania). */
export function canSelfConsent(birthYear: number | null, now = new Date()): boolean {
  if (!birthYear) return false;
  return now.getFullYear() - birthYear - 1 >= DIGITAL_CONSENT_AGE;
}

/**
 * A student records their own choice. Withdrawing is always allowed; granting
 * requires the student to be old enough to consent for themselves.
 */
export async function setOwnConsent(actor: Actor, type: ConsentType, granted: boolean): Promise<void> {
  assertRole(actor, "student");
  if (type === "guardian_access") throw new UserFacingError("Guardian access is managed by your school.");
  const t = tenant(actor);
  const p = await t.profiles.findOne({ _id: actor.id });
  if (granted && !canSelfConsent((p?.birth_year as number | null) ?? null)) {
    throw new UserFacingError("Because you're under 16, a parent or guardian needs to give this consent through your school.");
  }
  await t.consents.insertOne({ subject_id: actor.id, consent_type: type, granted, given_by: actor.id, given_by_role: "student", method: "in_app", recorded_at: new Date() });
  await audit({ schoolId: actor.schoolId, actorId: actor.id, action: granted ? "consent.granted" : "consent.withdrawn", resourceType: "consent", resourceId: actor.id, metadata: { type } });
}
