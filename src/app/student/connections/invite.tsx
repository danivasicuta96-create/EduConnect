"use client";

import { ActionForm, SubmitButton } from "@/components/forms";
import { inviteAction } from "../connect/actions";

export function InviteToGroup({ inviteeId, groups }: { inviteeId: string; groups: Array<{ id: string; name: string }> }) {
  if (groups.length === 0) return null;
  return (
    <ActionForm action={inviteAction} className="flex items-center gap-1.5">
      <input type="hidden" name="inviteeId" value={inviteeId} />
      <label htmlFor={`g-${inviteeId}`} className="sr-only">Study group</label>
      <select id={`g-${inviteeId}`} name="groupId" className="h-8 max-w-36 rounded-lg border-0 bg-white px-2 text-xs ring-1 ring-ink-200">
        {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
      </select>
      <SubmitButton size="sm" variant="soft">Invite</SubmitButton>
    </ActionForm>
  );
}
