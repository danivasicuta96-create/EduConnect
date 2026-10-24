import type { Metadata } from "next";
import { Lock, Info } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { studentAccess } from "@/lib/services/consent";
import { ChatPanel } from "@/components/chat";
import { EmptyState, LinkButton, Notice, PageHeader } from "@/components/ui";
import { WellbeingNav } from "../nav";
import { Exercises } from "./exercises";

export const metadata: Metadata = { title: "Wellbeing assistant" };

export default async function AssistantPage({ searchParams }: PageProps<"/student/wellbeing/assistant">) {
  const user = await requireUser(["student"]);
  const access = await studentAccess(user, user.id);
  const sp = await searchParams;
  const exercise = sp.exercise === "grounding" ? "grounding" : sp.exercise === "muscle" ? "muscle" : "breathing";

  return (
    <div className="animate-fade-up">
      <PageHeader eyebrow="Wellbeing" title="Assistant & exercises" description="Calm-down exercises you can do anywhere, and a supportive assistant for everyday stress." />
      <WellbeingNav />
      <div className="grid gap-5 lg:grid-cols-[1fr_1.1fr]">
        <Exercises initial={exercise} />
        <div className="space-y-4">
          <Notice tone="blue" icon={Info}>
            The assistant is <strong>not a therapist</strong> and can&apos;t diagnose anything. It&apos;s here for everyday stress. For anything serious,
            talk to a trusted adult or the school counselor — or call <a href="tel:112">112</a> in an emergency.
          </Notice>
          {access.ai ? (
            <ChatPanel
              kind="wellbeing"
              defaultLang={user.locale}
              greeting="Hi, I'm here to listen. How are you feeling right now? You can tell me what's on your mind, or ask for a quick way to relax."
              placeholder="Type how you're feeling…"
              starterPrompts={["I'm stressed about a test", "I can't sleep well", "Help me calm down", "Ajută-mă să-mi organizez timpul"]}
            />
          ) : (
            <EmptyState icon={Lock} title="The assistant is switched off" action={<LinkButton href="/settings" variant="soft">Review in Settings</LinkButton>}>
              The exercises still work without it.
            </EmptyState>
          )}
        </div>
      </div>
    </div>
  );
}
