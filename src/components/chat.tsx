"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Send, LoaderCircle, Phone, LifeBuoy, Sparkles, Bot, RotateCcw } from "lucide-react";
import { buttonClass } from "./ui";

type Turn = { role: "user" | "assistant"; content: string };

/** Minimal, safe Markdown: paragraphs, **bold**, *italic*, numbered and bulleted lists. No HTML injection. */
function inline(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) return <strong key={i}>{p.slice(2, -2)}</strong>;
    if (p.startsWith("*") && p.endsWith("*") && p.length > 2) return <em key={i} className="text-ink-500">{p.slice(1, -1)}</em>;
    return <span key={i}>{p}</span>;
  });
}

export function Markdown({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);
  return (
    <div className="space-y-2">
      {blocks.map((block, i) => {
        const lines = block.split("\n");
        if (lines.every((l) => /^\s*(\d+\.|[-•])\s+/.test(l))) {
          const ordered = /^\s*\d+\./.test(lines[0]);
          const items = lines.map((l) => l.replace(/^\s*(\d+\.|[-•])\s+/, ""));
          return ordered ? (
            <ol key={i} className="list-decimal space-y-1 pl-5">{items.map((it, j) => <li key={j}>{inline(it)}</li>)}</ol>
          ) : (
            <ul key={i} className="list-disc space-y-1 pl-5">{items.map((it, j) => <li key={j}>{inline(it)}</li>)}</ul>
          );
        }
        return (
          <p key={i}>
            {lines.map((l, j) => (
              <span key={j}>
                {inline(l)}
                {j < lines.length - 1 && <br />}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}

export function CrisisPanel({ lang }: { lang: "en" | "ro" }) {
  const ro = lang === "ro";
  return (
    <div role="alert" className="rounded-2xl bg-red-50 p-4 ring-1 ring-red-200">
      <p className="font-bold text-red-900">{ro ? "Ești în siguranță acum?" : "Are you safe right now?"}</p>
      <p className="mt-1 text-sm text-red-900">
        {ro ? "Dacă ești în pericol sau te-ai putea răni, sună imediat. Nu trebuie să treci prin asta singur(ă)." : "If you're in danger or might hurt yourself, call now. You don't have to go through this alone."}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <a href="tel:112" className={buttonClass("primary", "sm")}><Phone className="size-4" aria-hidden /> 112 — {ro ? "Urgențe" : "Emergency"}</a>
        <a href="tel:116111" className={buttonClass("secondary", "sm")}><Phone className="size-4" aria-hidden /> 116 111 — Telefonul Copilului</a>
        <Link href="/student/wellbeing/support" className={buttonClass("secondary", "sm")}><LifeBuoy className="size-4" aria-hidden /> {ro ? "Cere ajutorul consilierului" : "Ask the counselor to reach out"}</Link>
      </div>
    </div>
  );
}

export function ChatPanel({
  kind, greeting, subjects, defaultLang = "en", placeholder, starterPrompts = [],
}: {
  kind: "tutor" | "wellbeing";
  greeting: string;
  subjects?: string[];
  defaultLang?: "en" | "ro";
  placeholder: string;
  starterPrompts?: string[];
}) {
  const [messages, setMessages] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [lang, setLang] = useState<"en" | "ro">(defaultLang);
  const [subject, setSubject] = useState(subjects?.[0] ?? "General");
  const [mode, setMode] = useState<"explain" | "hint" | "quiz" | "summary">("explain");
  const [safety, setSafety] = useState<"none" | "concern" | "crisis">("none");
  const [error, setError] = useState<string | null>(null);
  const [provider, setProvider] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }), [messages]);
  useEffect(() => () => abortRef.current?.abort(), []);

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;
    setError(null);
    const next: Turn[] = [...messages, { role: "user", content }];
    setMessages([...next, { role: "assistant", content: "" }]);
    setInput("");
    setBusy(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, lang, subject, mode, messages: next.slice(-20) }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({ error: "Something went wrong." }));
        setMessages(next);
        setError(data.error ?? "Something went wrong.");
        return;
      }
      const level = res.headers.get("X-Safety-Level") as typeof safety | null;
      if (level && level !== "none") setSafety(level);
      setProvider(res.headers.get("X-AI-Provider"));
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages([...next, { role: "assistant", content: acc }]);
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") setError("Connection problem. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void send(input);
  }

  const Icon = kind === "tutor" ? Bot : Sparkles;

  return (
    <div className="flex min-h-[520px] flex-col rounded-2xl bg-white shadow-[var(--shadow-card)] ring-1 ring-ink-100">
      <div className="flex flex-wrap items-center gap-2 border-b border-ink-100 p-3">
        {subjects && (
          <label className="text-sm">
            <span className="sr-only">Subject</span>
            <select value={subject} onChange={(e) => setSubject(e.target.value)} className="rounded-lg border-0 bg-ink-50 px-2.5 py-1.5 text-sm font-semibold ring-1 ring-ink-200">
              {subjects.map((s) => <option key={s}>{s}</option>)}
            </select>
          </label>
        )}
        {kind === "tutor" && (
          <div role="radiogroup" aria-label="Mode" className="flex gap-1 rounded-lg bg-ink-50 p-0.5">
            {(["explain", "hint", "quiz", "summary"] as const).map((m) => (
              <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => setMode(m)} className={clsx("rounded-md px-2.5 py-1 text-xs font-semibold capitalize", mode === m ? "bg-white text-brand-700 shadow-sm" : "text-ink-600")}>
                {m}
              </button>
            ))}
          </div>
        )}
        <div className="flex-1" />
        <div role="radiogroup" aria-label="Language" className="flex gap-1 rounded-lg bg-ink-50 p-0.5">
          {(["en", "ro"] as const).map((l) => (
            <button key={l} type="button" role="radio" aria-checked={lang === l} onClick={() => setLang(l)} className={clsx("rounded-md px-2.5 py-1 text-xs font-bold uppercase", lang === l ? "bg-white text-brand-700 shadow-sm" : "text-ink-600")}>
              {l}
            </button>
          ))}
        </div>
        {messages.length > 0 && (
          <button type="button" onClick={() => { abortRef.current?.abort(); setMessages([]); setSafety("none"); setError(null); }} className="grid size-8 place-items-center rounded-lg text-ink-500 hover:bg-ink-50" title="New conversation">
            <RotateCcw className="size-4" aria-hidden />
            <span className="sr-only">New conversation</span>
          </button>
        )}
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4" aria-live="polite" aria-busy={busy}>
        <div className="flex gap-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-600"><Icon className="size-4" aria-hidden /></span>
          <div className="rounded-2xl rounded-tl-sm bg-ink-50 px-4 py-3 text-sm text-ink-800">{greeting}</div>
        </div>
        {messages.length === 0 && starterPrompts.length > 0 && (
          <div className="flex flex-wrap gap-2 pl-11">
            {starterPrompts.map((p) => (
              <button key={p} type="button" onClick={() => send(p)} className="rounded-full bg-white px-3 py-1.5 text-sm text-ink-700 ring-1 ring-ink-200 hover:ring-brand-300">{p}</button>
            ))}
          </div>
        )}
        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="flex justify-end">
              <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-tr-sm bg-brand-600 px-4 py-3 text-sm text-white">{m.content}</div>
            </div>
          ) : (
            <div key={i} className="flex gap-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-600"><Icon className="size-4" aria-hidden /></span>
              <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-ink-50 px-4 py-3 text-sm leading-relaxed text-ink-800">
                {m.content ? <Markdown text={m.content} /> : <LoaderCircle className="size-4 animate-spin text-ink-400" aria-label="Thinking" />}
              </div>
            </div>
          ),
        )}
        {safety === "crisis" && <CrisisPanel lang={lang} />}
        {safety === "concern" && (
          <div className="rounded-xl bg-blush-50 p-3 text-sm text-ink-700 ring-1 ring-blush-200">
            {lang === "ro" ? "Dacă te simți copleșit(ă), vorbește cu un adult de încredere sau " : "If things feel like too much, talk to a trusted adult or "}
            <Link href="/student/wellbeing/support" className="font-semibold text-brand-700 underline">{lang === "ro" ? "cere sprijinul consilierului" : "ask the school counselor for support"}</Link>.
          </div>
        )}
        {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
        <div ref={endRef} />
      </div>

      <form onSubmit={onSubmit} className="flex items-end gap-2 border-t border-ink-100 p-3">
        <label htmlFor={`${kind}-input`} className="sr-only">Message</label>
        <textarea
          id={`${kind}-input`}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send(input);
            }
          }}
          rows={1}
          maxLength={4000}
          placeholder={placeholder}
          className="max-h-40 min-h-11 flex-1 resize-none rounded-xl border-0 bg-ink-50 px-3.5 py-2.5 text-sm ring-1 ring-ink-200 focus:ring-2 focus:ring-brand-500 focus:outline-none"
        />
        <button type="submit" disabled={busy || !input.trim()} className={buttonClass("primary", "md", "h-11 w-11 px-0")} aria-label="Send">
          {busy ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />}
        </button>
      </form>
      <p className="px-4 pb-3 text-[11px] text-ink-500">
        {provider === "demo" ? "Demo mode: scripted responses. " : ""}AI can make mistakes — check important facts with your teacher. Conversations aren&apos;t saved by EduConnect.
      </p>
    </div>
  );
}
