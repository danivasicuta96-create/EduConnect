"use client";

import { ActionForm, Field, Input, SubmitButton } from "@/components/forms";
import { PASSWORD_RULES } from "@/lib/auth/password-rules";
import { resetPasswordAction } from "../actions";

export function ResetForm({ token }: { token: string }) {
  return (
    <ActionForm action={resetPasswordAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <Field label="New password" hint={`— ${PASSWORD_RULES}`}>
        {(id) => <Input id={id} name="password" type="password" required minLength={10} autoComplete="new-password" />}
      </Field>
      <Field label="Confirm new password">
        {(id) => <Input id={id} name="confirm" type="password" required minLength={10} autoComplete="new-password" />}
      </Field>
      <SubmitButton className="w-full" size="lg" pendingText="Saving…">Save new password</SubmitButton>
    </ActionForm>
  );
}
