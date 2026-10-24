"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertUser } from "@/lib/auth/session";
import { fromError, ok, type ActionState } from "@/lib/action-state";
import { deleteNotification, markNotificationsRead } from "@/lib/services/account";

export async function markReadAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await assertUser();
  const id = z.string().uuid().optional().safeParse(formData.get("id") || undefined);
  try {
    await markNotificationsRead(user, id.success ? id.data : undefined);
    revalidatePath("/", "layout");
    return ok();
  } catch (err) {
    return fromError(err);
  }
}

export async function deleteNotificationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await assertUser();
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return { ok: false, message: "Invalid notification." };
  try {
    await deleteNotification(user, id.data);
    revalidatePath("/", "layout");
    return ok();
  } catch (err) {
    return fromError(err);
  }
}
