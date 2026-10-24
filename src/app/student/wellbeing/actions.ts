"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertUser } from "@/lib/auth/session";
import { fromError, fromZod, ok, type ActionState } from "@/lib/action-state";
import { checkinSchema, requestCounselorContact, respondToSession, submitCheckin } from "@/lib/services/wellbeing";

export async function submitCheckinAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await assertUser(["student"]);
  const parsed = checkinSchema.safeParse({
    mood: formData.get("mood"),
    experience: formData.get("experience") || null,
    factors: formData.getAll("factors").map(String),
    note: formData.get("note") ?? "",
    shareNote: formData.get("shareNote") === "on",
  });
  if (!parsed.success) return fromZod(parsed.error);
  try {
    const result = await submitCheckin(user, parsed.data);
    revalidatePath("/student");
    revalidatePath("/student/wellbeing", "layout");
    return ok("Thanks for checking in. 💛", { suggestions: result.suggestions, mood: parsed.data.mood });
  } catch (err) {
    return fromError(err);
  }
}

export async function requestContactAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await assertUser(["student"]);
  const message = z.string().trim().max(300).safeParse(formData.get("message") ?? "");
  if (!message.success) return fromZod(message.error);
  try {
    await requestCounselorContact(user, message.data || null, formData.get("urgent") === "on");
    revalidatePath("/student/wellbeing/support");
    return ok("Your request was sent. A school counselor will get in touch with you soon. If you're in danger, call 112 now.");
  } catch (err) {
    return fromError(err);
  }
}

export async function respondSessionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await assertUser(["student"]);
  const id = z.string().uuid().safeParse(formData.get("sessionId"));
  if (!id.success) return fromZod(id.error);
  const message = String(formData.get("message") ?? "").trim().slice(0, 500) || null;
  try {
    await respondToSession(user, id.data, formData.get("accept") === "yes", message);
    revalidatePath("/student/wellbeing/support");
    return ok(formData.get("accept") === "yes" ? "Accepted — see you then." : "Okay, we've let the counselor know.");
  } catch (err) {
    return fromError(err);
  }
}
