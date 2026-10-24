import Link from "next/link";
import type { Metadata } from "next";
import { redirectIfSignedIn } from "@/lib/auth/redirect";
import { demoModeEnabled } from "@/lib/request";
import { listDemoAccounts } from "@/lib/services/auth";
import { Notice } from "@/components/ui";
import { LoginForm, DemoAccounts } from "./forms";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  await redirectIfSignedIn();
  const sp = await searchParams;
  const demo = demoModeEnabled() ? await listDemoAccounts() : [];
  return (
    <div className="animate-fade-up">
      <h1 className="text-3xl font-extrabold tracking-tight">Welcome back</h1>
      <p className="mt-1 text-ink-500">Sign in to your school account.</p>
      {sp.reset && (
        <div className="mt-4">
          <Notice tone="green">Your password was changed. Please sign in with the new password.</Notice>
        </div>
      )}
      <div className="mt-6">
        <LoginForm />
      </div>
      <p className="mt-6 text-center text-sm text-ink-500">
        New here?{" "}
        <Link href="/register" className="font-semibold text-brand-700 hover:underline">Join with a school or invitation code</Link>
      </p>
      {demo.length > 0 && <DemoAccounts accounts={demo} />}
    </div>
  );
}
