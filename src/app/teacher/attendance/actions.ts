"use server";

import { revalidatePath } from "next/cache";
import { assertUser } from "@/lib/auth/session";
import { fromError, fromZod, ok, type ActionState } from "@/lib/action-state";
import { attendanceSaveSchema, saveAttendance } from "@/lib/services/teacher";

export async function saveAttendanceAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await assertUser(["teacher"]);
  const entries: Array<{ studentId: string; status: string; note: string }> = [];
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("status:")) continue;
    const studentId = key.slice("status:".length);
    entries.push({ studentId, status: String(value), note: String(formData.get(`note:${studentId}`) ?? "") });
  }
  const parsed = attendanceSaveSchema.safeParse({
    classId: formData.get("classId"),
    subjectId: formData.get("subjectId"),
    date: formData.get("date"),
    entries,
  });
  if (!parsed.success) return fromZod(parsed.error);
  let count: number;
  try {
    count = await saveAttendance(user, parsed.data);
  } catch (err) {
    return fromError(err);
  }
  revalidatePath("/teacher/attendance");
  revalidatePath("/teacher");
  return ok(`Attendance saved for ${count} student${count === 1 ? "" : "s"}.`);
}
