"use client";

import { useState } from "react";
import { KeyRound, Search } from "lucide-react";
import { ActionButton, ActionForm, Field, Input, Select, SubmitButton } from "@/components/forms";
import { Badge, Notice, buttonClass } from "@/components/ui";
import { PERMISSION_LABELS, ROLE_LABELS, type Role } from "@/lib/constants";
import { changeRole, inviteUser, togglePermission, toggleSuspend } from "./actions";

type Option = { id: string; label: string };

export function InviteForm({ classes, students }: { classes: Option[]; students: Option[] }) {
  const [role, setRole] = useState<Role>("teacher");
  return (
    <ActionForm action={inviteUser} resetOnSuccess>
      {(state) => (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Email" error={state.errors?.email}>
              {(id) => <Input id={id} name="email" type="email" required autoComplete="off" placeholder="name@school.ro" maxLength={200} />}
            </Field>
            <Field label="Role" error={state.errors?.role}>
              {(id) => (
                <Select id={id} name="role" value={role} onChange={(e) => setRole(e.target.value as Role)}>
                  {(["teacher", "counselor", "admin", "student", "parent"] as Role[]).map((r) => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </Select>
              )}
            </Field>
            {role === "student" && (
              <Field label="Class" hint="(optional)" error={state.errors?.classId}>
                {(id) => (
                  <Select id={id} name="classId" defaultValue="">
                    <option value="">No class yet</option>
                    {classes.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </Select>
                )}
              </Field>
            )}
            {role === "parent" && (
              <Field label="Linked student" hint="(optional)" error={state.errors?.studentId}>
                {(id) => (
                  <Select id={id} name="studentId" defaultValue="">
                    <option value="">Link later</option>
                    {students.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </Select>
                )}
              </Field>
            )}
          </div>
          {role === "parent" && (
            <p className="text-xs text-ink-500">
              Linking a parent doesn&apos;t share grades by itself: the student also needs <em>guardian access</em> consent, recorded on the Consent page.
            </p>
          )}
          {role === "counselor" && (
            <p className="text-xs text-ink-500">Counselors receive the default wellbeing and safeguarding permissions when they register.</p>
          )}
          <SubmitButton pendingText="Creating…">Create invitation</SubmitButton>
          {state.ok && typeof state.data?.code === "string" && (
            <Notice tone="green" icon={KeyRound} title={`Invitation code for ${String(state.data.email)}`}>
              <p>
                Code: <code className="select-all rounded bg-white px-2 py-0.5 text-base font-bold tracking-widest text-ink-900">{state.data.code}</code>
              </p>
              <p className="mt-1 break-all">
                Registration link: <a href={String(state.data.registerUrl)}>{String(state.data.registerUrl)}</a>
              </p>
              <p className="mt-1 text-xs">This code is shown only once and has been emailed to the invitee. It expires in 14 days.</p>
            </Notice>
          )}
        </div>
      )}
    </ActionForm>
  );
}

export function UserFilter({ role, q }: { role: string; q: string }) {
  return (
    <form method="get" className="flex flex-col gap-2 sm:flex-row sm:items-end" role="search">
      <div className="sm:w-48">
        <label htmlFor="filter-role" className="mb-1.5 block text-sm font-semibold text-ink-800">Role</label>
        <Select id="filter-role" name="role" defaultValue={role}>
          <option value="all">All roles</option>
          {(["student", "teacher", "counselor", "admin", "parent"] as Role[]).map((r) => (
            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
          ))}
        </Select>
      </div>
      <div className="flex-1">
        <label htmlFor="filter-q" className="mb-1.5 block text-sm font-semibold text-ink-800">Search</label>
        <Input id="filter-q" name="q" type="search" defaultValue={q} placeholder="Name or email" maxLength={80} />
      </div>
      <button type="submit" className={buttonClass("secondary")}><Search className="size-4" aria-hidden /> Filter</button>
    </form>
  );
}

export function ManageUser({
  userId, role, accountState, permissions, isSelf,
}: { userId: string; role: Role; accountState: string; permissions: string[]; isSelf: boolean }) {
  const staff = role === "teacher" || role === "counselor" || role === "admin";
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {staff && (
        <div>
          <h3 className="mb-2 text-sm font-bold text-ink-900">Permissions</h3>
          <ul className="space-y-2">
            {Object.entries(PERMISSION_LABELS).map(([perm, label]) => {
              const has = permissions.includes(perm);
              return (
                <li key={perm} className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2 ring-1 ring-ink-100">
                  <span className="min-w-0 text-sm">
                    <span className="block font-semibold text-ink-800">{label}</span>
                    <code className="text-[11px] text-ink-500">{perm}</code>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    {has ? <Badge tone="green">Granted</Badge> : <Badge>Off</Badge>}
                    <ActionButton
                      action={togglePermission}
                      hidden={{ userId, permission: perm, grant: has ? "false" : "true" }}
                      variant={has ? "danger" : "soft"}
                      confirm={!has && perm.startsWith("wellbeing.") ? "This gives access to sensitive wellbeing information. Grant it only to trained safeguarding staff. Continue?" : undefined}
                    >
                      {has ? "Revoke" : "Grant"}
                    </ActionButton>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      <div className="space-y-4">
        {staff && !isSelf && (
          <ActionForm action={changeRole}>
            {(state) => (
              <div>
                <input type="hidden" name="userId" value={userId} />
                <Field label="Change role" hint="(staff roles only — resets permissions)" error={state.errors?.role}>
                  {(id) => (
                    <div className="flex gap-2">
                      <Select id={id} name="role" defaultValue={role}>
                        {(["teacher", "counselor", "admin"] as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                      </Select>
                      <SubmitButton variant="secondary" pendingText="Saving…">Save</SubmitButton>
                    </div>
                  )}
                </Field>
              </div>
            )}
          </ActionForm>
        )}
        {!staff && (
          <p className="text-sm text-ink-600">
            {role === "student" ? "Student" : "Parent"} accounts can&apos;t be converted to another role.
            {role === "student" && <> Manage this student&apos;s consent on the <a className="font-semibold text-brand-700 underline" href={`/admin/consent?student=${userId}#record`}>Consent page</a>.</>}
          </p>
        )}
        {isSelf ? (
          <p className="text-sm text-ink-500">This is your own account. Another administrator must change your role or suspend it.</p>
        ) : (
          <div>
            <h3 className="mb-1 text-sm font-bold text-ink-900">Account access</h3>
            <p className="mb-2 text-sm text-ink-600">
              {accountState === "suspended"
                ? "This account is suspended and can't sign in."
                : "Suspending blocks sign-in immediately and ends every active session."}
            </p>
            <ActionButton
              action={toggleSuspend}
              hidden={{ userId, suspend: accountState === "suspended" ? "false" : "true" }}
              variant={accountState === "suspended" ? "soft" : "danger"}
              confirm={accountState === "suspended" ? undefined : "Suspend this account? The user will be signed out everywhere."}
            >
              {accountState === "suspended" ? "Reactivate account" : "Suspend account"}
            </ActionButton>
          </div>
        )}
      </div>
    </div>
  );
}
