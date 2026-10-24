export default function CounselorLoading() {
  return (
    <div className="space-y-5" role="status" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <div className="h-8 w-64 animate-pulse rounded-xl bg-ink-100" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-white ring-1 ring-ink-100" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-2xl bg-white ring-1 ring-ink-100" />
    </div>
  );
}
