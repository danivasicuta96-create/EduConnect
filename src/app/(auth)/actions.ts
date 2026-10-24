"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSession, destroySession } from "@/lib/auth/session";
import { authenticate, completePasswordReset, createPasswordReset, demoUserId, registerAccount, registerSchema } from "@/lib/services/auth";
import { fail, fromError, fromZod, ok, type ActionState } from "@/lib/action-state";
import { LIMITS, rateLimit } from "@/lib/rate-limit";
import { clientIp, demoModeEnabled } from "@/lib/request";
import { appUrl, sendEmail } from "@/lib/email";
import { ROLE_HOME } from "@/lib/constants";
import { loadUser } from "@/lib/auth/session";

async function goHome(userId: string): Promise<never> {
  const user = await loadUser(userId);
  if (!user) redirect("/login");
  redirect(user.onboarded ? ROLE_HOME[user.role] : "/onboarding");
}

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return fromZod(parsed.error);
  const ip = await clientIp();
  const limit = rateLimit(`login:${ip}:${parsed.data.email}`, LIMITS.login.limit, LIMITS.login.windowMs);
  if (!limit.ok) return fail(`Too many sign-in attempts. Try again in ${Math.ceil(limit.retryAfterSeconds / 60)} minutes.`);
  const result = await authenticate(parsed.data.email, parsed.data.password);
  if ("error" in result) return fail(result.error);
  await createSession(result.userId);
  return goHome(result.userId);
}

export async function demoLoginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!demoModeEnabled()) return fail("Demo mode is disabled on this deployment.");
  const ip = await clientIp();
  if (!rateLimit(`demo:${ip}`, 60, 15 * 60_000).ok) return fail("Too many demo sign-ins. Please wait a few minutes.");
  const userId = await demoUserId(String(formData.get("email") ?? ""));
  if (!userId) return fail("That demo account doesn't exist.");
  await createSession(userId);
  return goHome(userId);
}

export async function registerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ip = await clientIp();
  if (!rateLimit(`register:${ip}`, LIMITS.register.limit, LIMITS.register.windowMs).ok) {
    return fail("Too many registrations from this network. Please try again later.");
  }
  const parsed = registerSchema.safeParse({
    displayName: formData.get("displayName"),
    email: formData.get("email"),
    password: formData.get("password"),
    code: formData.get("code"),
    birthYear: formData.get("birthYear") || undefined,
    acceptTerms: formData.get("acceptTerms"),
  });
  if (!parsed.success) return fromZod(parsed.error);
  let userId: string;
  try {
    userId = (await registerAccount(parsed.data)).userId;
  } catch (err) {
    return fromError(err);
  }
  await createSession(userId);
  redirect("/onboarding");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}

export async function requestResetAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!z.string().email().safeParse(email).success) return fail("Enter a valid email address.");
  const ip = await clientIp();
  if (!rateLimit(`reset:${ip}`, LIMITS.passwordReset.limit, LIMITS.passwordReset.windowMs).ok) {
    return fail("Too many requests. Please try again later.");
  }
  const reset = await createPasswordReset(email);
  if (reset) {
    await sendEmail({
      to: reset.email,
      subject: "Reset your EduConnect AI password",
      text: `Someone asked to reset the password for this account.\n\nOpen this link within 30 minutes to choose a new password:\n${appUrl(`/reset-password?token=${encodeURIComponent(reset.token)}`)}\n\nIf this wasn't you, you can ignore this email.`,
    });
  }
  return ok("If an account exists for that address, we've sent a reset link. It expires in 30 minutes.");
}

export async function resetPasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  if (password !== String(formData.get("confirm") ?? "")) return fail("The passwords don't match.");
  try {
    await completePasswordReset(token, password);
  } catch (err) {
    return fromError(err);
  }
  redirect("/login?reset=1");
}
