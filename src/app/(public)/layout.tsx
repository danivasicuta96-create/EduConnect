import Link from "next/link";
import { Logo } from "@/components/shell/app-shell";
import { LinkButton } from "@/components/ui";
import { MobileMenu } from "./_components/mobile-menu";
import { PUBLIC_NAV } from "./_components/nav";
import { Container, EMERGENCY_NUMBERS } from "./_components/blocks";

export default function PublicLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="sticky top-0 z-40 border-b border-ink-100/80 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/75">
        <Container className="relative flex h-16 items-center justify-between gap-4">
          <Link href="/" className="rounded-lg" aria-label="EduConnect AI — home">
            <Logo />
          </Link>
          <nav aria-label="Main" className="hidden md:block">
            <ul className="flex items-center gap-1">
              {PUBLIC_NAV.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="rounded-lg px-3 py-2 text-sm font-semibold text-ink-700 hover:bg-ink-50 hover:text-ink-900">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="hidden items-center gap-2 md:flex">
            <LinkButton href="/login" variant="ghost">Sign in</LinkButton>
            <LinkButton href="/register">Get started</LinkButton>
          </div>
          <MobileMenu />
        </Container>
      </header>

      <main id="main" className="flex-1">
        {children}
      </main>

      <footer className="border-t border-ink-100 bg-ink-50">
        <Container className="py-12">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr]">
            <div className="max-w-sm">
              <Logo />
              <p className="mt-3 text-sm text-ink-600">
                A school platform for connection, wellbeing and learning — built for students aged 13–19, with privacy and safety by design.
              </p>
            </div>
            <nav aria-label="Product">
              <p className="text-xs font-bold uppercase tracking-wider text-ink-500">Product</p>
              <ul className="mt-3 space-y-2 text-sm">
                <li><Link href="/features" className="text-ink-700 hover:text-brand-700">Features</Link></li>
                <li><Link href="/#pricing" className="text-ink-700 hover:text-brand-700">Pricing for schools</Link></li>
                <li><Link href="/about" className="text-ink-700 hover:text-brand-700">About</Link></li>
                <li><Link href="/login" className="text-ink-700 hover:text-brand-700">Sign in</Link></li>
              </ul>
            </nav>
            <nav aria-label="Legal">
              <p className="text-xs font-bold uppercase tracking-wider text-ink-500">Trust</p>
              <ul className="mt-3 space-y-2 text-sm">
                <li><Link href="/privacy" className="text-ink-700 hover:text-brand-700">Privacy notice</Link></li>
                <li><Link href="/terms" className="text-ink-700 hover:text-brand-700">Terms of use</Link></li>
                <li><Link href="/#who-sees-what" className="text-ink-700 hover:text-brand-700">Who sees what</Link></li>
              </ul>
            </nav>
          </div>

          <div className="mt-10 rounded-2xl bg-white p-4 text-sm text-ink-700 ring-1 ring-ink-100">
            <p>
              <strong className="font-bold text-ink-900">Need help now?</strong>{" "}
              {EMERGENCY_NUMBERS.map((n, i) => (
                <span key={n.number}>
                  {i > 0 && " · "}
                  <a href={`tel:${n.number.replace(/\s/g, "")}`} className="font-bold text-brand-700 underline-offset-2 hover:underline">
                    {n.number}
                  </a>{" "}
                  <span className="text-ink-600">{n.short}</span>
                </span>
              ))}
              <span className="text-ink-500"> (Romania — verify locally)</span>
            </p>
          </div>

          <p className="mt-6 text-xs text-ink-500">
            © {new Date().getFullYear()} EduConnect AI. Not a medical or emergency service. Designed to support GDPR compliance, subject to legal review.
          </p>
        </Container>
      </footer>
    </div>
  );
}
