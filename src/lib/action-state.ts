import type { z } from "zod";
import { unstable_rethrow } from "next/navigation";

/** Shape returned by every form-bound server action. */
export interface ActionState {
  ok: boolean;
  message?: string;
  errors?: Record<string, string[]>;
  data?: Record<string, unknown>;
}

export function fail(message: string, errors?: Record<string, string[]>): ActionState {
  return { ok: false, message, errors };
}

export function ok(message?: string, data?: Record<string, unknown>): ActionState {
  return { ok: true, message, data };
}

export function fromZod(error: z.ZodError): ActionState {
  const errors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    (errors[key] ??= []).push(issue.message);
  }
  const first = error.issues[0];
  return { ok: false, message: first ? first.message : "Please check the form.", errors };
}

/** Turn thrown errors into a safe message; never leak internals to the client. */
export function fromError(err: unknown): ActionState {
  unstable_rethrow(err); // let redirect()/notFound() propagate
  if (err instanceof Error && (err.name === "AuthorizationError" || err.name === "UserFacingError")) {
    return fail(err.message);
  }
  // MongoDB duplicate key (unique index) and validation errors.
  const code = (err as { code?: number | string })?.code;
  if (code === 11000) return fail("That already exists.");
  if (code === 121) return fail("Some values are not valid.");
  console.error("[action error]", err);
  return fail("Something went wrong. Please try again.");
}

export class UserFacingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserFacingError";
  }
}

/** Read all values of a multi-value field (checkbox groups). */
export function formList(formData: FormData, name: string): string[] {
  return formData.getAll(name).map(String).filter(Boolean);
}

export function formObject(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of formData.entries()) if (!k.startsWith("$ACTION")) out[k] = String(v);
  return out;
}
