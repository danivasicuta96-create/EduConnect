"use client";

import { useState } from "react";
import clsx from "clsx";
import { ChipGroup, Field, Input, Select, Textarea } from "./forms";
import { Avatar } from "./ui";
import { AVATAR_COLORS, GOAL_OPTIONS, LEARNING_STYLES, OPEN_TO } from "@/lib/constants";
import type { ActionState } from "@/lib/action-state";

export interface ProfileDefaults {
  displayName: string;
  avatarColor: string;
  avatarEmoji: string | null;
  bio?: string | null;
  learningStyle?: string | null;
  goals?: string[];
  clubs?: string[];
  openTo?: string[];
  discoverable?: boolean;
  showClass?: boolean;
  interestIds?: number[];
}

const EMOJIS = ["", "🎸", "🎨", "⚽", "💻", "📚", "🔬", "🎮", "🌱", "🎭", "🏀", "🦊", "⭐", "🚀"];

export function AvatarPicker({ defaults }: { defaults: Pick<ProfileDefaults, "displayName" | "avatarColor" | "avatarEmoji"> }) {
  const [color, setColor] = useState(defaults.avatarColor);
  const [emoji, setEmoji] = useState(defaults.avatarEmoji ?? "");
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <Avatar name={defaults.displayName} color={color} emoji={emoji} size="lg" />
      <div className="space-y-3">
        <fieldset>
          <legend className="mb-1.5 text-sm font-semibold text-ink-800">Colour</legend>
          <div className="flex flex-wrap gap-2">
            {AVATAR_COLORS.map((c) => (
              <label key={c} className="cursor-pointer">
                <input type="radio" name="avatarColor" value={c} checked={color === c} onChange={() => setColor(c)} className="peer sr-only" />
                <span className="block rounded-full ring-2 ring-transparent ring-offset-2 peer-checked:ring-brand-500 peer-focus-visible:ring-brand-500">
                  <Avatar name=" " color={c} size="sm" />
                </span>
                <span className="sr-only">{c}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-1.5 text-sm font-semibold text-ink-800">Emoji (optional)</legend>
          <div className="flex flex-wrap gap-1.5">
            {EMOJIS.map((e) => (
              <label key={e || "none"} className="cursor-pointer">
                <input type="radio" name="avatarEmoji" value={e} checked={emoji === e} onChange={() => setEmoji(e)} className="peer sr-only" />
                <span className={clsx("grid size-9 place-items-center rounded-lg text-lg ring-1 ring-ink-200 peer-checked:bg-brand-50 peer-checked:ring-2 peer-checked:ring-brand-500")}>
                  {e || <span className="text-xs font-semibold text-ink-500">Aa</span>}
                </span>
                <span className="sr-only">{e || "Initials"}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>
    </div>
  );
}

export function StudentProfileFields({ defaults, interests, state }: { defaults: ProfileDefaults; interests: Array<{ id: number; label: string; category: string }>; state: ActionState }) {
  const categories = [...new Set(interests.map((i) => i.category))];
  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <h2 className="text-lg font-bold">About you</h2>
        <Field label="Display name" hint="— use an alias if you prefer" error={state.errors?.displayName}>
          {(id) => <Input id={id} name="displayName" defaultValue={defaults.displayName} required maxLength={60} />}
        </Field>
        <AvatarPicker defaults={defaults} />
        <Field label="Short bio" hint="(optional, visible to classmates who can see your profile)" error={state.errors?.bio}>
          {(id) => <Textarea id={id} name="bio" defaultValue={defaults.bio ?? ""} maxLength={280} placeholder="Learning Python and playing guitar 🎸" />}
        </Field>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-bold">Interests</h2>
        <p className="-mt-2 text-sm text-ink-500">Used to suggest classmates, study groups and activities. Choose up to 10.</p>
        {categories.map((cat) => (
          <ChipGroup
            key={cat}
            name="interests"
            legend={cat}
            options={interests.filter((i) => i.category === cat).map((i) => ({ value: String(i.id), label: i.label }))}
            defaultValue={(defaults.interestIds ?? []).map(String)}
          />
        ))}
        {state.errors?.interestIds && <p className="text-sm text-red-700">{state.errors.interestIds[0]}</p>}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-bold">Learning</h2>
        <ChipGroup name="goals" legend="My goals this year" max={4} options={Object.entries(GOAL_OPTIONS).map(([value, label]) => ({ value, label }))} defaultValue={defaults.goals} />
        {state.errors?.goals && <p className="text-sm text-red-700">{state.errors.goals[0]}</p>}
        <Field label="How I learn best">
          {(id) => (
            <Select id={id} name="learningStyle" defaultValue={defaults.learningStyle ?? ""}>
              <option value="">Not sure yet</option>
              {Object.entries(LEARNING_STYLES).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Clubs & projects" hint="(optional, comma-separated)">
          {(id) => <Input id={id} name="clubs" defaultValue={(defaults.clubs ?? []).join(", ")} placeholder="School choir, Eco club" />}
        </Field>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-bold">Privacy & discoverability</h2>
        <ChipGroup name="openTo" legend="I'm open to" options={Object.entries(OPEN_TO).map(([value, label]) => ({ value, label }))} defaultValue={defaults.openTo ?? ["study_partner", "project", "club"]} />
        <div className="space-y-3 rounded-2xl bg-ink-50 p-4">
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" name="discoverable" defaultChecked={defaults.discoverable ?? true} className="mt-0.5 size-4 accent-brand-600" />
            <span>
              <span className="font-semibold">Let classmates in my school discover me</span>
              <span className="block text-ink-500">Only students at your school can see you, and only your display name, avatar, bio, interests and goals. Never your grades, check-ins or contact details.</span>
            </span>
          </label>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" name="showClass" defaultChecked={defaults.showClass ?? true} className="mt-0.5 size-4 accent-brand-600" />
            <span>
              <span className="font-semibold">Show my grade level on my profile</span>
            </span>
          </label>
        </div>
      </section>
    </div>
  );
}
