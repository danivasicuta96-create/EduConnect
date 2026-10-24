export function PageSkeleton() {
  return (
    <div className="space-y-5" role="status" aria-live="polite" aria-label="Loading">
      <div className="h-9 w-64 max-w-full animate-pulse rounded-xl bg-ink-100" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-white ring-1 ring-ink-100" />
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="h-64 animate-pulse rounded-2xl bg-white ring-1 ring-ink-100 lg:col-span-2" />
        <div className="h-64 animate-pulse rounded-2xl bg-white ring-1 ring-ink-100" />
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
