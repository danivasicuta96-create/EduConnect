# EduConnect AI — Architecture & conventions

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Server Components, Server Actions), React 19, TypeScript |
| Styling | Tailwind CSS v4 with design tokens in `src/app/globals.css` |
| Database | **MongoDB** (production: MongoDB Atlas via `MONGODB_URI`; local dev & tests: embedded `mongodb-memory-server`, persisted to `.data/mongo`) |
| Authorization | Application layer: tenant-scoped collections (`src/lib/db/tenant.ts`) + relationship rules (`src/lib/authz.ts`) + role/permission checks in services |
| Sensitive fields | AES-256-GCM application-level encryption (`src/lib/db/field-crypto.ts`, key `DATA_ENCRYPTION_KEY`) |
| Auth | Email + password (scrypt), opaque session tokens stored hashed in `auth_sessions` (TTL index), httpOnly cookie |
| Mobile | Capacitor Android shell that loads the hosted app (see `docs/ANDROID.md`) |
| AI | Provider-independent layer in `src/lib/ai/` — Claude via the official SDK, plus a deterministic demo provider |
| Tests | Vitest against an ephemeral embedded MongoDB |

> Cache Components is intentionally disabled (`next.config.ts`): pages are per-user and much of the data is sensitive.
> Next.js 16 differs from older versions; the bundled docs are in `node_modules/next/dist/docs/`.

## Request flow

```
page.tsx (Server Component)          actions.ts ("use server")
   │  requireUser(["teacher"])          │  assertUser(["teacher"]) → zod parse
   ▼                                    ▼
src/lib/services/*.ts   ← business logic: assertRole / assertPermission + authz.ts rules
   │  const t = tenant(actor)           ← every query forced to the actor's school
   ▼
MongoDB
```

### The security model (MongoDB has no row-level security)

1. **Tenant isolation — structural.** Services access school data only through `tenant(actor)`.
   Each collection wrapper adds `school_id: actor.schoolId` to every filter, stamps it on every insert,
   refuses updates that touch `school_id`, and prepends a `$match` to aggregations. Cross-school access
   is impossible through this API no matter which ids are passed in.
2. **Relationship rules — explicit.** `src/lib/authz.ts` mirrors the former RLS policies
   (`canTeach`, `teachesClass`, `isEnrolled`, `isGuardianOf`, `canContact`, `hasAlertFor`, `canReadAcademics`, …).
   Every service function must check the relevant rule before reading or writing on behalf of a user,
   and must always constrain user-owned data by the actor (e.g. `{ student_id: actor.id }`).
3. **Privileged access — rare and audited.** `system()` / `col()` from `src/lib/db/mongo.ts` bypass tenant
   scoping. Only for: authentication & sessions, the alert engine, `notify()`, `audit()`, the seed, platform-wide
   reference data (interests, plans, platform support resources), and audited administrator operations that
   must cross the user/credential boundary. Always authorise first.
4. **Encryption at rest for free text.** Check-in notes (`note_enc`), self-referral messages (`message_enc`),
   counselor follow-up notes (`note_enc`), alert resolutions (`resolution_enc`) and students' session
   messages (`student_message_enc`) are encrypted with `encryptField()` and read with `decryptField()`.

### Who sees what (enforced in services)

* Students: only their own grades, attendance, check-ins, notes, goals; other students' public profile
  fields only when discoverable/connected; never anyone's wellbeing data.
* Teachers: grades/attendance only for classes+subjects they teach (`canTeach`), homeroom read access;
  **never individual check-ins** — only `classSummary()` from `services/wellbeing-aggregates.ts` (k = 5 suppression).
* Staff with `wellbeing.alerts`: alerts; individual check-in **scores** only for students with a recent alert
  (`hasAlertFor`); notes only when the student shared them (`note_shared`).
* Administrators: school structure, users, consent, audit; **no wellbeing content** unless granted a wellbeing permission.
* Parents: linked child's academics only with `guardian_access` consent (`isGuardianOf`). Never wellbeing.

## Data model

Collections are listed in `COLLECTIONS` (`src/lib/db/mongo.ts`); indexes are created on startup.
Documents use string UUID `_id`s (`newId()`), snake_case fields, `school_id` on every school-owned
document, `Date` for timestamps and `"YYYY-MM-DD"` strings for calendar dates (`date`, `due_date`,
`graded_on`). Notable shapes:

* `profiles` `_id` = user id; `student_profiles` `_id` = user id, with `interest_ids: number[]`.
* `connections` carry `pair` = `pairKey(a, b)` (unique) for one row per pair.
* `wb_checkins`: `{ student_id, date, mood, experience, factors, note_enc, note_shared }` (unique student+date).
* `wb_alerts`: `{ student_id, rule_id, source: "rule" | "self_referral", severity, status, summary, observed, window_start, window_end, assigned_to, acknowledged_by, acknowledged_at, resolved_at, resolution_enc, message_enc }`.
* `wb_followups`: `{ alert_id, author_id, action, note_enc, system_note }` — append-only.
* `consent_records`: newest record per `(subject_id, consent_type)` wins.
* `audit_logs`: `{ school_id, actor_id, action, resource_type, resource_id, metadata, created_at }` — IDs and counts only.

## Conventions

* **Services** (`src/lib/services/<area>.ts`): export async functions taking `actor: Actor` (see `actor.ts`; `CurrentUser` satisfies it). Validate with zod schemas exported from the same file. Throw `UserFacingError` for messages safe to show, `AuthorizationError` for permission problems. Map `_id` → `id` when returning rows.
* **Server actions** (`src/app/<portal>/.../actions.ts`): `(prev: ActionState, formData: FormData) => Promise<ActionState>`. Call `assertUser([...roles])`, parse, call the service in `try { } catch (e) { return fromError(e) }`, then `revalidatePath(...)` and `return ok("Saved")`.
* **Forms / UI**: `src/components/forms.tsx`, `src/components/ui.tsx`, `src/components/charts.tsx`, `SubNav`.
* **Audit**: `audit({ schoolId, actorId, action, ... })` for sensitive reads and every privileged write.
* **Notifications**: `notify(schoolId, userIds, {...})`. Sensitive ones use neutral wording and `sensitive: true`.
* **Dates**: school-local dates via `todayIn(user.timezone)`; helpers in `src/lib/dates.ts`.
* **Language**: neutral, non-diagnostic wording in anything wellbeing-related.

## Demo data

`src/lib/db/seed.ts` creates two fictional schools on first start (when `DEMO_MODE` is not `false`). Dates are relative to today. Alerts in the demo are produced by the real rule engine.

Development-only helper for automated checks: `GET /api/dev/login?email=<demo email>` sets a session cookie (404 in production or when demo mode is off).
