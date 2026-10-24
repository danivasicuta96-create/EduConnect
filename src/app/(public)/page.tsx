import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight, BookOpenCheck, Bot, Check, GraduationCap, Handshake, HeartPulse, Lock, NotebookPen, School,
  ShieldCheck, Sparkles, TrendingUp, UsersRound, LifeBuoy, EyeOff, Ban,
} from "lucide-react";
import { Badge, LinkButton, cx } from "@/components/ui";
import { AccessTable } from "./_components/access-table";
import { Container, EmergencyCard, IconTile, Section, SectionHeading } from "./_components/blocks";

export const metadata: Metadata = {
  title: { absolute: "EduConnect AI — connection, wellbeing and learning for every student" },
  description:
    "A school platform for students aged 13–19: explainable classmate matching, a private one-minute daily check-in, grades and an AI tutor that teaches — with privacy and safety built in.",
};

const PILLARS = [
  {
    icon: Handshake,
    title: "Social connection",
    text: "Meet classmates who share your interests and goals. Every match explains why it was suggested — no mystery algorithm.",
    points: ["Explainable matchmaking", "Study groups", "School activities"],
  },
  {
    icon: HeartPulse,
    title: "Wellbeing",
    text: "A one-minute daily check-in, private notes and your own trends — with supportive, non-clinical suggestions.",
    points: ["Mood 1–10 & factors", "Personal trends", "AI assistant with crisis safeguards"],
  },
  {
    icon: GraduationCap,
    title: "Academics",
    text: "Grades, averages, attendance and timetable in one place, plus an AI tutor that explains concepts instead of doing your homework.",
    points: ["Target-grade calculator", "Romanian & English tutor", "Timetable & attendance"],
  },
  {
    icon: School,
    title: "School support",
    text: "Teachers see only aggregated class wellbeing. Counselors get early, gentle signals to reach out — never a diagnosis.",
    points: ["Aggregates for groups of 5+", "Configurable early-warning rules", "Supportive follow-ups"],
  },
] as const;

const PLANS = [
  {
    name: "Pilot",
    price: "Free",
    period: "for 3 months",
    blurb: "Try EduConnect with your students and see how it fits your school.",
    features: ["Up to 150 students", "Student app & daily check-ins", "Explainable matchmaking", "Teacher dashboards", "No commitment"],
    cta: "Start a pilot",
    featured: false,
  },
  {
    name: "School",
    price: "€149",
    period: "/ month",
    yearly: "or €1,490 / year",
    blurb: "The full platform for one school — connection, wellbeing and academics together.",
    features: ["Up to 1,000 students", "Everything in Pilot", "Counselor tools & early-warning rules", "AI tutor & wellbeing assistant", "Audit logs"],
    cta: "Choose School",
    featured: true,
  },
  {
    name: "School Plus",
    price: "€299",
    period: "/ month",
    yearly: "or €2,990 / year",
    blurb: "For schools that want deeper insight and extra resources for students.",
    features: ["No student limit", "Everything in School", "Advanced aggregated analytics", "Personal development reports", "Extended relaxation library"],
    cta: "Choose School Plus",
    featured: false,
  },
] as const;

export default function LandingPage() {
  return (
    <>
      <Hero />
      <Pillars />
      <CheckinSection />
      <Section id="who-sees-what" labelledBy="who-heading" className="bg-ink-50">
        <SectionHeading id="who-heading" eyebrow="Privacy by design" title="Who sees what">
          Students own their wellbeing data. Staff see only what they need to help — and wellbeing data is never used for matchmaking, advertising or monetisation.
        </SectionHeading>
        <AccessTable />
        <p className="mt-6">
          <Link href="/privacy" className="inline-flex items-center gap-1.5 font-semibold text-brand-700 hover:underline">
            Read the privacy notice <ArrowRight className="size-4" aria-hidden />
          </Link>
        </p>
      </Section>
      <Pricing />
      <Safety />
      <FinalCta />
    </>
  );
}

// ───────────── Hero ─────────────

function Hero() {
  return (
    <div className="relative overflow-hidden bg-gradient-to-b from-blush-50 via-white to-white">
      <div aria-hidden className="pointer-events-none absolute -right-32 -top-32 size-[28rem] rounded-full bg-brand-100/70 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -left-24 top-40 size-72 rounded-full bg-blush-200/60 blur-3xl" />
      <Container className="relative grid items-center gap-12 py-14 sm:py-20 lg:grid-cols-[1.1fr_1fr] lg:py-24">
        <div className="animate-fade-up">
          <Badge tone="brand" className="mb-5">
            <Sparkles className="size-3.5" aria-hidden /> For students aged 13–19 · Romania & EU
          </Badge>
          <h1 className="text-4xl font-extrabold leading-[1.08] tracking-tight text-ink-900 text-balance sm:text-5xl lg:text-6xl">
            Feel connected, supported and{" "}
            <span className="bg-[linear-gradient(135deg,var(--color-brand-600),#c2305f)] bg-clip-text text-transparent">on track</span> at school.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-ink-600">
            EduConnect AI brings friendships, wellbeing and learning together in one safe school platform — so no student slips through the cracks, and every student has their privacy respected.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <LinkButton href="/login" size="lg">
              Try the demo <ArrowRight className="size-4" aria-hidden />
            </LinkButton>
            <LinkButton href="/register" size="lg" variant="secondary">Join your school</LinkButton>
          </div>
          <ul className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium text-ink-600">
            {["No advertising", "EU data region", "Consent flows for under-16s"].map((t) => (
              <li key={t} className="flex items-center gap-1.5">
                <Check className="size-4 text-brand-600" aria-hidden /> {t}
              </li>
            ))}
          </ul>
        </div>
        <HeroVisual />
      </Container>
    </div>
  );
}

function HeroVisual() {
  return (
    <div aria-hidden className="relative isolate mx-auto w-full max-w-md select-none lg:max-w-none">
      <div className="absolute inset-4 -z-10 rotate-3 rounded-[2rem] bg-brand-gradient opacity-90" />
      <div className="space-y-3 rounded-[2rem] bg-white/95 p-4 shadow-[var(--shadow-pop)] ring-1 ring-ink-100 sm:p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-ink-900">Good morning, Ioana</p>
          <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">Checked in · 7/10</span>
        </div>

        <div className="rounded-2xl bg-blush-50 p-4">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-full bg-blush-200 text-sm font-bold text-[#9d2350]">AM</span>
            <div className="min-w-0">
              <p className="font-bold text-ink-900">Andrei M. · 10B</p>
              <p className="text-xs text-ink-600">Suggested study buddy</p>
            </div>
            <span className="ml-auto rounded-xl bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white">Connect</span>
          </div>
          <p className="mt-3 text-xs font-semibold text-ink-700">Why: you both like</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {["Robotics", "Chess", "Goal: Bac Math 9+"].map((t) => (
              <span key={t} className="rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold text-brand-700 ring-1 ring-brand-100">{t}</span>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-ink-50 p-4">
            <p className="text-xs font-semibold text-ink-500">Mathematics</p>
            <p className="mt-1 text-2xl font-extrabold text-ink-900">8.75</p>
            <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-emerald-700"><TrendingUp className="size-3" /> +0.4 this term</p>
          </div>
          <div className="rounded-2xl bg-ink-50 p-4">
            <p className="text-xs font-semibold text-ink-500">Your week</p>
            <div className="mt-2 flex h-10 items-end gap-1">
              {[5, 6, 6, 8, 7, 7, 8].map((v, i) => (
                <span key={i} className="flex-1 rounded-sm bg-brand-400" style={{ height: `${v * 10}%` }} />
              ))}
            </div>
            <p className="mt-1 text-xs text-ink-500">Private to you</p>
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-2xl bg-ink-900 p-4 text-white">
          <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-white/10"><Bot className="size-4 text-brand-300" /></span>
          <p className="text-sm text-ink-100">
            Let&apos;s solve it together — what do you notice about the two sides of the equation?
          </p>
        </div>
      </div>
    </div>
  );
}

// ───────────── Pillars ─────────────

function Pillars() {
  return (
    <Section id="pillars" labelledBy="pillars-heading">
      <SectionHeading id="pillars-heading" eyebrow="One platform, four pillars" title="Everything that shapes a good school day">
        Most tools look at grades or wellbeing in isolation. EduConnect connects them — carefully, and with students in control.
      </SectionHeading>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PILLARS.map((p, i) => (
          <li key={p.title} className="flex flex-col rounded-3xl bg-white p-6 shadow-[var(--shadow-card)] ring-1 ring-ink-100">
            <IconTile icon={p.icon} tone={i % 2 ? "pink" : "brand"} />
            <h3 className="mt-4 text-lg font-bold text-ink-900">{p.title}</h3>
            <p className="mt-2 text-sm text-ink-600">{p.text}</p>
            <ul className="mt-4 space-y-1.5 border-t border-ink-100 pt-4 text-sm">
              {p.points.map((pt) => (
                <li key={pt} className="flex items-start gap-2 text-ink-700">
                  <Check className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden /> {pt}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      <p className="mt-8 text-center">
        <LinkButton href="/features" variant="soft">
          Explore all features <ArrowRight className="size-4" aria-hidden />
        </LinkButton>
      </p>
    </Section>
  );
}

// ───────────── Check-in ─────────────

const STEPS = [
  { icon: HeartPulse, title: "Pick a number", text: "How are you today, from 1 to 10? That's the only required question." },
  { icon: Sparkles, title: "Add context, if you want", text: "Tag what's shaping your day — tests, workload, friendships, sleep, family." },
  { icon: NotebookPen, title: "Keep a private note", text: "Write a few lines just for you. Notes are never shown to teachers or parents." },
  { icon: TrendingUp, title: "See your trends", text: "Spot patterns over weeks and get gentle, non-clinical ideas that might help." },
] as const;

function CheckinSection() {
  return (
    <Section id="check-in" labelledBy="checkin-heading" className="bg-gradient-to-b from-white to-blush-50/60">
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <div>
          <SectionHeading id="checkin-heading" eyebrow="Daily check-in" title="One minute a day. Private by default.">
            A quick check-in helps you notice how you&apos;re really doing — and, only if a pattern suggests it, lets your school offer support early.
          </SectionHeading>
          <ol className="space-y-5">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex gap-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-600 text-sm font-extrabold text-white">{i + 1}</span>
                <div>
                  <h3 className="font-bold text-ink-900">{s.title}</h3>
                  <p className="text-ink-600">{s.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <CheckinMock />
      </div>
    </Section>
  );
}

function CheckinMock() {
  const factors = ["Tests", "Workload", "Friendships", "Sleep", "Family", "Sport"];
  const selected = new Set(["Tests", "Friendships"]);
  return (
    <figure className="mx-auto w-full max-w-md">
      <div aria-hidden className="select-none rounded-[2rem] bg-white p-5 shadow-[var(--shadow-pop)] ring-1 ring-ink-100 sm:p-6">
        <div className="flex items-center justify-between">
          <p className="text-lg font-extrabold text-ink-900">How are you today?</p>
          <span className="rounded-full bg-ink-100 px-2.5 py-0.5 text-xs font-semibold text-ink-700">Thu, 23 Oct</span>
        </div>

        <div className="mt-5 grid grid-cols-5 gap-1.5 sm:grid-cols-10">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <span
              key={n}
              className={cx(
                "grid h-10 place-items-center rounded-xl text-sm font-bold",
                n === 7 ? "bg-brand-600 text-white shadow-[var(--shadow-pop)]" : "bg-ink-50 text-ink-700 ring-1 ring-inset ring-ink-100",
              )}
            >
              {n}
            </span>
          ))}
        </div>
        <div className="mt-1.5 flex justify-between text-xs text-ink-500">
          <span>Really hard</span>
          <span>Great</span>
        </div>

        <p className="mt-5 text-sm font-semibold text-ink-800">What&apos;s shaping your day?</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {factors.map((f) => (
            <span
              key={f}
              className={cx(
                "rounded-full px-3 py-1 text-sm font-semibold",
                selected.has(f) ? "bg-brand-50 text-brand-700 ring-1 ring-brand-200" : "bg-white text-ink-600 ring-1 ring-ink-200",
              )}
            >
              {f}
            </span>
          ))}
        </div>

        <p className="mt-5 flex items-center gap-1.5 text-sm font-semibold text-ink-800">
          <Lock className="size-3.5 text-ink-500" /> Private note <span className="font-normal text-ink-500">(only you)</span>
        </p>
        <div className="mt-2 rounded-xl bg-ink-50 p-3 text-sm text-ink-600 ring-1 ring-inset ring-ink-100">
          Nervous about the physics test, but lunch with Maria helped.
        </div>

        <span className="mt-5 flex h-11 items-center justify-center rounded-xl bg-brand-600 text-sm font-semibold text-white">Save check-in</span>
      </div>
      <figcaption className="mt-4 text-center text-sm text-ink-500">
        Illustration of the check-in screen: a 1–10 mood scale, optional factor tags and a private note.
      </figcaption>
    </figure>
  );
}

// ───────────── Pricing ─────────────

function Pricing() {
  return (
    <Section id="pricing" labelledBy="pricing-heading">
      <SectionHeading id="pricing-heading" eyebrow="For schools" title="Simple pricing, per school" center>
        Free for students, always. Schools subscribe — no per-student fees and no advertising, ever.
      </SectionHeading>
      <ul className="grid gap-5 lg:grid-cols-3">
        {PLANS.map((plan) => (
          <li
            key={plan.name}
            className={cx(
              "relative flex flex-col rounded-3xl p-6 sm:p-7",
              plan.featured
                ? "bg-ink-900 text-white shadow-[var(--shadow-pop)]"
                : "bg-white shadow-[var(--shadow-card)] ring-1 ring-ink-100",
            )}
          >
            {plan.featured && (
              <span className="absolute -top-3 left-6 rounded-full bg-brand-600 px-3 py-1 text-xs font-bold text-white shadow-sm">Recommended</span>
            )}
            <h3 className={cx("text-lg font-bold", plan.featured ? "text-white" : "text-ink-900")}>{plan.name}</h3>
            <p className={cx("mt-1 text-sm", plan.featured ? "text-ink-200" : "text-ink-600")}>{plan.blurb}</p>
            <p className="mt-5 flex items-baseline gap-1.5">
              <span className="text-4xl font-extrabold tracking-tight">{plan.price}</span>
              <span className={plan.featured ? "text-ink-200" : "text-ink-500"}>{plan.period}</span>
            </p>
            <p className={cx("mt-1 h-5 text-sm", plan.featured ? "text-ink-200" : "text-ink-500")}>{"yearly" in plan ? plan.yearly : ""}</p>
            <ul className="mt-6 flex-1 space-y-2.5 text-sm">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <Check className={cx("mt-0.5 size-4 shrink-0", plan.featured ? "text-brand-300" : "text-brand-600")} aria-hidden />
                  <span className={plan.featured ? "text-ink-100" : "text-ink-700"}>{f}</span>
                </li>
              ))}
            </ul>
            <LinkButton
              href="/register"
              variant={plan.featured ? "primary" : "secondary"}
              size="lg"
              className="mt-7 w-full"
            >
              {plan.cta}
            </LinkButton>
          </li>
        ))}
      </ul>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl bg-blush-50 p-5 ring-1 ring-blush-100">
          <h3 className="font-bold text-ink-900">Optional premium extras</h3>
          <p className="mt-1 text-sm text-ink-600">Personal development reports and an extended relaxation library — included in School Plus. Check-ins, support signposting and safety features are never behind a paywall.</p>
        </div>
        <div className="rounded-2xl bg-ink-50 p-5 ring-1 ring-ink-100">
          <h3 className="font-bold text-ink-900">Grants & public partnerships</h3>
          <p className="mt-1 text-sm text-ink-600">Working with a municipality, ministry or NGO programme? We support grant-funded and multi-school deployments.</p>
        </div>
      </div>
      <p className="mt-4 text-center text-xs text-ink-500">Prices in EUR, excluding VAT where applicable.</p>
    </Section>
  );
}

// ───────────── Safety ─────────────

const SAFEGUARDS = [
  { icon: LifeBuoy, title: "Crisis safeguards in the AI assistant", text: "If a message suggests someone may be at risk, the assistant responds with care and points to trusted adults and helplines." },
  { icon: EyeOff, title: "Signals, not diagnoses", text: "Early-warning rules (for example a 7-day average below 5) only suggest a supportive check-in by a counselor." },
  { icon: Ban, title: "No ads, no data selling", text: "Wellbeing data is never used for matchmaking, advertising or monetisation." },
  { icon: ShieldCheck, title: "Built for minors", text: "Parental consent flows for under-16s, school isolation, least-privilege access and audit logs." },
] as const;

function Safety() {
  return (
    <Section id="safety" labelledBy="safety-heading" className="bg-ink-50">
      <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-start">
        <div>
          <SectionHeading id="safety-heading" eyebrow="Safety first" title="Supportive, never clinical">
            EduConnect helps students and schools notice when someone could use support. It does not replace counselors, doctors or emergency services.
          </SectionHeading>
          <ul className="grid gap-5 sm:grid-cols-2">
            {SAFEGUARDS.map((s) => (
              <li key={s.title}>
                <IconTile icon={s.icon} tone="ink" />
                <h3 className="mt-3 font-bold text-ink-900">{s.title}</h3>
                <p className="mt-1 text-sm text-ink-600">{s.text}</p>
              </li>
            ))}
          </ul>
        </div>
        <EmergencyCard />
      </div>
    </Section>
  );
}

// ───────────── Final CTA ─────────────

function FinalCta() {
  return (
    <section aria-labelledby="cta-heading" className="py-16 sm:py-20">
      <Container>
        <div className="relative overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,var(--color-brand-700)_0%,#c0304f_55%,#a8285a_100%)] px-6 py-12 text-center text-white sm:px-12 sm:py-16">
          <div aria-hidden className="absolute -bottom-20 -right-16 size-64 rounded-full bg-white/10" />
          <div aria-hidden className="absolute -left-10 -top-16 size-44 rounded-full bg-white/10" />
          <div className="relative">
            <UsersRound className="mx-auto size-10 text-white/90" aria-hidden />
            <h2 id="cta-heading" className="mx-auto mt-4 max-w-2xl text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">
              Ready to see it in action?
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-lg text-white/95">
              Explore the demo school with fictional students, or invite your school to a free three-month pilot.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/login" className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-white px-6 font-semibold text-brand-700 shadow-sm transition-colors hover:bg-brand-50">
                Try the demo <ArrowRight className="size-4" aria-hidden />
              </Link>
              <Link href="/register" className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-ink-900/20 px-6 font-semibold text-white ring-1 ring-inset ring-white/60 transition-colors hover:bg-ink-900/30">
                <BookOpenCheck className="size-4" aria-hidden /> Join your school
              </Link>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
