// Presentational building blocks for the public marketing/legal pages. Server-component safe.
import type { ReactNode } from "react";
import { Phone, ShieldAlert, type LucideIcon } from "lucide-react";
import { cx } from "@/components/ui";

export function Container({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx("mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8", className)}>{children}</div>;
}

export function Section({ id, className, children, labelledBy }: { id?: string; className?: string; children: ReactNode; labelledBy?: string }) {
  return (
    <section id={id} aria-labelledby={labelledBy} className={cx("scroll-mt-20 py-16 sm:py-20", className)}>
      <Container>{children}</Container>
    </section>
  );
}

export function SectionHeading({ id, eyebrow, title, children, center }: { id?: string; eyebrow?: string; title: ReactNode; children?: ReactNode; center?: boolean }) {
  return (
    <div className={cx("mb-10 max-w-2xl", center && "mx-auto text-center")}>
      {eyebrow && <p className="mb-2 text-sm font-bold uppercase tracking-wider text-brand-600">{eyebrow}</p>}
      <h2 id={id} className="text-3xl font-extrabold tracking-tight text-ink-900 text-balance sm:text-4xl">{title}</h2>
      {children && <p className="mt-3 text-lg text-ink-600">{children}</p>}
    </div>
  );
}

/** Hero band used on inner pages (features, about, legal). */
export function PageHero({ eyebrow, title, children, aside }: { eyebrow: string; title: ReactNode; children?: ReactNode; aside?: ReactNode }) {
  return (
    <div className="relative overflow-hidden border-b border-blush-100 bg-gradient-to-b from-blush-50 to-white">
      <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-brand-100/60 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -left-20 top-20 size-56 rounded-full bg-blush-200/50 blur-3xl" />
      <Container className="relative py-14 sm:py-20">
        <p className="mb-3 text-sm font-bold uppercase tracking-wider text-brand-600">{eyebrow}</p>
        <h1 className="max-w-3xl text-4xl font-extrabold tracking-tight text-ink-900 text-balance sm:text-5xl">{title}</h1>
        {children && <div className="mt-4 max-w-2xl text-lg text-ink-600">{children}</div>}
        {aside && <div className="mt-6">{aside}</div>}
      </Container>
    </div>
  );
}

export function IconTile({ icon: Icon, tone = "brand", className }: { icon: LucideIcon; tone?: "brand" | "pink" | "ink"; className?: string }) {
  const t = { brand: "bg-brand-50 text-brand-600", pink: "bg-blush-100 text-[#b0285a]", ink: "bg-ink-100 text-ink-700" }[tone];
  return (
    <span className={cx("grid size-11 shrink-0 place-items-center rounded-2xl", t, className)}>
      <Icon className="size-5" aria-hidden />
    </span>
  );
}

export const EMERGENCY_NUMBERS = [
  { number: "112", short: "emergency", label: "Emergency (police, ambulance, fire)" },
  { number: "116 111", short: "Telefonul Copilului", label: "Telefonul Copilului — free, confidential child helpline" },
  { number: "119", short: "child abuse reporting", label: "Reporting child abuse or neglect" },
] as const;

/** Prominent safety card with the Romanian emergency numbers. */
export function EmergencyCard({ className }: { className?: string }) {
  return (
    <div className={cx("rounded-3xl bg-ink-900 p-6 text-white sm:p-8", className)}>
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white/10 text-brand-300">
          <ShieldAlert className="size-5" aria-hidden />
        </span>
        <div>
          <h3 className="text-xl font-bold">If you are in danger right now</h3>
          <p className="mt-1 text-ink-200">EduConnect is not an emergency service. Call for help — it is free.</p>
        </div>
      </div>
      <ul className="mt-6 grid gap-3 sm:grid-cols-3">
        {EMERGENCY_NUMBERS.map((n) => (
          <li key={n.number}>
            <a
              href={`tel:${n.number.replace(/\s/g, "")}`}
              className="flex h-full flex-col rounded-2xl bg-white/[0.07] p-4 ring-1 ring-white/10 transition-colors hover:bg-white/[0.12]"
            >
              <span className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
                <Phone className="size-4 text-brand-300" aria-hidden />
                {n.number}
              </span>
              <span className="mt-1 text-sm text-ink-200">{n.label}</span>
            </a>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs text-ink-300">Numbers listed for Romania. Each school should verify and add its own local support contacts.</p>
    </div>
  );
}

/** Typographic wrapper for long-form legal/explanatory content. */
export function Prose({ children }: { children: ReactNode }) {
  return (
    <div
      className={cx(
        "max-w-3xl text-ink-700 leading-relaxed",
        "[&_h2]:mt-12 [&_h2]:scroll-mt-24 [&_h2]:text-2xl [&_h2]:font-extrabold [&_h2]:tracking-tight [&_h2]:text-ink-900",
        "[&_h3]:mt-6 [&_h3]:text-lg [&_h3]:font-bold [&_h3]:text-ink-900",
        "[&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5 [&_ol]:mt-3 [&_ol]:list-decimal [&_ol]:space-y-1.5 [&_ol]:pl-5",
        "[&_strong]:font-semibold [&_strong]:text-ink-900 [&_a]:font-semibold [&_a]:text-brand-700 [&_a]:underline [&_a]:underline-offset-2",
      )}
    >
      {children}
    </div>
  );
}

/** "On this page" list for legal docs. */
export function Toc({ items }: { items: { id: string; label: string }[] }) {
  return (
    <nav aria-label="On this page" className="rounded-2xl bg-white p-5 shadow-[var(--shadow-card)] ring-1 ring-ink-100">
      <p className="mb-3 text-xs font-bold uppercase tracking-wider text-ink-500">On this page</p>
      <ol className="space-y-1.5 text-sm">
        {items.map((i, n) => (
          <li key={i.id}>
            <a href={`#${i.id}`} className="flex gap-2 rounded-md text-ink-700 hover:text-brand-700">
              <span className="w-5 shrink-0 text-ink-400 tabular-nums">{n + 1}.</span>
              <span>{i.label}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
