import type { Metadata } from "next";
import Link from "next/link";
import { Compass } from "lucide-react";
import { Logo } from "@/components/shell/app-shell";
import { LinkButton } from "@/components/ui";

export const metadata: Metadata = {
  title: "Page not found",
  description: "The page you were looking for doesn't exist or has moved.",
};

export default function NotFound() {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-gradient-to-b from-blush-50 to-white">
      <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full bg-brand-100/70 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-24 -left-24 size-72 rounded-full bg-blush-200/60 blur-3xl" />
      <header className="relative px-4 py-5 sm:px-8">
        <Link href="/" className="inline-flex rounded-lg" aria-label="EduConnect AI — home"><Logo /></Link>
      </header>
      <main id="main" className="relative flex flex-1 items-center justify-center px-4 pb-16">
        <div className="w-full max-w-md animate-fade-up rounded-3xl bg-white p-8 text-center shadow-[var(--shadow-card)] ring-1 ring-ink-100 sm:p-10">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-brand-gradient text-white shadow-[var(--shadow-pop)]">
            <Compass className="size-7" aria-hidden />
          </span>
          <p className="mt-6 text-sm font-bold uppercase tracking-wider text-brand-600">Error 404</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-ink-900 text-balance">This page took a wrong turn</h1>
          <p className="mt-3 text-ink-600">
            We couldn&apos;t find what you were looking for. It may have moved, or the link might be mistyped.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <LinkButton href="/">Back to home</LinkButton>
            <LinkButton href="/login" variant="secondary">Sign in</LinkButton>
          </div>
        </div>
      </main>
    </div>
  );
}
