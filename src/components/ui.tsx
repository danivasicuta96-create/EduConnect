// Presentational building blocks shared by every portal. Server-component safe.
import Link from "next/link";
import clsx from "clsx";
import type { ComponentProps, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export { clsx as cx };

// ───────────── Buttons ─────────────

type Variant = "primary" | "secondary" | "soft" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const variantClass: Record<Variant, string> = {
  primary: "bg-brand-600 text-white hover:bg-brand-700 shadow-sm disabled:bg-brand-300",
  secondary: "bg-white text-ink-800 ring-1 ring-inset ring-ink-200 hover:bg-ink-50 disabled:text-ink-400",
  soft: "bg-brand-50 text-brand-700 hover:bg-brand-100 disabled:text-brand-300",
  ghost: "text-ink-700 hover:bg-ink-100 disabled:text-ink-400",
  danger: "bg-white text-brand-700 ring-1 ring-inset ring-brand-200 hover:bg-brand-50",
};
const sizeClass: Record<Size, string> = {
  sm: "h-8 px-3 text-sm gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-6 text-base gap-2",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", extra?: string) {
  return clsx(
    "inline-flex items-center justify-center rounded-xl font-semibold transition-colors disabled:cursor-not-allowed whitespace-nowrap",
    variantClass[variant],
    sizeClass[size],
    extra,
  );
}

export function Button({ variant, size, className, ...props }: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button type="button" className={buttonClass(variant, size, className)} {...props} />;
}

export function LinkButton({ variant, size, className, ...props }: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}

// ───────────── Layout ─────────────

export function Card({ className, children, as: As = "section", ...rest }: { className?: string; children: ReactNode; as?: "section" | "div" | "article" } & Omit<ComponentProps<"section">, "className" | "children" | "ref">) {
  return (
    <As className={clsx("rounded-2xl bg-white p-5 shadow-[var(--shadow-card)] ring-1 ring-ink-100", className)} {...rest}>
      {children}
    </As>
  );
}

export function CardHeader({ title, icon: Icon, action, subtitle }: { title: ReactNode; icon?: LucideIcon; action?: ReactNode; subtitle?: ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="flex items-start gap-2.5 min-w-0">
        {Icon && (
          <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600">
            <Icon className="size-4" aria-hidden />
          </span>
        )}
        <div className="min-w-0">
          <h2 className="text-base font-bold text-ink-900">{title}</h2>
          {subtitle && <p className="text-sm text-ink-500">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, description, actions, eyebrow }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="mb-1 text-sm font-semibold text-brand-600">{eyebrow}</p>}
        <h1 className="text-2xl font-extrabold tracking-tight text-ink-900 sm:text-3xl text-balance">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-ink-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function Grid({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={clsx("grid gap-4 sm:gap-5", className)}>{children}</div>;
}

// ───────────── Data display ─────────────

const tones = {
  neutral: "bg-ink-100 text-ink-700",
  brand: "bg-brand-50 text-brand-700",
  pink: "bg-blush-100 text-[#b0285a]",
  green: "bg-emerald-50 text-emerald-700",
  amber: "bg-amber-50 text-amber-800",
  red: "bg-red-50 text-red-700",
  blue: "bg-sky-50 text-sky-800",
  violet: "bg-violet-50 text-violet-700",
} as const;
export type Tone = keyof typeof tones;

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={clsx("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold", tones[tone], className)}>
      {children}
    </span>
  );
}

export function Stat({ label, value, hint, icon: Icon, tone = "brand" }: { label: string; value: ReactNode; hint?: ReactNode; icon?: LucideIcon; tone?: Tone }) {
  return (
    <Card className="flex items-start gap-3">
      {Icon && (
        <span className={clsx("grid size-10 shrink-0 place-items-center rounded-xl", tones[tone])}>
          <Icon className="size-5" aria-hidden />
        </span>
      )}
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink-500">{label}</p>
        <p className="text-2xl font-extrabold tracking-tight text-ink-900">{value}</p>
        {hint && <p className="mt-0.5 text-xs text-ink-500">{hint}</p>}
      </div>
    </Card>
  );
}

export function EmptyState({ icon: Icon, title, children, action }: { icon?: LucideIcon; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-ink-200 bg-white/60 px-6 py-10 text-center">
      {Icon && (
        <span className="mb-3 grid size-12 place-items-center rounded-2xl bg-blush-100 text-brand-600">
          <Icon className="size-6" aria-hidden />
        </span>
      )}
      <p className="font-bold text-ink-900">{title}</p>
      {children && <div className="mt-1 max-w-sm text-sm text-ink-500">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Notice({ tone = "blue", title, children, icon: Icon }: { tone?: Tone; title?: ReactNode; children: ReactNode; icon?: LucideIcon }) {
  return (
    <div className={clsx("flex gap-3 rounded-xl p-4 text-sm", tones[tone])} role="note">
      {Icon && <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />}
      <div className="min-w-0">
        {title && <p className="font-bold">{title}</p>}
        <div className="[&_a]:font-semibold [&_a]:underline">{children}</div>
      </div>
    </div>
  );
}

export function ProgressBar({ value, max = 100, label, tone = "brand" }: { value: number; max?: number; label: string; tone?: "brand" | "green" | "amber" }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const bar = { brand: "bg-brand-500", green: "bg-emerald-500", amber: "bg-amber-500" }[tone];
  return (
    <div role="progressbar" aria-label={label} aria-valuenow={Math.round(value * 10) / 10} aria-valuemin={0} aria-valuemax={max} className="h-2 w-full overflow-hidden rounded-full bg-ink-100">
      <div className={clsx("h-full rounded-full transition-all", bar)} style={{ width: `${pct}%` }} />
    </div>
  );
}

const avatarBg: Record<string, string> = {
  coral: "bg-brand-100 text-brand-700",
  pink: "bg-blush-200 text-[#9d2350]",
  rose: "bg-rose-100 text-rose-800",
  amber: "bg-amber-100 text-amber-800",
  teal: "bg-teal-100 text-teal-800",
  sky: "bg-sky-100 text-sky-800",
  violet: "bg-violet-100 text-violet-800",
  slate: "bg-ink-100 text-ink-700",
};

export function Avatar({ name, color = "coral", emoji, size = "md" }: { name: string; color?: string; emoji?: string | null; size?: "sm" | "md" | "lg" }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  const s = { sm: "size-8 text-xs", md: "size-10 text-sm", lg: "size-16 text-xl" }[size];
  return (
    <span aria-hidden className={clsx("grid shrink-0 place-items-center rounded-full font-bold", s, avatarBg[color] ?? avatarBg.coral)}>
      {emoji || initials}
    </span>
  );
}

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={clsx("-mx-5 overflow-x-auto px-5", className)}>
      <table className="w-full min-w-[480px] text-left text-sm">{children}</table>
    </div>
  );
}

export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return <th scope="col" className={clsx("border-b border-ink-100 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-ink-500 first:pl-0", className)}>{children}</th>;
}

export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={clsx("border-b border-ink-50 px-3 py-2.5 align-middle text-ink-800 first:pl-0", className)}>{children}</td>;
}

export function gradeTone(avg: number | null): Tone {
  if (avg === null) return "neutral";
  if (avg >= 9) return "green";
  if (avg >= 7) return "blue";
  if (avg >= 5) return "amber";
  return "red";
}

export function moodTone(mood: number | null): Tone {
  if (mood === null) return "neutral";
  if (mood >= 7) return "green";
  if (mood >= 5) return "amber";
  return "pink";
}

export function DemoBadge() {
  return <Badge tone="violet">Fictional demo data</Badge>;
}

export function Divider() {
  return <hr className="my-4 border-ink-100" />;
}
