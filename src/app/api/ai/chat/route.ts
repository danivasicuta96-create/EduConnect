import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { studentAccess } from "@/lib/services/consent";
import { tenant } from "@/lib/db/tenant";
import { LIMITS, rateLimit } from "@/lib/rate-limit";
import { getChatProvider } from "@/lib/ai/provider";
import { tutorSystemPrompt, wellbeingSystemPrompt } from "@/lib/ai/prompts";
import { CRISIS_MESSAGE, screenText } from "@/lib/engines/safety";

const bodySchema = z.object({
  kind: z.enum(["tutor", "wellbeing"]),
  lang: z.enum(["en", "ro"]).default("en"),
  subject: z.string().trim().max(60).default("General"),
  mode: z.enum(["explain", "hint", "quiz", "summary"]).default("explain"),
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) }))
    .min(1)
    .max(40)
    .refine((m) => m[m.length - 1].role === "user", "The last message must be from the student."),
});

// Chats are not stored by EduConnect. Nothing from them is logged, used for
// matchmaking, analytics or advertising.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") return NextResponse.json({ error: "Not signed in as a student." }, { status: 401 });

  const access = await studentAccess(user, user.id);
  if (!access.ai) return NextResponse.json({ error: "AI features are switched off for your account. You can review this in Settings." }, { status: 403 });

  const limit = rateLimit(`ai:${user.id}`, LIMITS.ai.limit, LIMITS.ai.windowMs);
  if (!limit.ok) {
    return NextResponse.json({ error: `You've sent a lot of messages. Take a short break and try again in ${Math.ceil(limit.retryAfterSeconds / 60)} min.` }, { status: 429 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const { kind, lang, subject, mode, messages } = parsed.data;

  // Deterministic safety screen first — it never depends on the model.
  const safety = screenText(messages[messages.length - 1].content);
  const headers = { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Safety-Level": safety.level };

  if (safety.level === "crisis") {
    return new Response(CRISIS_MESSAGE[lang], { headers });
  }

  const sp = await tenant(user).studentProfiles.findOne({ _id: user.id }, { projection: { learning_style: 1 } });
  const profile = { learning_style: (sp?.learning_style as string | null) ?? null, grade_level: user.gradeLevel };
  const system =
    kind === "tutor"
      ? tutorSystemPrompt({ subject, lang, learningStyle: profile?.learning_style ?? null, gradeLevel: profile?.grade_level ?? null, mode })
      : wellbeingSystemPrompt({ lang });

  const provider = await getChatProvider();
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of provider.stream({ system, messages, effort: kind === "tutor" ? "medium" : "low", maxTokens: kind === "tutor" ? 4000 : 1200 }, req.signal)) {
          controller.enqueue(encoder.encode(chunk));
        }
      } catch (err) {
        console.error("[ai] provider error", err instanceof Error ? err.name : "unknown");
        controller.enqueue(encoder.encode(lang === "ro" ? "\n\nNu am putut răspunde acum. Încearcă din nou puțin mai târziu." : "\n\nI couldn't answer right now. Please try again in a moment."));
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { ...headers, "X-AI-Provider": provider.name } });
}
