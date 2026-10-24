"use client";

import { ShieldCheck, Info } from "lucide-react";
import { ActionForm, Field, Input, SubmitButton } from "@/components/forms";
import { AvatarPicker, StudentProfileFields, type ProfileDefaults } from "@/components/profile-form";
import { Card, Notice } from "@/components/ui";
import { CONSENT_LABELS, ROLE_LABELS, type Role } from "@/lib/constants";
import { completeStaffOnboarding, completeStudentOnboarding } from "./actions";

const consentText: Record<string, string> = {
  wellbeing_checkins:
    "A one-minute daily check-in. Your notes stay private to you. Scores are used for your own trends and in anonymous class totals (groups of 5+). If scores stay low for a while, a trained school counselor may be told so they can offer support. Never your teachers or classmates.",
  matchmaking: "Suggest classmates at your school with similar interests, and let you send and accept connection requests.",
  ai_features: "Use the AI tutor and wellbeing assistant. Chats aren't saved by EduConnect and are never used for matchmaking or advertising.",
};

export function StudentOnboarding({ profile, interests, canConsent, pending }: { profile: ProfileDefaults; interests: Array<{ id: number; label: string; category: string }>; canConsent: boolean; pending: boolean }) {
  return (
    <ActionForm action={completeStudentOnboarding}>
      {(state) => (
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">Let&apos;s set up your profile 👋</h1>
            <p className="mt-1 text-ink-500">It takes about two minutes. You can change everything later.</p>
          </div>
          <Card>
            <StudentProfileFields defaults={profile} interests={interests} state={state} />
          </Card>
          <Card>
            <h2 className="mb-1 flex items-center gap-2 text-lg font-bold"><ShieldCheck className="size-5 text-brand-600" aria-hidden /> Your choices</h2>
            {pending ? (
              <Notice tone="amber" icon={Info} title="Waiting for your parent or guardian">
                Because you&apos;re under 16, your school needs a parent or guardian&apos;s consent before wellbeing check-ins,
                matchmaking and AI features are switched on. You can still see your grades, timetable and attendance.
              </Notice>
            ) : canConsent ? (
              <div className="mt-4 space-y-4">
                {(["wellbeing_checkins", "matchmaking", "ai_features"] as const).map((t) => (
                  <label key={t} className="flex items-start gap-3 rounded-xl bg-ink-50 p-4 text-sm">
                    <input type="checkbox" name={`consent_${t}`} defaultChecked className="mt-0.5 size-4 accent-brand-600" />
                    <span>
                      <span className="font-semibold">{CONSENT_LABELS[t]}</span>
                      <span className="mt-0.5 block text-ink-600">{consentText[t]}</span>
                    </span>
                  </label>
                ))}
                <p className="text-xs text-ink-500">You can withdraw any of these at any time in Settings.</p>
              </div>
            ) : (
              <Notice tone="blue" icon={Info}>
                Your parent or guardian&apos;s choices have been recorded by your school. You can review them, or switch features off, in Settings.
              </Notice>
            )}
          </Card>
          <div className="flex justify-end">
            <SubmitButton size="lg" pendingText="Saving…">Finish setup</SubmitButton>
          </div>
        </div>
      )}
    </ActionForm>
  );
}

export function StaffOnboarding({ role, defaults }: { role: Role; defaults: ProfileDefaults }) {
  return (
    <ActionForm action={completeStaffOnboarding}>
      {(state) => (
        <Card className="space-y-6">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">Welcome, {ROLE_LABELS[role].toLowerCase()}</h1>
            <p className="mt-1 text-ink-500">Confirm how you appear to others.</p>
          </div>
          <Field label="Display name" error={state.errors?.displayName}>
            {(id) => <Input id={id} name="displayName" defaultValue={defaults.displayName} required maxLength={60} />}
          </Field>
          <AvatarPicker defaults={defaults} />
          <label className="flex items-start gap-3 rounded-xl bg-blush-50 p-4 text-sm">
            <input type="checkbox" name="acknowledge" required className="mt-0.5 size-4 accent-brand-600" />
            <span>
              <span className="font-semibold">Confidentiality commitment</span>
              <span className="mt-0.5 block text-ink-600">
                I will access student information only as needed for my role, follow my school&apos;s safeguarding procedures, and never share
                student data outside approved channels. My access to sensitive records is logged.
              </span>
            </span>
          </label>
          <div className="flex justify-end">
            <SubmitButton size="lg" pendingText="Saving…">Continue</SubmitButton>
          </div>
        </Card>
      )}
    </ActionForm>
  );
}
