"use server";

import { redirect } from "next/navigation";
import { assertUser } from "@/lib/auth/session";
import { fail, fromError, fromZod, type ActionState } from "@/lib/action-state";
import { basicProfileSchema, markOnboarded, parseStudentProfileForm, updateBasicProfile, updateStudentProfile } from "@/lib/services/profile";
import { setOwnConsent, type ConsentType } from "@/lib/services/consent";
import { ROLE_HOME } from "@/lib/constants";

export async function completeStudentOnboarding(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await assertUser(["student"]);
  const parsed = parseStudentProfileForm(formData);
  if (!parsed.success) return fromZod(parsed.error);
  try {
    await updateStudentProfile(user, parsed.data);
    for (const type of ["wellbeing_checkins", "matchmaking", "ai_features"] as ConsentType[]) {
      const value = formData.get(`consent_${type}`);
      if (value === "on") await setOwnConsent(user, type, true);
    }
    await markOnboarded(user);
  } catch (err) {
    return fromError(err);
  }
  redirect("/student");
}

export async function completeStaffOnboarding(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await assertUser(["teacher", "counselor", "admin", "parent"]);
  if (formData.get("acknowledge") !== "on") return fail("Please confirm the confidentiality commitment.");
  const parsed = basicProfileSchema.safeParse({
    displayName: formData.get("displayName"),
    avatarColor: formData.get("avatarColor") ?? "slate",
    avatarEmoji: formData.get("avatarEmoji") ?? "",
  });
  if (!parsed.success) return fromZod(parsed.error);
  try {
    await updateBasicProfile(user, parsed.data);
    await markOnboarded(user);
  } catch (err) {
    return fromError(err);
  }
  redirect(ROLE_HOME[user.role]);
}
