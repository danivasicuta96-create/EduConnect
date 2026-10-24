"use client";

import { useActionState, useEffect, useId, useRef, type ComponentProps, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import clsx from "clsx";
import { LoaderCircle, CircleCheck, TriangleAlert } from "lucide-react";
import { buttonClass } from "./ui";
import type { ActionState } from "@/lib/action-state";

export const inputClass =
  "block w-full rounded-xl border-0 bg-white px-3.5 py-2.5 text-sm text-ink-900 ring-1 ring-inset ring-ink-200 placeholder:text-ink-400 focus:ring-2 focus:ring-brand-500 focus:outline-none disabled:bg-ink-50 aria-[invalid=true]:ring-red-400";

export function Label({ children, htmlFor, hint }: { children: ReactNode; htmlFor?: string; hint?: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-semibold text-ink-800">
      {children}
      {hint && <span className="ml-1 font-normal text-ink-500">{hint}</span>}
    </label>
  );
}

export function Field({ label, hint, error, children, id }: { label: ReactNode; hint?: ReactNode; error?: string[] | string; children: (id: string) => ReactNode; id?: string }) {
  const auto = useId();
  const fid = id ?? auto;
  const msg = Array.isArray(error) ? error[0] : error;
  return (
    <div>
      <Label htmlFor={fid} hint={hint}>{label}</Label>
      {children(fid)}
      {msg && <p className="mt-1 text-sm text-red-700" id={`${fid}-error`}>{msg}</p>}
    </div>
  );
}

export function Input(props: ComponentProps<"input">) {
  return <input {...props} className={clsx(inputClass, props.className)} />;
}

export function Textarea(props: ComponentProps<"textarea">) {
  return <textarea rows={3} {...props} className={clsx(inputClass, "resize-y", props.className)} />;
}

export function Select(props: ComponentProps<"select">) {
  return <select {...props} className={clsx(inputClass, "pr-8", props.className)} />;
}

export function SubmitButton({ children, pendingText, variant = "primary", size = "md", className, ...rest }: { children: ReactNode; pendingText?: string; variant?: "primary" | "secondary" | "soft" | "ghost" | "danger"; size?: "sm" | "md" | "lg"; className?: string } & Omit<ComponentProps<"button">, "type" | "children" | "className">) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending || rest.disabled} aria-busy={pending} className={buttonClass(variant, size, className)} {...rest}>
      {pending && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
      {pending && pendingText ? pendingText : children}
    </button>
  );
}

export function FormMessage({ state }: { state: ActionState | null | undefined }) {
  if (!state?.message) return null;
  return (
    <p role={state.ok ? "status" : "alert"} className={clsx("flex items-start gap-2 rounded-xl px-3 py-2 text-sm", state.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800")}>
      {state.ok ? <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden /> : <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />}
      <span>{state.message}</span>
    </p>
  );
}

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

/**
 * A form bound to a server action that returns ActionState. Shows pending,
 * success and error states, and optionally resets after success.
 */
export function ActionForm({ action, children, className, resetOnSuccess = false, hideMessage = false }: { action: Action; children: ReactNode | ((state: ActionState) => ReactNode); className?: string; resetOnSuccess?: boolean; hideMessage?: boolean }) {
  const [state, formAction] = useActionState(action, { ok: false } as ActionState);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (resetOnSuccess && state.ok) ref.current?.reset();
  }, [state, resetOnSuccess]);
  return (
    <form ref={ref} action={formAction} className={className} noValidate={false}>
      {typeof children === "function" ? children(state) : children}
      {!hideMessage && (
        <div className="mt-3 empty:hidden">
          <FormMessage state={state} />
        </div>
      )}
    </form>
  );
}

/** A single-button form for one-click actions (accept, dismiss, mark read…). */
export function ActionButton({ action, children, variant = "secondary", size = "sm", hidden, confirm, className, title }: { action: Action; children: ReactNode; variant?: "primary" | "secondary" | "soft" | "ghost" | "danger"; size?: "sm" | "md" | "lg"; hidden?: Record<string, string>; confirm?: string; className?: string; title?: string }) {
  const [state, formAction] = useActionState(action, { ok: false } as ActionState);
  return (
    <form
      action={formAction}
      className="inline-flex flex-col items-start"
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {hidden && Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <SubmitButton variant={variant} size={size} className={className} title={title}>{children}</SubmitButton>
      {!state.ok && state.message && <span role="alert" className="mt-1 text-xs text-red-700">{state.message}</span>}
    </form>
  );
}

export function Checkbox({ label, description, ...props }: { label: ReactNode; description?: ReactNode } & ComponentProps<"input">) {
  const id = useId();
  return (
    <div className="flex items-start gap-3">
      <input id={id} type="checkbox" {...props} className="mt-0.5 size-4 rounded border-ink-300 accent-brand-600" />
      <label htmlFor={id} className="text-sm">
        <span className="font-semibold text-ink-800">{label}</span>
        {description && <span className="block text-ink-500">{description}</span>}
      </label>
    </div>
  );
}

/** Toggleable pill chips backed by checkboxes (for interests, factors, goals). */
export function ChipGroup({ name, options, defaultValue = [], legend, max }: { name: string; options: Array<{ value: string; label: string }>; defaultValue?: string[]; legend: string; max?: number }) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold text-ink-800">
        {legend}
        {max && <span className="ml-1 font-normal text-ink-500">(up to {max})</span>}
      </legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <label key={o.value} className="cursor-pointer">
            <input type="checkbox" name={name} value={o.value} defaultChecked={defaultValue.includes(o.value)} className="peer sr-only" />
            <span className="inline-flex items-center rounded-full bg-white px-3 py-1.5 text-sm font-medium text-ink-700 ring-1 ring-ink-200 transition peer-checked:bg-brand-600 peer-checked:text-white peer-checked:ring-brand-600 peer-focus-visible:outline peer-focus-visible:outline-3 peer-focus-visible:outline-brand-500 hover:ring-brand-300">
              {o.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
