"use server";

import { revalidatePath } from "next/cache";
import { assertUser } from "@/lib/auth/session";
import { fromError, fromZod, ok, type ActionState } from "@/lib/action-state";
import { assertPermission } from "@/lib/services/actor";
import {
  PERMS, addFollowup, alertIdSchema, assignAlertToMe, followupSchema, offerSessionSchema, offerSupportSession, resolveAlert,
  resolveSchema, setAlertStatus,
} from "@/lib/services/counselor";

async function counselor() {
  const user = await assertUser(["counselor"]);
  assertPermission(user, PERMS.alerts);
  return user;
}

function refresh(alertId: string) {
  revalidatePath(`/counselor/alerts/${alertId}`);
  revalidatePath("/counselor/alerts");
  revalidatePath("/counselor");
}

export async function acknowledgeAlertAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await counselor();
    const alertId = alertIdSchema.parse(formData.get("alertId"));
    await setAlertStatus(user, alertId, "acknowledged");
    refresh(alertId);
    return ok("Alert acknowledged.");
  } catch (err) {
    return fromError(err);
  }
}

export async function markInProgressAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await counselor();
    const alertId = alertIdSchema.parse(formData.get("alertId"));
    await setAlertStatus(user, alertId, "in_progress");
    refresh(alertId);
    return ok("Marked as support in progress.");
  } catch (err) {
    return fromError(err);
  }
}

export async function assignToMeAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await counselor();
    const alertId = alertIdSchema.parse(formData.get("alertId"));
    await assignAlertToMe(user, alertId);
    refresh(alertId);
    return ok("Assigned to you.");
  } catch (err) {
    return fromError(err);
  }
}

export async function resolveAlertAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await counselor();
    const parsed = resolveSchema.safeParse({ alertId: formData.get("alertId"), resolution: formData.get("resolution") ?? "" });
    if (!parsed.success) return fromZod(parsed.error);
    await resolveAlert(user, parsed.data);
    refresh(parsed.data.alertId);
    return ok("Alert resolved.");
  } catch (err) {
    return fromError(err);
  }
}

export async function addFollowupAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await counselor();
    const parsed = followupSchema.safeParse({
      alertId: formData.get("alertId"),
      action: formData.get("action"),
      note: formData.get("note") ?? "",
    });
    if (!parsed.success) return fromZod(parsed.error);
    await addFollowup(user, parsed.data);
    refresh(parsed.data.alertId);
    return ok("Follow-up added.");
  } catch (err) {
    return fromError(err);
  }
}

export async function offerSessionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await counselor();
    const parsed = offerSessionSchema.safeParse({
      alertId: formData.get("alertId"),
      proposedAt: formData.get("proposedAt") ?? "",
      location: formData.get("location") ?? "",
    });
    if (!parsed.success) return fromZod(parsed.error);
    await offerSupportSession(user, parsed.data);
    refresh(parsed.data.alertId);
    revalidatePath("/counselor/sessions");
    return ok("Invitation sent. The student can accept, decline or reply.");
  } catch (err) {
    return fromError(err);
  }
}
