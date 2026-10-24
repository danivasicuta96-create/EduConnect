"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertUser } from "@/lib/auth/session";
import { formObject, fromError, fromZod, ok, type ActionState } from "@/lib/action-state";
import {
  changeUserRole, createInvitation, inviteSchema, permissionSchema, revokeInvitation, roleChangeSchema, setAccountSuspended, setStaffPermission, suspendSchema,
} from "@/lib/services/admin";
import { PERMISSION_LABELS, ROLE_LABELS } from "@/lib/constants";

export async function inviteUser(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await assertUser(["admin"]);
  const parsed = inviteSchema.safeParse(formObject(formData));
  if (!parsed.success) return fromZod(parsed.error);
  try {
    const result = await createInvitation(user, parsed.data);
    revalidatePath("/admin/users");
    revalidatePath("/admin");
    return ok(`Invitation sent to ${parsed.data.email}.`, { code: result.code, registerUrl: result.registerUrl, email: parsed.data.email, role: ROLE_LABELS[parsed.data.role] });
  } catch (err) {
    return fromError(err);
  }
}

export async function revokeInvite(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await assertUser(["admin"]);
  const parsed = z.object({ id: z.string().uuid() }).safeParse(formObject(formData));
  if (!parsed.success) return fromZod(parsed.error);
  try {
    await revokeInvitation(user, parsed.data.id);
  } catch (err) {
    return fromError(err);
  }
  revalidatePath("/admin/users");
  revalidatePath("/admin");
  return ok("Invitation revoked");
}

export async function togglePermission(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await assertUser(["admin"]);
  const parsed = permissionSchema.safeParse(formObject(formData));
  if (!parsed.success) return fromZod(parsed.error);
  try {
    await setStaffPermission(user, parsed.data.userId, parsed.data.permission, parsed.data.grant);
  } catch (err) {
    return fromError(err);
  }
  revalidatePath("/admin/users");
  return ok(`${parsed.data.grant ? "Granted" : "Revoked"}: ${PERMISSION_LABELS[parsed.data.permission]}`);
}

export async function changeRole(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await assertUser(["admin"]);
  const parsed = roleChangeSchema.safeParse(formObject(formData));
  if (!parsed.success) return fromZod(parsed.error);
  try {
    await changeUserRole(user, parsed.data.userId, parsed.data.role);
  } catch (err) {
    return fromError(err);
  }
  revalidatePath("/admin/users");
  return ok(`Role changed to ${ROLE_LABELS[parsed.data.role]}. Permissions were reset.`);
}

export async function toggleSuspend(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await assertUser(["admin"]);
  const parsed = suspendSchema.safeParse(formObject(formData));
  if (!parsed.success) return fromZod(parsed.error);
  try {
    const { state } = await setAccountSuspended(user, parsed.data.userId, parsed.data.suspend);
    revalidatePath("/admin/users");
    revalidatePath("/admin");
    return ok(parsed.data.suspend ? "Account suspended and signed out everywhere." : state === "active" ? "Account reactivated." : "Account reactivated — still waiting for guardian consent.");
  } catch (err) {
    return fromError(err);
  }
}
