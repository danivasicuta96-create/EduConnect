"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { Wind, Hand, Activity, Play, Pause } from "lucide-react";
import { Button } from "@/components/ui";

type Exercise = "breathing" | "grounding" | "muscle";

const PHASES = ["Breathe in", "Hold", "Breathe out", "Hold"] as const;

function Breathing() {
  const [running, setRunning] = useState(false);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [running]);
  const phase = Math.floor(tick / 4) % 4;
  const count = 4 - (tick % 4);
  const rounds = Math.floor(tick / 16);
  const scale = phase === 0 ? 0.6 + (tick % 4) * 0.13 : phase === 1 ? 1 : phase === 2 ? 1 - (tick % 4) * 0.13 : 0.6;
  return (
    <div className="flex flex-col items-center py-4 text-center">
      <div className="relative grid size-56 place-items-center">
        <div className="absolute inset-0 rounded-full bg-blush-100" aria-hidden />
        <div
          className="absolute inset-4 rounded-full bg-brand-gradient opacity-90 transition-transform duration-1000 ease-in-out motion-reduce:transition-none"
          style={{ transform: `scale(${running ? scale : 0.7})` }}
          aria-hidden
        />
        <div className="relative text-white" aria-live="polite">
          <p className="text-lg font-bold">{running ? PHASES[phase] : "Ready?"}</p>
          {running && <p className="text-4xl font-extrabold">{count}</p>}
        </div>
      </div>
      <p className="mt-4 text-sm text-ink-600">Box breathing: in for 4, hold for 4, out for 4, hold for 4. Try 3–4 rounds.</p>
      {running && <p className="mt-1 text-xs text-ink-500">Rounds completed: {rounds}</p>}
      <Button variant={running ? "secondary" : "primary"} className="mt-4" onClick={() => { setRunning((r) => !r); if (running) setTick(0); }}>
        {running ? <><Pause className="size-4" aria-hidden /> Stop</> : <><Play className="size-4" aria-hidden /> Start</>}
      </Button>
    </div>
  );
}

const GROUNDING = [
  ["5", "things you can see", "Look around slowly. Name them in your head."],
  ["4", "things you can feel", "Your feet on the floor, your clothes, the chair…"],
  ["3", "things you can hear", "Near and far sounds."],
  ["2", "things you can smell", "Or two smells you like."],
  ["1", "thing you can taste", "Or one thing you're grateful for."],
] as const;

function Grounding() {
  const [step, setStep] = useState(0);
  const done = step >= GROUNDING.length;
  return (
    <div className="py-2">
      <p className="mb-4 text-sm text-ink-600">The 5-4-3-2-1 exercise brings your attention back to the present moment.</p>
      <ol className="space-y-2">
        {GROUNDING.map(([n, title, hint], i) => (
          <li key={n} className={clsx("flex items-start gap-3 rounded-xl p-3 transition", i === step ? "bg-brand-50 ring-1 ring-brand-200" : i < step ? "bg-ink-50 opacity-70" : "bg-ink-50")}>
            <span className={clsx("grid size-9 shrink-0 place-items-center rounded-full text-lg font-extrabold", i <= step ? "bg-brand-600 text-white" : "bg-white text-ink-500")}>{n}</span>
            <span>
              <span className="block font-bold text-ink-900">{title}</span>
              <span className="block text-sm text-ink-600">{hint}</span>
            </span>
          </li>
        ))}
      </ol>
      <div className="mt-4 flex gap-2">
        {done ? (
          <>
            <p className="flex-1 self-center text-sm font-semibold text-emerald-700" role="status">Well done. Notice how you feel now.</p>
            <Button variant="secondary" onClick={() => setStep(0)}>Start again</Button>
          </>
        ) : (
          <Button onClick={() => setStep((s) => s + 1)}>{step === 0 ? "I've found 5" : "Next"}</Button>
        )}
      </div>
    </div>
  );
}

const MUSCLES = ["Hands — make fists", "Shoulders — lift them to your ears", "Face — scrunch it up", "Stomach — tighten it", "Legs & feet — point your toes"];

function Muscle() {
  return (
    <div className="py-2">
      <p className="mb-4 text-sm text-ink-600">For each area: tense for 5 seconds, then let go completely for 10 seconds and notice the difference.</p>
      <ol className="list-decimal space-y-2 pl-5 text-sm text-ink-800">
        {MUSCLES.map((m) => <li key={m}>{m}</li>)}
      </ol>
      <p className="mt-4 text-sm text-ink-600">Finish with three slow breaths.</p>
    </div>
  );
}

export function Exercises({ initial }: { initial: Exercise }) {
  const [current, setCurrent] = useState<Exercise>(initial);
  const tabs: Array<[Exercise, string, typeof Wind]> = [
    ["breathing", "Breathing", Wind],
    ["grounding", "5-4-3-2-1", Hand],
    ["muscle", "Relax muscles", Activity],
  ];
  return (
    <section aria-labelledby="ex-title" className="rounded-2xl bg-white p-5 shadow-[var(--shadow-card)] ring-1 ring-ink-100">
      <h2 id="ex-title" className="text-base font-bold">Guided exercises</h2>
      <div role="tablist" aria-label="Exercises" className="mt-3 flex gap-1 rounded-xl bg-ink-50 p-1">
        {tabs.map(([key, label, Icon]) => (
          <button key={key} role="tab" type="button" aria-selected={current === key} onClick={() => setCurrent(key)} className={clsx("flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-sm font-semibold", current === key ? "bg-white text-brand-700 shadow-sm" : "text-ink-600")}>
            <Icon className="size-4" aria-hidden /> {label}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="mt-2">
        {current === "breathing" && <Breathing />}
        {current === "grounding" && <Grounding />}
        {current === "muscle" && <Muscle />}
      </div>
    </section>
  );
}
