import Link from "next/link";
import type { Metadata } from "next";
import { Notice } from "@/components/ui";
import { ResetForm } from "./form";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  const sp = await searchParams;
  const token = typeof sp.token === "string" ? sp.token : "";
  return (
    <div className="animate-fade-up">
      <h1 className="text-3xl font-extrabold tracking-tight">Choose a new password</h1>
      {token ? (
        <div className="mt-6">
          <ResetForm token={token} />
        </div>
      ) : (
        <div className="mt-6">
          <Notice tone="amber">This page needs the link from your reset email. <Link href="/forgot-password">Request a new link</Link>.</Notice>
        </div>
      )}
    </div>
  );
}
