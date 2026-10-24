"use server";

import { revalidatePath } from "next/cache";
import { assertUser } from "@/lib/auth/session";
import { formObject, fromError, fromZod, ok, type ActionState } from "@/lib/action-state";
import { changeSubscription, subscriptionSchema } from "@/lib/services/admin";

export async function changeSubscriptionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await assertUser(["admin"]);
  const parsed = subscriptionSchema.safeParse(formObject(formData));
  if (!parsed.success) return fromZod(parsed.error);
  try {
    const { draftId } = await changeSubscription(user, parsed.data);
    revalidatePath("/admin/subscription");
    revalidatePath("/admin");
    return ok(
      draftId
        ? "Subscription updated. A draft billing record documents the change — no payment was taken (payment processing isn't configured)."
        : "Subscription details updated.",
    );
  } catch (err) {
    return fromError(err);
  }
}
