"use server";

import { revalidatePath } from "next/cache";
import { assertUser } from "@/lib/auth/session";
import { formObject, fromError, fromZod, ok, type ActionState } from "@/lib/action-state";
import {
  alertRuleSchema, regenerateJoinCode, retentionSchema, runRetentionCleanup, schoolInfoSchema, updateAlertRule, updateRetention, updateSchoolInfo,
} from "@/lib/services/admin";

export async function saveSchoolInfo(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await assertUser(["admin"]);
  const parsed = schoolInfoSchema.safeParse(formObject(formData));
  if (!parsed.success) return fromZod(parsed.error);
  try {
    await updateSchoolInfo(user, parsed.data);
  } catch (err) {
    return fromError(err);
  }
  revalidatePath("/admin", "layout");
  return ok("School details saved");
}

export async function regenerateJoinCodeAction(): Promise<ActionState> {
  const user = await assertUser(["admin"]);
  try {
    const code = await regenerateJoinCode(user);
    revalidatePath("/admin/settings");
    return ok(`New school code: ${code}. The old code no longer works.`);
  } catch (err) {
    return fromError(err);
  }
}

export async function saveRetention(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await assertUser(["admin"]);
  const parsed = retentionSchema.safeParse(formObject(formData));
  if (!parsed.success) return fromZod(parsed.error);
  try {
    await updateRetention(user, parsed.data);
  } catch (err) {
    return fromError(err);
  }
  revalidatePath("/admin/settings");
  return ok("Retention settings saved");
}

export async function runCleanupAction(): Promise<ActionState> {
  const user = await assertUser(["admin"]);
  try {
    const r = await runRetentionCleanup(user);
    revalidatePath("/admin/settings");
    revalidatePath("/admin/audit");
    return ok(`Cleanup complete: ${r.checkins} check-in${r.checkins === 1 ? "" : "s"} (${r.notes} private note${r.notes === 1 ? "" : "s"}) and ${r.auditRows} audit event${r.auditRows === 1 ? "" : "s"} deleted.`);
  } catch (err) {
    return fromError(err);
  }
}

export async function saveAlertRule(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await assertUser(["admin"]);
  const parsed = alertRuleSchema.safeParse(formObject(formData));
  if (!parsed.success) return fromZod(parsed.error);
  try {
    await updateAlertRule(user, parsed.data);
  } catch (err) {
    return fromError(err);
  }
  revalidatePath("/admin/settings");
  return ok("Rule saved");
}
