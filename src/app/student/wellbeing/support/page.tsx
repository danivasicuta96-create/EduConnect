import type { Metadata } from "next";
import { Phone, Globe, LifeBuoy, MessageCircle, CalendarClock } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/dates";
import { getSupportOverview } from "@/lib/services/wellbeing";
import { Badge, Card, CardHeader, PageHeader } from "@/components/ui";
import { WellbeingNav } from "../nav";
import { RequestContactForm, SessionResponse } from "./forms";

export const metadata: Metadata = { title: "Get support" };

const categoryTone = { emergency: "red", helpline: "pink", school: "blue", selfcare: "green" } as const;

export default async function SupportPage() {
  const user = await requireUser(["student"]);
  const s = await getSupportOverview(user);
  const urgent = s.resources.filter((r) => r.category === "emergency" || r.category === "helpline");
  const other = s.resources.filter((r) => r.category !== "emergency" && r.category !== "helpline");
  const openSessions = s.sessions.filter((x) => x.status === "proposed");

  return (
    <div className="animate-fade-up">
      <PageHeader eyebrow="Wellbeing" title="Get support" description="You never have to deal with things alone. Here's who can help — at school and outside it." />
      <WellbeingNav />

      <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-5">
          <Card className="ring-red-100">
            <CardHeader title="If you need help now" icon={Phone} subtitle="Free numbers in Romania" />
            <ul className="space-y-3">
              {urgent.map((r) => (
                <li key={r.id} className="rounded-xl bg-ink-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-bold text-ink-900">{r.name}</p>
                    <Badge tone={categoryTone[r.category as keyof typeof categoryTone] ?? "neutral"}>{r.category === "emergency" ? "Emergency" : "Helpline"}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-ink-600">{r.description}</p>
                  <div className="mt-2 flex flex-wrap gap-3 text-sm">
                    {r.phone && <a href={`tel:${r.phone.replace(/\s/g, "")}`} className="inline-flex items-center gap-1 font-bold text-brand-700 underline"><Phone className="size-3.5" aria-hidden /> {r.phone}</a>}
                    {r.url && <a href={r.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-brand-700 underline"><Globe className="size-3.5" aria-hidden /> Website</a>}
                    {r.hours && <span className="text-ink-500">{r.hours}</span>}
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-ink-500">Numbers and hours are configured by your school. If a line doesn&apos;t answer, call 112.</p>
          </Card>

          {other.length > 0 && (
            <Card>
              <CardHeader title="More ways to feel better" icon={LifeBuoy} />
              <ul className="space-y-2">
                {other.map((r) => (
                  <li key={r.id} className="text-sm">
                    {r.url ? <a href={r.url} className="font-semibold text-brand-700 underline">{r.name}</a> : <strong>{r.name}</strong>} — <span className="text-ink-600">{r.description}</span>
                    {r.phone && <> · <a href={`tel:${r.phone.replace(/\s/g, "")}`} className="font-semibold text-brand-700">{r.phone}</a></>}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Talk to your school counselor" icon={MessageCircle} subtitle={s.counselors.length ? s.counselors.join(", ") : undefined} />
            {s.request && s.request.status !== "resolved" ? (
              <div className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900" role="status">
                You asked a counselor to reach out on {formatDateTime(s.request.createdAt)}. They&apos;ll get in touch with you soon.
                {s.request.status !== "open" && " Your request has been seen."}
              </div>
            ) : (
              <RequestContactForm />
            )}
          </Card>

          <Card>
            <CardHeader title="Support conversations" icon={CalendarClock} />
            {s.sessions.length === 0 ? (
              <p className="text-sm text-ink-500">When a counselor invites you to a chat, it will show up here.</p>
            ) : (
              <ul className="space-y-3">
                {s.sessions.map((x) => (
                  <li key={x.id} className="rounded-xl bg-ink-50 p-4 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-bold">{formatDateTime(x.proposed_at)}{x.location ? ` · ${x.location}` : ""}</p>
                      <Badge tone={x.status === "accepted" ? "green" : x.status === "proposed" ? "pink" : "neutral"}>{x.status}</Badge>
                    </div>
                    <p className="mt-1 text-ink-600">With {x.counselor_name ?? "your school counselor"} — a relaxed, confidential conversation.</p>
                    {x.status === "proposed" && <SessionResponse sessionId={x.id} />}
                  </li>
                ))}
              </ul>
            )}
            {openSessions.length > 0 && <p className="mt-3 text-xs text-ink-500">You can say no — that&apos;s okay. You can also suggest another time in the message.</p>}
          </Card>
        </div>
      </div>
    </div>
  );
}
