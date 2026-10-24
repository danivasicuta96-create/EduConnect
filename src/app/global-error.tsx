"use client"; // Error boundaries must be Client Components

// Replaces the root layout when it fails, so it renders its own <html>/<body>
// and imports the global styles itself. Kept dependency-light on purpose.
import { useEffect } from "react";
import "./globals.css";

export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen bg-ink-50 font-[ui-sans-serif,system-ui,-apple-system,'Segoe_UI',sans-serif] antialiased">
        <title>Something went wrong · EduConnect AI</title>
        <main id="main" className="flex min-h-screen items-center justify-center px-4 py-16">
          <div role="alert" className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-[var(--shadow-card)] ring-1 ring-ink-100 sm:p-10">
            <span aria-hidden className="mx-auto grid size-14 place-items-center rounded-2xl bg-brand-gradient text-2xl font-extrabold text-white shadow-[var(--shadow-pop)]">
              !
            </span>
            <p className="mt-6 text-sm font-bold tracking-tight text-ink-900">
              EduConnect <span className="text-brand-600">AI</span>
            </p>
            <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-ink-900">We hit an unexpected problem</h1>
            <p className="mt-3 text-ink-600">The app couldn&apos;t load. Please try again — if it keeps happening, let your school know.</p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => retry()}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
              >
                Try again
              </button>
              {/* Plain anchor: a full reload is the most reliable recovery when the root layout failed. */}
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a href="/" className="inline-flex h-10 items-center justify-center rounded-xl bg-white px-4 text-sm font-semibold text-ink-800 ring-1 ring-inset ring-ink-200 hover:bg-ink-50">
                Go to home
              </a>
            </div>
            <p className="mt-6 text-xs text-ink-500">In an emergency in Romania call 112, or 116 111 for the free child helpline.</p>
          </div>
        </main>
      </body>
    </html>
  );
}
