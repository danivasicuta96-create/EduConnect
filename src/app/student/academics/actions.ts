"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertUser } from "@/lib/auth/session";
import { fromError, fromZod, ok, type ActionState } from "@/lib/action-state";
import { addGoal, deleteGoal, goalSchema, toggleGoal } from "@/lib/services/academics";

export async function addGoalAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await assertUser(["student"]);
  const parsed = goalSchema.safeParse({
    title: formData.get("title"),
    subjectId: formData.get("subjectId") || null,
    targetAverage: formData.get("targetAverage") || null,
  });
  if (!parsed.success) return fromZod(parsed.error);
  try {
    await addGoal(user, parsed.data);
    revalidatePath("/student/academics");
    return ok("Goal added.");
  } catch (err) {
    return fromError(err);
  }
}

const idSchema = z.string().uuid();

export async function toggleGoalAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await assertUser(["student"]);
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) return fromZod(id.error);
  try {
    await toggleGoal(user, id.data);
    revalidatePath("/student/academics");
    return ok();
  } catch (err) {
    return fromError(err);
  }
}

export async function deleteGoalAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await assertUser(["student"]);
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) return fromZod(id.error);
  try {
    await deleteGoal(user, id.data);
    revalidatePath("/student/academics");
    return ok();
  } catch (err) {
    return fromError(err);
  }
}
