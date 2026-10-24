"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { assertUser } from "@/lib/auth/session";
import { formObject, fromError, fromZod, ok, type ActionState } from "@/lib/action-state";
import {
  addTeachingAssignment, addTimetableEntry, assignmentSchema, classSchema, createSubject, deleteClass, deleteSubject, enrollStudent,
  enrollmentSchema, removeTeachingAssignment, removeTimetableEntry, saveClass, subjectSchema, timetableSchema, unenrollStudent,
} from "@/lib/services/admin";

const idSchema = z.object({ id: z.string().uuid("Invalid selection.") });

function done(message: string) {
  revalidatePath("/admin/classes");
  revalidatePath("/admin");
  return ok(message);
}

export async function saveClassAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await assertUser(["admin"]);
  const parsed = classSchema.safeParse(formObject(formData));
  if (!parsed.success) return fromZod(parsed.error);
  let id: string;
  try {
    id = await saveClass(user, parsed.data);
  } catch (err) {
    return fromError(err);
  }
  if (parsed.data.id) return done("Class saved");
  revalidatePath("/admin/classes");
  redirect(`/admin/classes?class=${id}`);
}

export async function deleteClassAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await assertUser(["admin"]);
  const parsed = idSchema.safeParse(formObject(formData));
  if (!parsed.success) return fromZod(parsed.error);
  try {
    await deleteClass(user, parsed.data.id);
  } catch (err) {
    return fromError(err);
  }
  revalidatePath("/admin/classes");
  redirect("/admin/classes");
}

export async function createSubjectAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await assertUser(["admin"]);
  const parsed = subjectSchema.safeParse(formObject(formData));
  if (!parsed.success) return fromZod(parsed.error);
  try {
    await createSubject(user, parsed.data);
  } catch (err) {
    return fromError(err);
  }
  return done("Subject added");
}

export async function deleteSubjectAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await assertUser(["admin"]);
  const parsed = idSchema.safeParse(formObject(formData));
  if (!parsed.success) return fromZod(parsed.error);
  try {
    await deleteSubject(user, parsed.data.id);
  } catch (err) {
    return fromError(err);
  }
  return done("Subject deleted");
}

export async function addAssignmentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await assertUser(["admin"]);
  const parsed = assignmentSchema.safeParse(formObject(formData));
  if (!parsed.success) return fromZod(parsed.error);
  try {
    await addTeachingAssignment(user, parsed.data);
  } catch (err) {
    return fromError(err);
  }
  return done("Teacher assigned");
}

export async function removeAssignmentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await assertUser(["admin"]);
  const parsed = idSchema.safeParse(formObject(formData));
  if (!parsed.success) return fromZod(parsed.error);
  try {
    await removeTeachingAssignment(user, parsed.data.id);
  } catch (err) {
    return fromError(err);
  }
  return done("Assignment removed");
}

export async function enrollAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await assertUser(["admin"]);
  const parsed = enrollmentSchema.safeParse(formObject(formData));
  if (!parsed.success) return fromZod(parsed.error);
  try {
    await enrollStudent(user, parsed.data.classId, parsed.data.studentId);
  } catch (err) {
    return fromError(err);
  }
  return done("Student added to the class");
}

export async function unenrollAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await assertUser(["admin"]);
  const parsed = enrollmentSchema.safeParse(formObject(formData));
  if (!parsed.success) return fromZod(parsed.error);
  try {
    await unenrollStudent(user, parsed.data.classId, parsed.data.studentId);
  } catch (err) {
    return fromError(err);
  }
  return done("Student removed from the class");
}

export async function addTimetableAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await assertUser(["admin"]);
  const parsed = timetableSchema.safeParse(formObject(formData));
  if (!parsed.success) return fromZod(parsed.error);
  try {
    await addTimetableEntry(user, parsed.data);
  } catch (err) {
    return fromError(err);
  }
  return done("Lesson added to the timetable");
}

export async function removeTimetableAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await assertUser(["admin"]);
  const parsed = idSchema.safeParse(formObject(formData));
  if (!parsed.success) return fromZod(parsed.error);
  try {
    await removeTimetableEntry(user, parsed.data.id);
  } catch (err) {
    return fromError(err);
  }
  return done("Lesson removed");
}
