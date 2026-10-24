import Link from "next/link";
import { HeartPulse, Handshake, GraduationCap, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/shell/app-shell";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[1fr_1.05fr]">
      <aside className="relative hidden overflow-hidden bg-brand-gradient p-10 text-white lg:flex lg:flex-col">
        <Link href="/" className="inline-flex w-fit rounded-xl bg-white/95 px-3 py-2">
          <Logo />
        </Link>
        <div className="my-auto max-w-md">
          <h2 className="text-4xl font-extrabold leading-tight text-balance">A school community where every student feels connected.</h2>
          <ul className="mt-8 space-y-4 text-white/95">
            {[
              [Handshake, "Find classmates who share your interests"],
              [HeartPulse, "A one-minute daily check-in, private by default"],
              [GraduationCap, "Grades, timetable and goals in one place"],
              [ShieldCheck, "Built for minors: consent, least-privilege access, audit logs"],
            ].map(([Icon, text], i) => {
              const I = Icon as typeof Handshake;
              return (
                <li key={i} className="flex items-center gap-3">
                  <span className="grid size-9 place-items-center rounded-xl bg-white/20"><I className="size-5" aria-hidden /></span>
                  <span className="font-medium">{text as string}</span>
                </li>
              );
            })}
          </ul>
        </div>
        <div aria-hidden className="absolute -bottom-24 -right-24 size-80 rounded-full bg-white/10" />
        <div aria-hidden className="absolute -top-16 right-24 size-40 rounded-full bg-white/10" />
      </aside>
      <main id="main" className="flex min-w-0 flex-col items-center justify-center bg-white px-4 py-10 sm:px-8">
        <div className="mb-8 lg:hidden">
          <Link href="/"><Logo /></Link>
        </div>
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
