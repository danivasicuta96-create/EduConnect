"use client";

import Link from "next/link";
import { useActionState } from "react";
import { ActionForm, Field, Input, SubmitButton, FormMessage } from "@/components/forms";
import { Avatar } from "@/components/ui";
import { demoLoginAction, loginAction } from "../actions";
import { ROLE_LABELS, type Role } from "@/lib/constants";
import type { ActionState } from "@/lib/action-state";

export function LoginForm() {
  return (
    <ActionForm action={loginAction} className="space-y-4">
      {(state) => (
        <>
          <Field label="Email" error={state.errors?.email}>
            {(id) => <Input id={id} name="email" type="email" autoComplete="email" required placeholder="you@school.ro" />}
          </Field>
          <Field label="Password" error={state.errors?.password}>
            {(id) => <Input id={id} name="password" type="password" autoComplete="current-password" required />}
          </Field>
          <div className="flex justify-end">
            <Link href="/forgot-password" className="text-sm font-semibold text-brand-700 hover:underline">Forgot password?</Link>
          </div>
          <SubmitButton className="w-full" size="lg" pendingText="Signing in…">Sign in</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

const roleHint: Record<Role, string> = {
  student: "Dashboard, matchmaking, check-ins, AI tutor",
  teacher: "Gradebook, attendance, class analytics",
  counselor: "Alert queue, follow-ups, aggregate reports",
  admin: "Users, consent, audit logs, subscription",
  parent: "Linked child's grades & attendance",
};

export function DemoAccounts({ accounts }: { accounts: Array<{ email: string; display_name: string; role: Role; grade_level: number | null; avatar_color: string }> }) {
  const [state, action] = useActionState(demoLoginAction, { ok: false } as ActionState);
  return (
    <section aria-labelledby="demo-title" className="mt-10 rounded-2xl bg-blush-50 p-5 ring-1 ring-blush-200">
      <h2 id="demo-title" className="font-bold text-ink-900">Explore the demo</h2>
      <p className="mt-1 text-sm text-ink-600">
        One-click sign-in to a <strong>fictional</strong> school. Every person and record is invented. Demo sign-in is disabled when <code className="rounded bg-white px-1">DEMO_MODE=false</code>.
      </p>
      <form action={action} className="mt-4 grid gap-2">
        {accounts.map((a) => (
          <button
            key={a.email}
            type="submit"
            name="email"
            value={a.email}
            className="flex items-center gap-3 rounded-xl bg-white p-3 text-left ring-1 ring-ink-100 transition hover:ring-brand-300 focus-visible:ring-brand-500"
          >
            <Avatar name={a.display_name} color={a.avatar_color} size="sm" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-ink-900">
                {a.display_name} <span className="font-medium text-ink-500">· {ROLE_LABELS[a.role]}{a.grade_level ? `, grade ${a.grade_level}` : ""}</span>
              </span>
              <span className="block truncate text-xs text-ink-500">
                {a.display_name === "Sara Oprea" ? "New student awaiting guardian consent" : roleHint[a.role]}
              </span>
            </span>
          </button>
        ))}
      </form>
      <div className="mt-2"><FormMessage state={state} /></div>
    </section>
  );
}
