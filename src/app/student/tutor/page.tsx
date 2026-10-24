import type { Metadata } from "next";
import { BookOpenCheck, Lightbulb, ListChecks, Lock } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { studentAccess } from "@/lib/services/consent";
import { getStudentAcademics } from "@/lib/services/academics";
import { ChatPanel } from "@/components/chat";
import { Card, EmptyState, LinkButton, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "AI tutor" };

export default async function TutorPage() {
  const user = await requireUser(["student"]);
  const access = await studentAccess(user, user.id);
  if (!access.ai) {
    return (
      <>
        <PageHeader title="AI tutor" />
        <EmptyState icon={Lock} title="AI features are switched off" action={<LinkButton href="/settings" variant="soft">Review in Settings</LinkButton>}>
          {access.active ? "You can switch the AI tutor on in Settings." : "Your school is waiting for a parent or guardian's consent."}
        </EmptyState>
      </>
    );
  }
  const academics = await getStudentAcademics(user);
  const subjects = academics.subjects.map((s) => s.name);
  const focus = academics.recommendations[0]?.subjectName;
  if (focus) subjects.sort((a, b) => (a === focus ? -1 : b === focus ? 1 : 0));

  return (
    <div className="animate-fade-up">
      <PageHeader
        eyebrow="Learning"
        title="AI tutor"
        description="Explains ideas step by step, gives hints and quizzes you — so you can solve your homework yourself."
      />
      <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
        <ChatPanel
          kind="tutor"
          subjects={subjects.length ? subjects : ["General"]}
          defaultLang={user.locale}
          greeting={`Hi ${user.displayName.split(" ")[0]}! What are you working on? Paste a question or tell me the topic. I'll explain the idea and help you take the next step yourself.`}
          placeholder="e.g. How do I solve 4x − 7 = 13?"
          starterPrompts={["Explain how to solve linear equations", "What is photosynthesis?", "Quiz me on fractions", "Explică teorema lui Pitagora"]}
        />
        <aside className="space-y-4">
          <Card>
            <h2 className="font-bold">How the tutor helps</h2>
            <ul className="mt-3 space-y-3 text-sm text-ink-600">
              <li className="flex gap-2"><Lightbulb className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden /> <span><strong>Explain</strong> — the concept, an analogy and a different worked example.</span></li>
              <li className="flex gap-2"><BookOpenCheck className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden /> <span><strong>Hint</strong> — one small nudge, then you try.</span></li>
              <li className="flex gap-2"><ListChecks className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden /> <span><strong>Quiz</strong> & <strong>Summary</strong> — check yourself and revise.</span></li>
            </ul>
          </Card>
          {focus && (
            <Card className="bg-blush-50 ring-blush-200">
              <p className="text-sm text-ink-700">
                Suggested focus: <strong>{focus}</strong>. {academics.recommendations[0].reason}
              </p>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}
