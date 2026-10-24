"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import clsx from "clsx";
import { ArrowRight, Heart } from "lucide-react";
import { ChipGroup, FormMessage, SubmitButton, Textarea } from "@/components/forms";
import { buttonClass } from "@/components/ui";
import { CHECKIN_FACTORS, EXPERIENCE_OPTIONS } from "@/lib/constants";
import type { ActionState } from "@/lib/action-state";
import type { Suggestion } from "@/lib/services/wellbeing";
import { submitCheckinAction } from "./actions";

const MOOD_FACES = ["😣", "😖", "😟", "😕", "😐", "🙂", "😊", "😄", "😁", "🤩"];

export interface CheckinDefaults {
  mood: number | null;
  experience: string | null;
  factors: string[];
  note: string | null;
  shareNote: boolean;
}

export function CheckinForm({ defaults, isUpdate }: { defaults: CheckinDefaults; isUpdate: boolean }) {
  const [state, action] = useActionState(submitCheckinAction, { ok: false } as ActionState);
  const [mood, setMood] = useState<number | null>(defaults.mood);
  if (state.ok) {
    const suggestions = (state.data?.suggestions ?? []) as Suggestion[];
    return (
      <div className="animate-fade-up space-y-5" role="status">
        <div className="rounded-3xl bg-brand-gradient p-6 text-white">
          <Heart className="size-8" aria-hidden />
          <h2 className="mt-3 text-2xl font-extrabold">Thanks for checking in</h2>
          <p className="mt-1 text-white/90">However today went, it&apos;s okay. Here are a few ideas that might help.</p>
        </div>
        <ul className="grid gap-3 sm:grid-cols-3">
          {suggestions.map((s) => (
            <li key={s.key} className="rounded-2xl bg-white p-4 shadow-[var(--shadow-card)] ring-1 ring-ink-100">
              <p className="font-bold text-ink-900">{s.title}</p>
              <p className="mt-1 text-sm text-ink-600">{s.body}</p>
              {s.href && (
                <Link href={s.href} className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">
                  Open <ArrowRight className="size-3.5" aria-hidden />
                </Link>
              )}
            </li>
          ))}
        </ul>
        <p className="text-xs text-ink-500">These are general wellbeing tips, not medical advice.</p>
        <div className="flex flex-wrap gap-2">
          <Link href="/student/wellbeing/history" className={buttonClass("primary")}>See my trends</Link>
          <button type="button" className={buttonClass("secondary")} onClick={() => window.location.reload()}>Edit today&apos;s check-in</button>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-7">
      <fieldset>
        <legend className="text-lg font-bold text-ink-900">How do you feel today?</legend>
        <p className="mb-3 text-sm text-ink-500">1 = really bad, 10 = amazing</p>
        <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
          {MOOD_FACES.map((face, i) => {
            const value = i + 1;
            return (
              <label key={value} className="cursor-pointer">
                <input type="radio" name="mood" value={value} checked={mood === value} onChange={() => setMood(value)} className="peer sr-only" required />
                <span
                  className={clsx(
                    "flex flex-col items-center rounded-2xl py-2.5 ring-1 transition peer-focus-visible:outline peer-focus-visible:outline-3 peer-focus-visible:outline-brand-500",
                    mood === value ? "bg-brand-600 text-white ring-brand-600 shadow-[var(--shadow-pop)]" : "bg-white text-ink-700 ring-ink-200 hover:ring-brand-300",
                  )}
                >
                  <span className="text-2xl" aria-hidden>{face}</span>
                  <span className="text-sm font-bold">{value}</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-lg font-bold text-ink-900">How was school overall?</legend>
        <div className="flex flex-wrap gap-2">
          {Object.entries(EXPERIENCE_OPTIONS).map(([value, o]) => (
            <label key={value} className="cursor-pointer">
              <input type="radio" name="experience" value={value} defaultChecked={defaults.experience === value} className="peer sr-only" />
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-sm font-semibold text-ink-700 ring-1 ring-ink-200 transition peer-checked:bg-ink-900 peer-checked:text-white peer-checked:ring-ink-900 peer-focus-visible:outline peer-focus-visible:outline-3 peer-focus-visible:outline-brand-500">
                <span aria-hidden>{o.emoji}</span> {o.label}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <ChipGroup
        name="factors"
        legend="What affected your day? (optional)"
        options={Object.entries(CHECKIN_FACTORS).map(([value, label]) => ({ value, label }))}
        defaultValue={defaults.factors}
      />

      <div>
        <label htmlFor="note" className="mb-1.5 block text-sm font-semibold text-ink-800">
          Private note <span className="font-normal text-ink-500">(optional — only you can read it)</span>
        </label>
        <Textarea id="note" name="note" defaultValue={defaults.note ?? ""} maxLength={2000} rows={3} placeholder="Anything you want to remember about today…" />
        <label className="mt-2 flex items-start gap-2 text-sm text-ink-600">
          <input type="checkbox" name="shareNote" defaultChecked={defaults.shareNote} className="mt-0.5 size-4 accent-brand-600" />
          <span>Share this note with the school counselor if they follow up with me</span>
        </label>
      </div>

      <FormMessage state={state} />
      <SubmitButton size="lg" pendingText="Saving…" disabled={mood === null}>
        {isUpdate ? "Update check-in" : "Save check-in"}
      </SubmitButton>
    </form>
  );
}
