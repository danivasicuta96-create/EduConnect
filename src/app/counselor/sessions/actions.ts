"use server";

import { revalidatePath } from "next/cache";
import { assertUser } from "@/lib/auth/session";
import { fromError, fromZod, ok, type ActionState } from "@/lib/action-state";
import { assertPermission } from "@/lib/services/actor";
import { PERMS, sessionUpdateSchema, updateSessionStatus } from "@/lib/services/counselor";

export async function updateSessionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await assertUser(["counselor"]);
    assertPermission(user, PERMS.alerts);
    const parsed = sessionUpdateSchema.safeParse({ sessionId: formData.get("sessionId"), status: formData.get("status") });
    if (!parsed.success) return fromZod(parsed.error);
    await updateSessionStatus(user, parsed.data);
    revalidatePath("/counselor/sessions");
    revalidatePath("/counselor");
    const alertId = formData.get("alertId");
    if (typeof alertId === "string" && alertId) revalidatePath(`/counselor/alerts/${alertId}`);
    return ok(parsed.data.status === "completed" ? "Marked as completed." : "Conversation cancelled.");
  } catch (err) {
    return fromError(err);
  }
}
