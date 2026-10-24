"use client";

import { useState } from "react";
import { Flag, Ban, X, UserPlus } from "lucide-react";
import { ActionButton, ActionForm, Select, SubmitButton, Textarea } from "@/components/forms";
import { Button } from "@/components/ui";
import { blockAction, dismissAction, reportAction, sendRequestAction } from "./actions";

export function ConnectButton({ otherId, name }: { otherId: string; name: string }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
        <UserPlus className="size-4" aria-hidden /> Connect
      </Button>
    );
  }
  return (
    <ActionForm action={sendRequestAction} className="w-full space-y-2">
      {(state) =>
        state.ok ? null : (
          <>
            <input type="hidden" name="addresseeId" value={otherId} />
            <label htmlFor={`msg-${otherId}`} className="block text-xs font-semibold text-ink-700">Say hi to {name.split(" ")[0]} (optional)</label>
            <Textarea id={`msg-${otherId}`} name="message" rows={2} maxLength={200} placeholder="Want to study for the maths test together?" />
            <div className="flex gap-2">
              <SubmitButton size="sm" pendingText="Sending…">Send request</SubmitButton>
              <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            </div>
          </>
        )
      }
    </ActionForm>
  );
}

export function DismissButton({ otherId }: { otherId: string }) {
  return (
    <ActionButton action={dismissAction} hidden={{ otherId }} variant="ghost" title="Not interested">
      <X className="size-4" aria-hidden /> Not now
    </ActionButton>
  );
}

export function SafetyMenu({ otherId, name, showBlock = true }: { otherId: string; name: string; showBlock?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="w-full">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="inline-flex items-center gap-1 text-xs font-semibold text-ink-500 hover:text-brand-700">
        <Flag className="size-3.5" aria-hidden /> Report or block
      </button>
      {open && (
        <div className="mt-2 space-y-3 rounded-xl bg-ink-50 p-3">
          {showBlock && (
            <ActionButton action={blockAction} hidden={{ otherId }} variant="danger" confirm={`Block ${name}? They won't be able to contact you or see you in suggestions.`}>
              <Ban className="size-4" aria-hidden /> Block {name.split(" ")[0]}
            </ActionButton>
          )}
          <ActionForm action={reportAction} className="space-y-2">
            {(state) =>
              state.ok ? null : (
                <>
                  <input type="hidden" name="reportedId" value={otherId} />
                  <label htmlFor={`reason-${otherId}`} className="block text-xs font-semibold">Report a problem</label>
                  <Select id={`reason-${otherId}`} name="reason" defaultValue="harassment">
                    <option value="harassment">Harassment or unwanted contact</option>
                    <option value="bullying">Bullying</option>
                    <option value="inappropriate">Inappropriate content</option>
                    <option value="spam">Spam</option>
                    <option value="other">Something else</option>
                  </Select>
                  <Textarea name="details" rows={2} maxLength={1000} placeholder="What happened? (optional)" aria-label="Details" />
                  <label className="flex items-center gap-2 text-xs"><input type="checkbox" name="alsoBlock" defaultChecked className="size-4 accent-brand-600" /> Also block this person</label>
                  <SubmitButton size="sm" variant="secondary" pendingText="Sending…">Send report</SubmitButton>
                </>
              )
            }
          </ActionForm>
          <p className="text-[11px] text-ink-500">Reports go to trained school staff, not to the person you report. If you feel unsafe, tell a trusted adult.</p>
        </div>
      )}
    </div>
  );
}
