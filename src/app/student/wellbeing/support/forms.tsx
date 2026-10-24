"use client";

import { ActionForm, SubmitButton, Textarea } from "@/components/forms";
import { requestContactAction, respondSessionAction } from "../actions";

export function RequestContactForm() {
  return (
    <ActionForm action={requestContactAction} className="space-y-3">
      <p className="text-sm text-ink-600">
        Ask a counselor to reach out to you. Only school staff authorised for student support will see this request.
      </p>
      <div>
        <label htmlFor="contact-message" className="mb-1.5 block text-sm font-semibold">Anything you&apos;d like them to know? <span className="font-normal text-ink-500">(optional)</span></label>
        <Textarea id="contact-message" name="message" maxLength={300} placeholder="e.g. I'd like to talk about exam stress" />
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="urgent" className="mt-0.5 size-4 accent-brand-600" />
        <span>It&apos;s important — I&apos;d like to talk soon</span>
      </label>
      <SubmitButton pendingText="Sending…">Ask a counselor to reach out</SubmitButton>
    </ActionForm>
  );
}

export function SessionResponse({ sessionId }: { sessionId: string }) {
  return (
    <ActionForm action={respondSessionAction} className="mt-3 space-y-2">
      <input type="hidden" name="sessionId" value={sessionId} />
      <label htmlFor={`msg-${sessionId}`} className="sr-only">Message (optional)</label>
      <Textarea id={`msg-${sessionId}`} name="message" rows={2} maxLength={500} placeholder="Optional message, e.g. a better time" />
      <div className="flex gap-2">
        <SubmitButton size="sm" name="accept" value="yes">Accept</SubmitButton>
        <SubmitButton size="sm" variant="secondary" name="accept" value="no">Not now</SubmitButton>
      </div>
    </ActionForm>
  );
}
