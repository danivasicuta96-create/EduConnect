"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertUser } from "@/lib/auth/session";
import { fromError, fromZod, ok, formObject, type ActionState } from "@/lib/action-state";
import { assertPermission } from "@/lib/services/actor";
import { PERMS, reevaluateAllStudents, ruleSchema, saveRule, setRuleEnabled } from "@/lib/services/counselor";

async function rulesUser() {
  const user = await assertUser(["counselor"]);
  assertPermission(user, PERMS.rules);
  return user;
}

export async function saveRuleAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await rulesUser();
    const raw = formObject(formData);
    const parsed = ruleSchema.safeParse({
      id: raw.id || undefined,
      name: raw.name ?? "",
      kind: raw.kind,
      windowDays: raw.windowDays ?? "",
      threshold: raw.threshold ?? "",
      consecutiveCount: raw.consecutiveCount ?? "",
      minCheckins: raw.minCheckins ?? "",
      severity: raw.severity,
      enabled: raw.enabled === "on",
    });
    if (!parsed.success) return fromZod(parsed.error);
    const { created } = await saveRule(user, parsed.data);
    revalidatePath("/counselor/rules");
    return ok(created ? "Rule created." : "Rule saved.");
  } catch (err) {
    return fromError(err);
  }
}

const toggleSchema = z.object({ ruleId: z.uuid(), enabled: z.enum(["true", "false"]) });

export async function toggleRuleAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await rulesUser();
    const parsed = toggleSchema.safeParse({ ruleId: formData.get("ruleId"), enabled: formData.get("enabled") });
    if (!parsed.success) return fromZod(parsed.error);
    await setRuleEnabled(user, parsed.data.ruleId, parsed.data.enabled === "true");
    revalidatePath("/counselor/rules");
    return ok(parsed.data.enabled === "true" ? "Rule enabled." : "Rule disabled.");
  } catch (err) {
    return fromError(err);
  }
}

export async function reevaluateAction(): Promise<ActionState> {
  try {
    const user = await rulesUser();
    const r = await reevaluateAllStudents(user);
    revalidatePath("/counselor/rules");
    revalidatePath("/counselor/alerts");
    revalidatePath("/counselor");
    const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
    return ok(
      `Checked ${plural(r.students, "student")}: ${plural(r.created, "new alert")} created, ${plural(r.escalated, "alert")} escalated. Existing alerts were not duplicated.`,
      r,
    );
  } catch (err) {
    return fromError(err);
  }
}
