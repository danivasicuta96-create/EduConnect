"use client";

import { ActionForm, SubmitButton } from "@/components/forms";
import { StudentProfileFields, type ProfileDefaults } from "@/components/profile-form";
import { saveProfileAction } from "./actions";

export function ProfileForm({ profile, interests }: { profile: ProfileDefaults; interests: Array<{ id: number; label: string; category: string }> }) {
  return (
    <ActionForm action={saveProfileAction}>
      {(state) => (
        <>
          <StudentProfileFields defaults={profile} interests={interests} state={state} />
          <div className="mt-6 flex justify-end">
            <SubmitButton size="lg" pendingText="Saving…">Save profile</SubmitButton>
          </div>
        </>
      )}
    </ActionForm>
  );
}
