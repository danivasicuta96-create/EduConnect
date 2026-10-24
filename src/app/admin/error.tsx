"use client";

import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui";

export default function AdminError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center rounded-2xl border border-dashed border-ink-200 bg-white/60 px-6 py-10 text-center">
      <span className="mb-3 grid size-12 place-items-center rounded-2xl bg-red-50 text-red-700">
        <TriangleAlert className="size-6" aria-hidden />
      </span>
      <p className="font-bold text-ink-900">This page couldn&apos;t be loaded</p>
      <p className="mt-1 max-w-sm text-sm text-ink-500">Something went wrong on our side. Your data is safe — please try again.</p>
      <Button className="mt-4" onClick={() => retry()}>Try again</Button>
    </div>
  );
}
