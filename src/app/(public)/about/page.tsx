import type { Metadata } from "next";
import { ArrowRight, Compass, HandHeart, Lightbulb, Scale, Sprout, UsersRound } from "lucide-react";
import { LinkButton } from "@/components/ui";
import { IconTile, PageHero, Section, SectionHeading } from "../_components/blocks";

export const metadata: Metadata = {
  title: "About",
  description:
    "Why we are building EduConnect AI: a school platform that helps teenagers feel connected, supported and on track — designed with privacy and safety for minors from day one.",
};

const PRINCIPLES = [
  { icon: HandHeart, title: "Students first", text: "Every feature starts with the question: does this help a student feel more connected, supported or capable — on their terms?" },
  { icon: Scale, title: "Supportive, not clinical", text: "We never diagnose or label. Signals invite a kind human conversation; they don't decide anything about a student." },
  { icon: Compass, title: "Explainable by default", text: "Matches show their reasons. Alert rules are visible and configurable by the school. No black boxes about people." },
  { icon: Sprout, title: "Learning over shortcuts", text: "Our AI tutor teaches concepts and asks guiding questions. It's there to build understanding, not to do homework." },
  { icon: UsersRound, title: "Least privilege", text: "Teachers see aggregates, counselors see only what's needed to help, admins don't see wellbeing content at all." },
  { icon: Lightbulb, title: "Honest business model", text: "Schools pay a subscription. No advertising, and wellbeing data is never used for matchmaking or monetisation." },
] as const;

export default function AboutPage() {
  return (
    <>
      <PageHero eyebrow="About EduConnect AI" title="School is about more than grades.">
        <p>
          It&apos;s where teenagers make friends, figure out who they are and sometimes have a really hard week. We&apos;re building a platform that supports all of it — starting with schools in Romania and the EU.
        </p>
      </PageHero>

      <Section labelledBy="why-heading">
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
          <SectionHeading id="why-heading" eyebrow="Why we exist" title="Help every student feel seen — without being watched" />
          <div className="space-y-4 text-lg text-ink-700">
            <p>
              Many students feel isolated at school, and the signs that someone is struggling are easy to miss in a busy classroom. Schools want to help, but their tools are scattered: grades in one place, activities in another, and wellbeing often nowhere at all.
            </p>
            <p>
              EduConnect AI brings connection, wellbeing and academics together — with a clear line around what&apos;s private. Students get tools that are genuinely useful to them. Staff get just enough insight to reach out early and kindly.
            </p>
            <p>
              Because our users are minors, safety and privacy aren&apos;t features we add later. They shape the architecture: data minimisation, database-level access rules, school isolation, consent flows for under-16s and audit logs.
            </p>
          </div>
        </div>
      </Section>

      <Section labelledBy="principles-heading" className="bg-ink-50">
        <SectionHeading id="principles-heading" eyebrow="What we believe" title="Our principles" />
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PRINCIPLES.map((p, i) => (
            <li key={p.title} className="rounded-3xl bg-white p-6 shadow-[var(--shadow-card)] ring-1 ring-ink-100">
              <IconTile icon={p.icon} tone={i % 2 ? "pink" : "brand"} />
              <h3 className="mt-4 font-bold text-ink-900">{p.title}</h3>
              <p className="mt-1.5 text-sm text-ink-600">{p.text}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section labelledBy="stage-heading">
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
          <SectionHeading id="stage-heading" eyebrow="Where we are" title="Early, and building with schools" />
          <div className="space-y-4 text-lg text-ink-700">
            <p>
              EduConnect AI is an early-stage product. We&apos;re looking for schools, counselors and student councils who want to shape it with us through free three-month pilots.
            </p>
            <p>
              We&apos;re also open to grant-funded and public-partnership deployments with municipalities, education authorities and NGOs.
            </p>
            <div className="flex flex-col gap-3 pt-2 sm:flex-row">
              <LinkButton href="/register" size="lg">Join your school <ArrowRight className="size-4" aria-hidden /></LinkButton>
              <LinkButton href="/login" size="lg" variant="secondary">Try the demo</LinkButton>
            </div>
          </div>
        </div>
      </Section>
    </>
  );
}
