"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertUser } from "@/lib/auth/session";
import { fromError, fromZod, ok, formObject, type ActionState } from "@/lib/action-state";
import { todayIn } from "@/lib/dates";
import { assertPermission } from "@/lib/services/actor";
import { PERMS, deleteResource, resourceSchema, saveResource, setResourceVerified } from "@/lib/services/counselor";

async function resourcesUser() {
  const user = await assertUser(["counselor"]);
  assertPermission(user, PERMS.alerts);
  return user;
}

function refresh() {
  revalidatePath("/counselor/resources");
  // Students see these on their support page.
  revalidatePath("/student/wellbeing/support");
}

export async function saveResourceAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await resourcesUser();
    const raw = formObject(formData);
    const parsed = resourceSchema.safeParse({
      id: raw.id || undefined,
      category: raw.category,
      name: raw.name ?? "",
      phone: raw.phone ?? "",
      url: raw.url ?? "",
      description: raw.description ?? "",
      hours: raw.hours ?? "",
      lastVerified: raw.lastVerified ?? "",
      sortOrder: raw.sortOrder ?? "",
    });
    if (!parsed.success) return fromZod(parsed.error);
    await saveResource(user, parsed.data);
    refresh();
    return ok(parsed.data.id ? "Resource saved." : "Resource added.");
  } catch (err) {
    return fromError(err);
  }
}

const idSchema = z.uuid("Unknown resource.");

export async function verifyResourceAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await resourcesUser();
    const id = idSchema.parse(formData.get("resourceId"));
    await setResourceVerified(user, id, todayIn(user.timezone));
    refresh();
    return ok("Marked as verified today.");
  } catch (err) {
    return fromError(err);
  }
}

export async function deleteResourceAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await resourcesUser();
    const id = idSchema.parse(formData.get("resourceId"));
    await deleteResource(user, id);
    refresh();
    return ok("Resource removed.");
  } catch (err) {
    return fromError(err);
  }
}
