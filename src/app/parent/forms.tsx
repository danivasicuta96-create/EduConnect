"use client";

import { ActionForm, SubmitButton } from "@/components/forms";
import { CONSENT_LABELS } from "@/lib/constants";
import { saveGuardianConsent } from "./actions";

const TEXT: Record<string, string> = {
  platform: "Your child can use EduConnect AI for grades, timetable and attendance. Required for the account to be active.",
  wellbeing_checkins:
    "A one-minute daily check-in. Answers stay private to your child — parents and teachers never see them. If scores stay low for a while, a trained school counselor may offer support.",
  matchmaking: "Suggests classmates at the same school with similar interests for study partners, projects and clubs.",
  ai_features: "The AI tutor and wellbeing assistant. Chats aren't saved by EduConnect and are never used for advertising.",
};

const TYPES = ["platform", "wellbeing_checkins", "matchmaking", "ai_features"] as const;

export function GuardianConsentForm({ studentId, childName, current }: { studentId: string; childName: string; current: Record<string, boolean | null> }) {
  return (
    <ActionForm action={saveGuardianConsent}>
      <input type="hidden" name="studentId" value={studentId} />
      <div className="space-y-3">
        {TYPES.map((t) => (
          <fieldset key={t} className="rounded-xl bg-ink-50 p-3">
            <legend className="sr-only">{CONSENT_LABELS[t]} for {childName}</legend>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="text-sm">
                <p className="font-semibold text-ink-800" aria-hidden>{CONSENT_LABELS[t]}</p>
                <p className="mt-0.5 text-ink-600">{TEXT[t]}</p>
              </div>
              <div className="flex shrink-0 gap-1 rounded-xl bg-white p-1 text-sm ring-1 ring-ink-100">
                {([["yes", "Allow"], ["no", "Don't allow"]] as const).map(([v, label]) => (
                  <label key={v} className="cursor-pointer">
                    <input
                      type="radio"
                      name={t}
                      value={v}
                      defaultChecked={current[t] === null ? false : current[t] === (v === "yes")}
                      className="peer sr-only"
                    />
                    <span className="block rounded-lg px-3 py-1 font-semibold text-ink-600 peer-checked:bg-brand-600 peer-checked:text-white peer-focus-visible:outline-2 peer-focus-visible:outline-brand-500">
                      {label}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </fieldset>
        ))}
      </div>
      <p className="mt-3 text-xs text-ink-500">You can change these choices at any time. Each change is recorded with the date.</p>
      <div className="mt-3">
        <SubmitButton size="sm" pendingText="Saving…">Save choices</SubmitButton>
      </div>
    </ActionForm>
  );
}
