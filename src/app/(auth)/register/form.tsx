"use client";

import Link from "next/link";
import { ActionForm, Field, Input, SubmitButton } from "@/components/forms";
import { Notice } from "@/components/ui";
import { Info } from "lucide-react";
import { registerAction } from "../actions";
import { PASSWORD_RULES } from "@/lib/auth/password-rules";

export function RegisterForm({ defaultCode }: { defaultCode: string }) {
  const year = new Date().getFullYear();
  return (
    <ActionForm action={registerAction} className="space-y-4">
      {(state) => (
        <>
          <Field label="Invitation or school code" error={state.errors?.code}>
            {(id) => <Input id={id} name="code" defaultValue={defaultCode} required autoComplete="off" placeholder="e.g. AURORA-DEMO" className="uppercase" />}
          </Field>
          <Field label="Your name" hint="(or the name you'd like classmates to see)" error={state.errors?.displayName}>
            {(id) => <Input id={id} name="displayName" required autoComplete="name" maxLength={60} />}
          </Field>
          <Field label="Email" error={state.errors?.email}>
            {(id) => <Input id={id} name="email" type="email" required autoComplete="email" />}
          </Field>
          <Field label="Password" hint={`— ${PASSWORD_RULES}`} error={state.errors?.password}>
            {(id) => <Input id={id} name="password" type="password" required autoComplete="new-password" minLength={10} />}
          </Field>
          <Field label="Year of birth" hint="(students only)" error={state.errors?.birthYear}>
            {(id) => <Input id={id} name="birthYear" type="number" inputMode="numeric" min={year - 21} max={year - 10} placeholder={String(year - 15)} />}
          </Field>
          <Notice tone="blue" icon={Info}>
            Students under 16 can create an account, but wellbeing check-ins, matchmaking and AI features stay off until your school
            has recorded a parent or guardian&apos;s consent.
          </Notice>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" name="acceptTerms" required className="mt-0.5 size-4 accent-brand-600" />
            <span className="text-ink-700">
              I have read the <Link href="/privacy" className="font-semibold text-brand-700 underline" target="_blank">privacy notice</Link> and{" "}
              <Link href="/terms" className="font-semibold text-brand-700 underline" target="_blank">terms of use</Link>.
            </span>
          </label>
          {state.errors?.acceptTerms && <p className="text-sm text-red-700">{state.errors.acceptTerms[0]}</p>}
          <SubmitButton className="w-full" size="lg" pendingText="Creating account…">Create account</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
