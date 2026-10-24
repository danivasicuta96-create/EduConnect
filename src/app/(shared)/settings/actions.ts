"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { assertUser, destroySession } from "@/lib/auth/session";
import { fail, fromError, ok, type ActionState } from "@/lib/action-state";
import { changePassword, deleteMyWellbeingHistory, notificationTypesFor, requestAccountDeletion, saveNotificationPrefs, setLocale, signOutEverywhere } from "@/lib/services/account";
import { setOwnConsent, type ConsentType } from "@/lib/services/consent";

export async function consentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await assertUser(["student"]);
  const type = z.enum(["wellbeing_checkins", "matchmaking", "ai_features"]).safeParse(formData.get("type"));
  if (!type.success) return fail("Unknown setting.");
  const granted = formData.get("granted") === "yes";
  try {
    await setOwnConsent(user, type.data as ConsentType, granted);
    revalidatePath("/", "layout");
    return ok(granted ? "Switched on." : "Switched off. You can turn it back on any time.");
  } catch (err) {
    return fromError(err);
  }
}

export async function notificationPrefsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await assertUser();
  const prefs = notificationTypesFor(user.role).map((type) => ({
    type,
    inApp: formData.get(`inApp_${type}`) === "on",
    email: formData.get(`email_${type}`) === "on",
  }));
  try {
    await saveNotificationPrefs(user, prefs);
    revalidatePath("/settings");
    return ok("Notification preferences saved.");
  } catch (err) {
    return fromError(err);
  }
}

export async function localeAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await assertUser();
  const locale = z.enum(["en", "ro"]).safeParse(formData.get("locale"));
  if (!locale.success) return fail("Choose a language.");
  try {
    await setLocale(user, locale.data);
    revalidatePath("/", "layout");
    return ok("Language preference saved.");
  } catch (err) {
    return fromError(err);
  }
}

export async function passwordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await assertUser();
  const next = String(formData.get("next") ?? "");
  if (next !== String(formData.get("confirm") ?? "")) return fail("The new passwords don't match.");
  try {
    await changePassword(user, String(formData.get("current") ?? ""), next);
    return ok("Password changed.");
  } catch (err) {
    return fromError(err);
  }
}

export async function deleteWellbeingAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await assertUser(["student"]);
  if (formData.get("confirm") !== "DELETE") return fail('Type DELETE to confirm.');
  try {
    const n = await deleteMyWellbeingHistory(user);
    revalidatePath("/", "layout");
    return ok(`Deleted ${n} check-in${n === 1 ? "" : "s"}.`);
  } catch (err) {
    return fromError(err);
  }
}

export async function signOutEverywhereAction(): Promise<void> {
  const user = await assertUser();
  await signOutEverywhere(user);
  await destroySession();
  redirect("/login");
}

export async function requestDeletionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await assertUser();
  if (formData.get("confirm") !== "DELETE") return fail('Type DELETE to confirm.');
  try {
    await requestAccountDeletion(user);
  } catch (err) {
    return fromError(err);
  }
  await destroySession();
  redirect("/login");
}
