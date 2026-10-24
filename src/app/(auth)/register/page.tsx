import Link from "next/link";
import type { Metadata } from "next";
import { redirectIfSignedIn } from "@/lib/auth/redirect";
import { RegisterForm } from "./form";

export const metadata: Metadata = { title: "Create your account" };

export default async function RegisterPage({ searchParams }: PageProps<"/register">) {
  await redirectIfSignedIn();
  const sp = await searchParams;
  const code = typeof sp.code === "string" ? sp.code : "";
  return (
    <div className="animate-fade-up">
      <h1 className="text-3xl font-extrabold tracking-tight">Join your school</h1>
      <p className="mt-1 text-ink-500">
        Use the <strong>invitation code</strong> from your school, or the <strong>school code</strong> your teacher shared (students only).
      </p>
      <div className="mt-6">
        <RegisterForm defaultCode={code} />
      </div>
      <p className="mt-6 text-center text-sm text-ink-500">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-brand-700 hover:underline">Sign in</Link>
      </p>
    </div>
  );
}
