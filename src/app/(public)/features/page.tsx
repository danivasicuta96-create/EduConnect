import type { Metadata } from "next";
import {
  ArrowRight, Bell, Bot, CalendarDays, ChartColumn, Check, ClipboardCheck, Calculator, FileText, Handshake, HeartPulse,
  Languages, Lock, MessageCircle, NotebookPen, School, ScrollText, ShieldCheck, SlidersHorizontal, Sparkles, TrendingUp,
  TriangleAlert, UserRoundCheck, UsersRound, type LucideIcon,
} from "lucide-react";
import { LinkButton, cx } from "@/components/ui";
import { Container, IconTile, PageHero, Section, SectionHeading } from "../_components/blocks";

export const metadata: Metadata = {
  title: "Features",
  description:
    "Explainable classmate matching, a private daily check-in, grades and timetable, an AI tutor that teaches, aggregated teacher dashboards and a supportive counselor early-warning system.",
};

type Feature = { icon: LucideIcon; title: string; text: string };

const GROUPS: { id: string; eyebrow: string; title: string; intro: string; tone: "brand" | "pink" | "ink"; features: Feature[] }[] = [
  {
    id: "connection",
    eyebrow: "Social connection",
    title: "Find your people at school",
    intro: "Starting at a new school, or just looking for someone who gets it? EduConnect suggests classmates you might click with — and tells you why.",
    tone: "brand",
    features: [
      { icon: Handshake, title: "Explainable matchmaking", text: "Suggestions are based on shared interests and goals you choose to add. Every match shows the reasons, like “you both like robotics”." },
      { icon: UsersRound, title: "Study groups", text: "Create or join groups around a subject, a test or a project with classmates at your school." },
      { icon: CalendarDays, title: "School activities", text: "Clubs and events at your school in one place, so it's easier to say yes to something new." },
      { icon: UserRoundCheck, title: "You stay in control", text: "Turn discoverability off at any time, dismiss suggestions, and block or report anyone who makes you uncomfortable." },
    ],
  },
  {
    id: "wellbeing",
    eyebrow: "Wellbeing",
    title: "Notice how you're really doing",
    intro: "Wellbeing tools that respect you: private by default, supportive rather than clinical, and never used to sell you anything.",
    tone: "pink",
    features: [
      { icon: HeartPulse, title: "One-minute daily check-in", text: "Rate your day from 1 to 10, pick how it felt — from great to very hard — and tag factors such as tests, workload or friendships." },
      { icon: NotebookPen, title: "Private notes", text: "A space just for you. Notes are stored separately and never shown to teachers, parents or admins." },
      { icon: TrendingUp, title: "Personal trends", text: "See how your weeks look over time and which factors tend to come up on harder days." },
      { icon: Sparkles, title: "AI wellbeing assistant", text: "Talk things through and get gentle, practical ideas. Built-in crisis safeguards point to trusted adults and helplines." },
    ],
  },
  {
    id: "academics",
    eyebrow: "Academics",
    title: "Your school year, at a glance",
    intro: "Grades, attendance and timetable in one clear view — plus tools that help you learn, not shortcuts that skip the learning.",
    tone: "brand",
    features: [
      { icon: ChartColumn, title: "Grades & averages", text: "Every grade and subject average in one place, updated as teachers enter them." },
      { icon: ClipboardCheck, title: "Attendance & timetable", text: "Know what's next today and keep an eye on absences before they add up." },
      { icon: Calculator, title: "Target-grade calculator", text: "Set a goal for a subject and see what you'd need on upcoming assessments to get there." },
      { icon: Bot, title: "AI tutor that teaches", text: "Asks guiding questions and explains concepts step by step instead of handing over answers. Works in Romanian and English." },
    ],
  },
  {
    id: "school",
    eyebrow: "School support",
    title: "Help staff support students — without surveillance",
    intro: "Teachers and counselors get just enough information to act early and kindly. Never a diagnosis, never a label.",
    tone: "ink",
    features: [
      { icon: School, title: "Teacher dashboards", text: "Gradebook, attendance and class wellbeing shown only as aggregates — groups smaller than 5 students are hidden." },
      { icon: TriangleAlert, title: "Counselor early-warning", text: "Configurable example rules — such as a 7-day average below 5, or five low check-ins in a row — suggest a supportive follow-up." },
      { icon: MessageCircle, title: "Follow-ups & support sessions", text: "Counselors log a neutral, private follow-up and students can ask for a conversation themselves." },
      { icon: SlidersHorizontal, title: "School administration", text: "Classes, subjects, staff permissions, invitations, consent records and subscription in one admin area." },
    ],
  },
];

const TRUST: Feature[] = [
  { icon: Lock, title: "Row-level security", text: "Access rules live in the Postgres database itself, so each person can only read what their role allows." },
  { icon: School, title: "School isolation", text: "Each school's data is separated from every other school's." },
  { icon: ShieldCheck, title: "Consent for under-16s", text: "Guardian consent flows reflect Romania's age of digital consent (16)." },
  { icon: ScrollText, title: "Audit logs", text: "Sensitive views and privileged changes are recorded — without storing notes or scores in the log." },
  { icon: Languages, title: "EU data region", text: "Designed to run on infrastructure in the EU." },
  { icon: Bell, title: "Neutral notifications", text: "Sensitive notifications use neutral wording, so nothing private shows up on a lock screen." },
  { icon: FileText, title: "Data minimisation", text: "We collect only what each feature needs, and most wellbeing fields are optional." },
  { icon: HeartPulse, title: "No ads, ever", text: "Wellbeing data is never used for matchmaking, advertising or monetisation." },
];

export default function FeaturesPage() {
  return (
    <>
      <PageHero
        eyebrow="Features"
        title="Built around the whole student"
        aside={
          <nav aria-label="Feature areas">
            <ul className="flex flex-wrap gap-2">
              {GROUPS.map((g) => (
                <li key={g.id}>
                  <a href={`#${g.id}`} className="inline-flex rounded-full bg-white px-4 py-2 text-sm font-semibold text-ink-800 shadow-sm ring-1 ring-ink-100 hover:text-brand-700">
                    {g.eyebrow}
                  </a>
                </li>
              ))}
              <li>
                <a href="#trust" className="inline-flex rounded-full bg-white px-4 py-2 text-sm font-semibold text-ink-800 shadow-sm ring-1 ring-ink-100 hover:text-brand-700">
                  Privacy & safety
                </a>
              </li>
            </ul>
          </nav>
        }
      >
        <p>Connection, wellbeing and learning affect each other. EduConnect brings them into one calm, private space for students — and gives schools the tools to help early.</p>
      </PageHero>

      {GROUPS.map((g, gi) => (
        <Section key={g.id} id={g.id} labelledBy={`${g.id}-heading`} className={cx(gi % 2 === 1 && "bg-ink-50")}>
          <div className="grid gap-10 lg:grid-cols-[1fr_1.6fr]">
            <SectionHeading id={`${g.id}-heading`} eyebrow={g.eyebrow} title={g.title}>{g.intro}</SectionHeading>
            <ul className="grid gap-4 sm:grid-cols-2">
              {g.features.map((f) => (
                <li key={f.title} className="rounded-3xl bg-white p-6 shadow-[var(--shadow-card)] ring-1 ring-ink-100">
                  <IconTile icon={f.icon} tone={g.tone} />
                  <h3 className="mt-4 font-bold text-ink-900">{f.title}</h3>
                  <p className="mt-1.5 text-sm text-ink-600">{f.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </Section>
      ))}

      <Section id="trust" labelledBy="trust-heading" className="bg-ink-900 text-white">
        <div className="mb-10 max-w-2xl">
          <p className="mb-2 text-sm font-bold uppercase tracking-wider text-brand-300">Privacy & safety</p>
          <h2 id="trust-heading" className="text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">Safe for teenagers by design</h2>
          <p className="mt-3 text-lg text-ink-200">
            Protections are built into the architecture, not bolted on. Designed to support GDPR compliance, subject to legal review.
          </p>
        </div>
        <ul className="grid gap-x-8 gap-y-7 sm:grid-cols-2 lg:grid-cols-4">
          {TRUST.map((t) => (
            <li key={t.title}>
              <span className="grid size-10 place-items-center rounded-xl bg-white/10 text-brand-300">
                <t.icon className="size-5" aria-hidden />
              </span>
              <h3 className="mt-3 font-bold">{t.title}</h3>
              <p className="mt-1 text-sm text-ink-200">{t.text}</p>
            </li>
          ))}
        </ul>
      </Section>

      <section aria-labelledby="features-cta" className="py-16 sm:py-20">
        <Container className="text-center">
          <h2 id="features-cta" className="text-3xl font-extrabold tracking-tight text-ink-900 text-balance">See it with the demo school</h2>
          <p className="mx-auto mt-3 max-w-xl text-lg text-ink-600">Sign in as a fictional student, teacher, counselor, admin or parent and explore each view.</p>
          <ul className="mx-auto mt-6 flex max-w-xl flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-ink-700">
            {["Fictional demo data", "One-click demo sign-in", "Every role included"].map((t) => (
              <li key={t} className="flex items-center gap-1.5"><Check className="size-4 text-brand-600" aria-hidden /> {t}</li>
            ))}
          </ul>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <LinkButton href="/login" size="lg">Try the demo <ArrowRight className="size-4" aria-hidden /></LinkButton>
            <LinkButton href="/register" size="lg" variant="secondary">Join your school</LinkButton>
          </div>
        </Container>
      </section>
    </>
  );
}
