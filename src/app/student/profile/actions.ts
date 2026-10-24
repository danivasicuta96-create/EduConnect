"use server";

import { revalidatePath } from "next/cache";
import { assertUser } from "@/lib/auth/session";
import { fromError, fromZod, ok, type ActionState } from "@/lib/action-state";
import { parseStudentProfileForm, updateStudentProfile } from "@/lib/services/profile";

export async function saveProfileAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await assertUser(["student"]);
  const parsed = parseStudentProfileForm(formData);
  if (!parsed.success) return fromZod(parsed.error);
  try {
    await updateStudentProfile(user, parsed.data);
    revalidatePath("/student", "layout");
    return ok("Profile saved.");
  } catch (err) {
    return fromError(err);
  }
}
