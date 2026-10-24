"use client";

import { ActionForm, Field, Input, SubmitButton } from "@/components/forms";
import { requestResetAction } from "../actions";

export function ForgotForm() {
  return (
    <ActionForm action={requestResetAction} className="space-y-4">
      <Field label="Email">{(id) => <Input id={id} name="email" type="email" required autoComplete="email" />}</Field>
      <SubmitButton className="w-full" size="lg" pendingText="Sending…">Send reset link</SubmitButton>
    </ActionForm>
  );
}
