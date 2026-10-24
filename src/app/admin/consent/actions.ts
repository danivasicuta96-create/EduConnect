"use server";

import { revalidatePath } from "next/cache";
import { assertUser } from "@/lib/auth/session";
import { formObject, fromError, fromZod, ok, type ActionState } from "@/lib/action-state";
import { recordConsent, recordConsentSchema } from "@/lib/services/admin";

export async function recordConsentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await assertUser(["admin"]);
  const parsed = recordConsentSchema.safeParse(formObject(formData));
  if (!parsed.success) return fromZod(parsed.error);
  try {
    const result = await recordConsent(user, parsed.data);
    revalidatePath("/admin/consent");
    revalidatePath("/admin");
    const suffix =
      result.accountChange === "activated"
        ? " The student's account is now active."
        : result.accountChange === "deactivated"
          ? " Platform consent was withdrawn, so the account is limited again until consent is recorded."
          : "";
    return ok(`Recorded ${result.recorded} consent decision${result.recorded === 1 ? "" : "s"}.${suffix}`);
  } catch (err) {
    return fromError(err);
  }
}
