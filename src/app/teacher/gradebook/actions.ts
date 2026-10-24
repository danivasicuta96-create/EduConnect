"use server";

import { revalidatePath } from "next/cache";
import { assertUser } from "@/lib/auth/session";
import { fail, formObject, fromError, fromZod, ok, type ActionState } from "@/lib/action-state";
import { addGrade, deleteGrade, gradeInputSchema, gradeUpdateSchema, isUuid, updateGrade } from "@/lib/services/teacher";

function refresh() {
  revalidatePath("/teacher/gradebook");
  revalidatePath("/teacher");
}

export async function addGradeAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await assertUser(["teacher"]);
  const parsed = gradeInputSchema.safeParse(formObject(formData));
  if (!parsed.success) return fromZod(parsed.error);
  try {
    await addGrade(user, parsed.data);
  } catch (err) {
    return fromError(err);
  }
  refresh();
  return ok("Grade added. The student has been notified.");
}

export async function updateGradeAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await assertUser(["teacher"]);
  const parsed = gradeUpdateSchema.safeParse(formObject(formData));
  if (!parsed.success) return fromZod(parsed.error);
  try {
    await updateGrade(user, parsed.data);
  } catch (err) {
    return fromError(err);
  }
  refresh();
  return ok("Grade updated.");
}

export async function deleteGradeAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await assertUser(["teacher"]);
  const gradeId = formData.get("gradeId");
  if (!isUuid(gradeId)) return fail("That grade no longer exists.");
  try {
    await deleteGrade(user, gradeId);
  } catch (err) {
    return fromError(err);
  }
  refresh();
  return ok("Grade deleted.");
}
