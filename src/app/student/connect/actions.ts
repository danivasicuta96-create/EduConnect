"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertUser } from "@/lib/auth/session";
import { fromError, fromZod, ok, type ActionState } from "@/lib/action-state";
import {
  blockStudent, connectionRequestSchema, createGroup, dismissRecommendation, groupSchema, inviteToGroup, joinGroup, leaveGroup,
  removeConnection, reportSchema, reportStudent, respondToRequest, sendConnectionRequest, unblockStudent,
} from "@/lib/services/connect";

const uuid = z.string().uuid();

function refresh() {
  revalidatePath("/student", "layout");
}

async function run(fn: () => Promise<void>, message?: string): Promise<ActionState> {
  try {
    await fn();
    refresh();
    return ok(message);
  } catch (err) {
    return fromError(err);
  }
}

export async function sendRequestAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await assertUser(["student"]);
  const parsed = connectionRequestSchema.safeParse({ addresseeId: formData.get("addresseeId"), message: formData.get("message") ?? "" });
  if (!parsed.success) return fromZod(parsed.error);
  return run(() => sendConnectionRequest(user, parsed.data), "Request sent!");
}

export async function respondAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await assertUser(["student"]);
  const id = uuid.safeParse(formData.get("connectionId"));
  if (!id.success) return fromZod(id.error);
  return run(() => respondToRequest(user, id.data, formData.get("accept") === "yes"));
}

export async function removeConnectionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await assertUser(["student"]);
  const id = uuid.safeParse(formData.get("connectionId"));
  if (!id.success) return fromZod(id.error);
  return run(() => removeConnection(user, id.data));
}

export async function dismissAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await assertUser(["student"]);
  const id = uuid.safeParse(formData.get("otherId"));
  if (!id.success) return fromZod(id.error);
  return run(() => dismissRecommendation(user, id.data));
}

export async function blockAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await assertUser(["student"]);
  const id = uuid.safeParse(formData.get("otherId"));
  if (!id.success) return fromZod(id.error);
  return run(() => blockStudent(user, id.data), "Blocked. They can no longer contact you or see you in suggestions.");
}

export async function unblockAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await assertUser(["student"]);
  const id = uuid.safeParse(formData.get("otherId"));
  if (!id.success) return fromZod(id.error);
  return run(() => unblockStudent(user, id.data));
}

export async function reportAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await assertUser(["student", "teacher"]);
  const parsed = reportSchema.safeParse({
    reportedId: formData.get("reportedId"),
    reason: formData.get("reason"),
    details: formData.get("details") ?? "",
    alsoBlock: formData.get("alsoBlock") === "on",
  });
  if (!parsed.success) return fromZod(parsed.error);
  return run(() => reportStudent(user, parsed.data), "Thank you. Your report was sent to the school's safeguarding staff.");
}

export async function joinGroupAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await assertUser(["student"]);
  const id = uuid.safeParse(formData.get("groupId"));
  if (!id.success) return fromZod(id.error);
  return run(() => joinGroup(user, id.data), "You joined the group.");
}

export async function leaveGroupAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await assertUser(["student"]);
  const id = uuid.safeParse(formData.get("groupId"));
  if (!id.success) return fromZod(id.error);
  return run(() => leaveGroup(user, id.data));
}

export async function inviteAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await assertUser(["student"]);
  const g = uuid.safeParse(formData.get("groupId"));
  const u = uuid.safeParse(formData.get("inviteeId"));
  if (!g.success || !u.success) return fromZod((g.success ? u : g).error!);
  return run(() => inviteToGroup(user, g.data, u.data), "Invitation sent.");
}

export async function createGroupAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await assertUser(["student"]);
  const parsed = groupSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") ?? "",
    subjectId: formData.get("subjectId") || null,
    meetingInfo: formData.get("meetingInfo") ?? "",
    maxMembers: formData.get("maxMembers") ?? 8,
    interestIds: formData.getAll("interests").map(String),
  });
  if (!parsed.success) return fromZod(parsed.error);
  return run(async () => {
    await createGroup(user, parsed.data);
  }, "Group created!");
}
