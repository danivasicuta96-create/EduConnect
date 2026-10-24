"use server";

import { revalidatePath } from "next/cache";
import { assertUser } from "@/lib/auth/session";
import { fail, fromError, fromZod, ok, type ActionState } from "@/lib/action-state";
import { assessmentSchema, createAssessment, deleteAssessment, isUuid } from "@/lib/services/teacher";

function refresh() {
  revalidatePath("/teacher/assessments");
  revalidatePath("/teacher/gradebook");
  revalidatePath("/teacher");
}

export async function createAssessmentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await assertUser(["teacher"]);
  const [classId, subjectId] = String(formData.get("assignment") ?? "").split(":");
  const parsed = assessmentSchema.safeParse({
    classId,
    subjectId,
    title: formData.get("title"),
    kind: formData.get("kind"),
    dueDate: formData.get("dueDate"),
    description: formData.get("description"),
  });
  if (!parsed.success) {
    const state = fromZod(parsed.error);
    // Surface class/subject problems on the combined picker.
    const pick = [...(state.errors?.classId ?? []), ...(state.errors?.subjectId ?? [])];
    if (pick.length) state.errors = { ...state.errors, assignment: [pick[0]] };
    return state;
  }
  try {
    await createAssessment(user, parsed.data);
  } catch (err) {
    return fromError(err);
  }
  refresh();
  return ok("Assessment scheduled. Students in the class have been notified.");
}

export async function deleteAssessmentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await assertUser(["teacher"]);
  const id = formData.get("assessmentId");
  if (!isUuid(id)) return fail("That assessment no longer exists.");
  try {
    await deleteAssessment(user, id);
  } catch (err) {
    return fromError(err);
  }
  refresh();
  return ok("Assessment removed.");
}
