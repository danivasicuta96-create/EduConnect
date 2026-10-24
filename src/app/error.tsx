"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";
import Link from "next/link";
import { CloudOff, RotateCcw } from "lucide-react";
import { Button, buttonClass } from "@/components/ui";

export default function ErrorBoundary({ error, retry }: { error: unknown; retry: () => void }) {
  const digest = error instanceof Error && "digest" in error && typeof error.digest === "string" ? error.digest : null;

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[70vh] w-full flex-1 items-center justify-center px-4 py-16">
      <div role="alert" className="w-full max-w-md animate-fade-up rounded-3xl bg-white p-8 text-center shadow-[var(--shadow-card)] ring-1 ring-ink-100 sm:p-10">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-blush-100 text-brand-600">
          <CloudOff className="size-7" aria-hidden />
        </span>
        <h1 className="mt-6 text-2xl font-extrabold tracking-tight text-ink-900 text-balance">Something went wrong on our side</h1>
        <p className="mt-3 text-ink-600">
          Sorry about that — it&apos;s not you. Try again in a moment. Anything you saved before this happened is safe.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Button onClick={() => retry()}>
            <RotateCcw className="size-4" aria-hidden /> Try again
          </Button>
          <Link href="/" className={buttonClass("secondary")}>Go to home</Link>
        </div>
        {digest && <p className="mt-6 text-xs text-ink-500">Reference: <code className="rounded bg-ink-50 px-1.5 py-0.5">{digest}</code></p>}
      </div>
    </div>
  );
}
