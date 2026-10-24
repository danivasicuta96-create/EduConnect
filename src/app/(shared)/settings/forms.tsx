"use client";

import { useActionState } from "react";
import { ActionForm, Field, FormMessage, Input, Select, SubmitButton } from "@/components/forms";
import { PASSWORD_RULES } from "@/lib/auth/password-rules";
import type { ActionState } from "@/lib/action-state";
import {
  consentAction, deleteWellbeingAction, localeAction, notificationPrefsAction, passwordAction, requestDeletionAction, signOutEverywhereAction,
} from "./actions";

export function ConsentToggle({ type, granted, canGrant }: { type: string; granted: boolean; canGrant: boolean }) {
  const [state, action] = useActionState(consentAction, { ok: false } as ActionState);
  return (
    <form action={action} className="flex flex-col items-start gap-1 sm:items-end">
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="granted" value={granted ? "no" : "yes"} />
      {granted ? (
        <SubmitButton size="sm" variant="secondary">Switch off</SubmitButton>
      ) : canGrant ? (
        <SubmitButton size="sm">Switch on</SubmitButton>
      ) : (
        <span className="text-xs text-ink-500">Needs guardian consent</span>
      )}
      {state.message && <span className={state.ok ? "text-xs text-emerald-700" : "text-xs text-red-700"} role="status">{state.message}</span>}
    </form>
  );
}

export function NotificationPrefsForm({ prefs, emailAvailable }: { prefs: Array<{ type: string; label: string; inApp: boolean; email: boolean; locked: boolean }>; emailAvailable: boolean }) {
  return (
    <ActionForm action={notificationPrefsAction}>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-ink-500">
            <th scope="col" className="pb-2 font-semibold">Type</th>
            <th scope="col" className="w-20 pb-2 text-center font-semibold">In app</th>
            <th scope="col" className="w-20 pb-2 text-center font-semibold">Email</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-50">
          {prefs.map((p) => (
            <tr key={p.type}>
              <td className="py-2.5 pr-2">{p.label}{p.locked && <span className="block text-xs text-ink-400">Always on for safety</span>}</td>
              <td className="text-center">
                {p.locked ? <input type="hidden" name={`inApp_${p.type}`} value="on" /> : null}
                <input type="checkbox" aria-label={`${p.label} in app`} name={`inApp_${p.type}`} defaultChecked={p.inApp || p.locked} disabled={p.locked} className="size-4 accent-brand-600" />
              </td>
              <td className="text-center">
                <input type="checkbox" aria-label={`${p.label} by email`} name={`email_${p.type}`} defaultChecked={p.email} disabled={!emailAvailable || p.type === "counselor_alert"} className="size-4 accent-brand-600" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <SubmitButton size="sm" className="mt-3">Save preferences</SubmitButton>
    </ActionForm>
  );
}

export function LocaleForm({ locale }: { locale: "en" | "ro" }) {
  return (
    <ActionForm action={localeAction} className="flex items-end gap-2">
      <div className="w-48">
        <Field label="Language">
          {(id) => (
            <Select id={id} name="locale" defaultValue={locale}>
              <option value="en">English</option>
              <option value="ro">Română</option>
            </Select>
          )}
        </Field>
      </div>
      <SubmitButton size="md" variant="secondary">Save</SubmitButton>
    </ActionForm>
  );
}

export function PasswordForm() {
  return (
    <ActionForm action={passwordAction} resetOnSuccess className="grid gap-3 sm:grid-cols-3">
      <Field label="Current password">{(id) => <Input id={id} name="current" type="password" autoComplete="current-password" required />}</Field>
      <Field label="New password">{(id) => <Input id={id} name="next" type="password" autoComplete="new-password" minLength={10} required />}</Field>
      <Field label="Confirm new password">{(id) => <Input id={id} name="confirm" type="password" autoComplete="new-password" minLength={10} required />}</Field>
      <p className="text-xs text-ink-500 sm:col-span-3">{PASSWORD_RULES}</p>
      <div className="sm:col-span-3"><SubmitButton size="sm">Change password</SubmitButton></div>
    </ActionForm>
  );
}

export function SignOutEverywhere() {
  return (
    <form action={signOutEverywhereAction}>
      <p className="mb-2 text-sm text-ink-600">Lost a device? End every active session, including this one.</p>
      <SubmitButton size="sm" variant="secondary">Sign out everywhere</SubmitButton>
    </form>
  );
}

export function DangerForm({ kind, title, description }: { kind: "wellbeing" | "account"; title: string; description: string }) {
  const [state, action] = useActionState(kind === "wellbeing" ? deleteWellbeingAction : requestDeletionAction, { ok: false } as ActionState);
  return (
    <form action={action} className="space-y-2">
      <p className="font-semibold text-ink-900">{title}</p>
      <p className="text-sm text-ink-600">{description}</p>
      <div className="flex flex-wrap items-end gap-2">
        <div className="w-44">
          <label htmlFor={`confirm-${kind}`} className="mb-1 block text-xs font-semibold text-ink-600">Type DELETE to confirm</label>
          <Input id={`confirm-${kind}`} name="confirm" autoComplete="off" />
        </div>
        <SubmitButton variant="danger" size="md">{kind === "wellbeing" ? "Delete history" : "Delete account"}</SubmitButton>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
