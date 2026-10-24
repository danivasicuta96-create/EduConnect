"use server";

import { revalidatePath } from "next/cache";
import { assertUser } from "@/lib/auth/session";
import { fromError, fromZod, ok, type ActionState } from "@/lib/action-state";
import { assertPermission } from "@/lib/services/actor";
import { PERMS, REPORT_STATUS_LABELS, reportStatusSchema, setSafetyReportStatus } from "@/lib/services/counselor";

export async function setReportStatusAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await assertUser(["counselor"]);
    assertPermission(user, PERMS.reports);
    const parsed = reportStatusSchema.safeParse({ reportId: formData.get("reportId"), status: formData.get("status") });
    if (!parsed.success) return fromZod(parsed.error);
    await setSafetyReportStatus(user, parsed.data);
    revalidatePath("/counselor/safeguarding");
    return ok(`Marked as "${REPORT_STATUS_LABELS[parsed.data.status]}".`);
  } catch (err) {
    return fromError(err);
  }
}
