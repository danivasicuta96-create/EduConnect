# EduConnect AI

A school platform that brings together **student connections**, **daily wellbeing check-ins**, **academic progress** and **school support**, with privacy and the protection of minors built in. Students use it as an Android app, installed by scanning a QR code. Teachers, counselors, administrators and parents use it in the browser.

> All demo people, schools and records are fictional.

## What's inside

| Area | Highlights |
|---|---|
| **Students** | Dashboard; explainable matchmaking with classmates; connections with block and report; study groups and activities; grades, attendance and timetable; target-grade calculator; learning goals; one-minute wellbeing check-in with private (encrypted) notes and personal trends; AI tutor (teaches, doesn't do homework; English/Romanian); wellbeing assistant with breathing and grounding exercises and deterministic crisis safeguards; "ask a counselor to reach out"; settings for consent, notifications, data export and deletion |
| **Teachers** | Class rosters, gradebook, attendance, assessments, academic analytics. Wellbeing for their classes only as k-anonymous aggregates (groups of 5+) |
| **Counselors** | Alert queue from configurable *example* rules (never a diagnosis), alert detail that separates observed data from automated suggestions, encrypted follow-up notes, support-conversation invitations, aggregate reports, rule configuration, support resources, safety reports |
| **Administrators** | Users and roles, invitations, staff permissions, classes/subjects/timetable, consent management (including under-16 guardian consent), audit log with CSV export, subscription and plans, retention settings |
| **Parents** | A linked child's grades and attendance, only with recorded consent. Never wellbeing data |
| **Public** | Landing, features, about, privacy and terms templates, `/install` page with a QR code |

## Tech stack

Next.js 16 (App Router, server actions) · React 19 · TypeScript · Tailwind CSS 4 · **MongoDB** (Atlas in production, embedded locally) · Capacitor (Android) · Anthropic Claude via the official SDK (optional; an offline demo provider is built in) · Vitest.

See **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** for the security model and **[docs/ANDROID.md](docs/ANDROID.md)** for the Android app.

## Run it locally

Requirements: Node.js 20.9+ (tested on 24), npm.

```bash
npm install
npm run dev          # http://localhost:3000
```

No configuration is needed. Without `MONGODB_URI`, an embedded MongoDB starts automatically, its data lives in `.data/mongo`, and a fictional demo school is seeded on first start. Open <http://localhost:3000/login> and use **Explore the demo** for one-click sign-in as a student, teacher, counselor, admin or parent.

Useful scripts:

| Command | What it does |
|---|---|
| `npm test` | Runs the test suite (engines, student, teacher, counselor and admin flows, tenant isolation) against an ephemeral embedded MongoDB |
| `npm run typecheck` | Generates Next route types and type-checks |
| `npm run lint` | ESLint |
| `npm run db:reset` | Deletes the local embedded database (stop the dev server first). It is re-seeded on the next start |
| `npm run db:init` | Connects to `MONGODB_URI`, creates indexes and seeds the demo if `DEMO_MODE` is not `false` |
| `npm run android:dev` / `android:apk` | Android app. See [docs/ANDROID.md](docs/ANDROID.md) |

## Configuration

Copy `.env.example` to `.env.local` for local overrides. In production, set these in **Netlify → Site configuration → Environment variables** (scopes: *Builds* and *Functions*). Never commit them.

| Variable | Required in production | Purpose |
|---|---|---|
| `MONGODB_URI` | ✅ | MongoDB Atlas connection string. Use an EU region for Romanian/EU schools |
| `MONGODB_DB` | – | Database name (default `educonnect`) |
| `DATA_ENCRYPTION_KEY` | ✅ | 32 random bytes, base64. Encrypts check-in notes, counselor notes and support messages. Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`. **Back it up**: losing it makes those fields unreadable |
| `APP_URL` | ✅ | Public URL, e.g. `https://educonnectnova.netlify.app`. Used in emails and the install QR code |
| `DEMO_MODE` | ✅ | `true` seeds the fictional demo school during the build and enables one-click demo sign-in (good for testing on phones); `false` for a real school |
| `ANTHROPIC_API_KEY` | optional | Enables the real AI tutor and assistant (`AI_MODEL` defaults to `claude-opus-5-5`). Without it, the offline demo provider is used |
| `RESEND_API_KEY`, `EMAIL_FROM` | optional | Email delivery for invitations and password resets |

## Deploy to production (Netlify + MongoDB Atlas)

Live site: **https://educonnectnova.netlify.app** · Android install page: **https://educonnectnova.netlify.app/install**

1. **Atlas**
   - Cluster in an EU region; a database user with read/write on `educonnect`. If a password was ever shared in plain text (chat, email, a commit), **rotate it**.
   - *Network Access* → allow `0.0.0.0/0` (Netlify functions and builds have no fixed IPs), protected by a strong password.
2. **Netlify** (the repo is connected; every push to `main` deploys). In *Site configuration → Environment variables* add, for scopes **Builds** and **Functions**:
   - `MONGODB_URI` — the Atlas connection string
   - `DATA_ENCRYPTION_KEY` — `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` (back it up)
   - `DEMO_MODE` — `true` while testing with the fictional school, `false` for real use
   - optional: `APP_URL=https://educonnectnova.netlify.app`, `ANTHROPIC_API_KEY`, `RESEND_API_KEY` + `EMAIL_FROM`
   
   Then *Deploys → Trigger deploy*. `netlify.toml` runs `npm run db:init` (indexes, reference data and — with `DEMO_MODE=true` — the demo school, once) before `next build`.
3. **Real school**: with `DEMO_MODE=false`, create it with `npm run school:create -- "School name" JOIN-CODE admin@school.ro` (run locally with the production `MONGODB_URI` and `DATA_ENCRYPTION_KEY`). It prints a one-time sign-up link for the administrator.
4. **Android app**: the signed APK is committed at `public/downloads/educonnect.apk` and served at `/downloads/educonnect.apk`; students scan the QR on `/install`. To publish a new version see [docs/ANDROID.md](docs/ANDROID.md).

The backend runs on Netlify (Next.js server functions). The Android app is a native shell that loads it — database and AI credentials never ship inside the APK.

## Security & privacy summary

- **School isolation**: every school-owned document carries `school_id`. Services can only reach data through a tenant-scoped wrapper that forces the caller's school into every query and refuses to change it.
- **Least privilege**:
  - Teachers never see individual check-ins.
  - Counselors see individual scores only for students with an active or recent alert, and notes only when the student chose to share them.
  - Administrators don't see wellbeing content.
  - Parents need recorded consent.
- **Encryption**: TLS in transit (Netlify and Atlas). Atlas encrypts data at rest, and the app additionally encrypts the most sensitive free text with AES-256-GCM.
- **Accounts**:
  - scrypt password hashing;
  - opaque, hashed, expiring sessions in httpOnly cookies;
  - login lockout and rate limits;
  - server-side validation (zod) on every input;
  - security headers including a CSP.
- **Audit logs** record sensitive views and every privileged change, with IDs and counts only.
- **Minors**: under-16 accounts wait for guardian consent before check-ins, matchmaking or AI are switched on. Consent can be withdrawn at any time.
- **AI**: chats aren't stored. A deterministic crisis screen runs before any model and shows 112 / 116 111. The assistant never presents itself as a therapist or offers a diagnosis.
- **Not claimed**: GDPR compliance, end-to-end encryption, or clinical validation of the alert thresholds. The privacy notice and terms are **templates that need legal review**. Support phone numbers should be verified by each school.

## Project structure

```
src/app/            routes: (public) site, (auth), onboarding, student/, teacher/, counselor/, admin/, parent/, (shared)/ settings & notifications, api/
src/components/     UI kit, forms, charts, chat, app shell
src/lib/db/         MongoDB connection, tenant guard, field encryption, demo seed
src/lib/authz.ts    relationship-based authorization rules
src/lib/services/   business logic per area (all data access goes through here)
src/lib/engines/    pure logic: grades, matchmaking, alert rules, safety screen
src/lib/ai/         provider-independent AI layer (Claude + demo)
android/            Capacitor Android project (open in Android Studio)
tests/              Vitest suites
```
