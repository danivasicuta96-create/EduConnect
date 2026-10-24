import Link from "next/link";
import type { Metadata } from "next";
import { ForgotForm } from "./form";

export const metadata: Metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return (
    <div className="animate-fade-up">
      <h1 className="text-3xl font-extrabold tracking-tight">Forgot your password?</h1>
      <p className="mt-1 text-ink-500">Enter your email and we&apos;ll send you a link to choose a new one.</p>
      <div className="mt-6">
        <ForgotForm />
      </div>
      <p className="mt-6 text-center text-sm">
        <Link href="/login" className="font-semibold text-brand-700 hover:underline">Back to sign in</Link>
      </p>
    </div>
  );
}
