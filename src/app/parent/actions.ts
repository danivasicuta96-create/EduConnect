"use server";

import { revalidatePath } from "next/cache";
import { assertUser } from "@/lib/auth/session";
import { formObject, fromError, fromZod, ok, type ActionState } from "@/lib/action-state";
import { guardianConsentSchema, setGuardianConsent } from "@/lib/services/parent";

export async function saveGuardianConsent(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await assertUser(["parent"]);
  const parsed = guardianConsentSchema.safeParse(formObject(formData));
  if (!parsed.success) return fromZod(parsed.error);
  try {
    const { recorded, activated } = await setGuardianConsent(user, parsed.data);
    revalidatePath("/parent");
    if (recorded === 0) return ok("No changes — your choices were already recorded.");
    return ok(`Saved ${recorded} choice${recorded === 1 ? "" : "s"}.${activated ? " Your child's account is now active." : ""}`);
  } catch (err) {
    return fromError(err);
  }
}
