// MongoDB connection, collections and indexes.
//
// Production: MONGODB_URI (e.g. MongoDB Atlas in an EU region) — required.
// Local development / tests without MONGODB_URI: an embedded MongoDB
// (mongodb-memory-server), persisted to .data/mongo unless MONGO_MEMORY=ephemeral.
//
// Access control: MongoDB has no row-level security, so application code must
// go through `tenant(actor)` (see ./tenant.ts), which scopes every query to
// the caller's school, plus the explicit checks in src/lib/authz.ts. Only
// trusted server code (auth, alert engine, notifications, seed) uses `system()`.

import { MongoClient, type Collection, type Db as MongoDb, type Document } from "mongodb";
import { randomUUID } from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";

export const COLLECTIONS = {
  schools: "schools",
  users: "auth_users",
  sessions: "auth_sessions",
  passwordResets: "auth_password_resets",
  profiles: "profiles",
  staffPermissions: "staff_permissions",
  invitations: "invitations",
  classes: "classes",
  enrollments: "enrollments",
  subjects: "subjects",
  teachingAssignments: "teaching_assignments",
  timetable: "timetable_entries",
  assessments: "assessments",
  grades: "grades",
  attendance: "attendance",
  goals: "learning_goals",
  interests: "interests",
  studentProfiles: "student_profiles",
  connections: "connections",
  blocks: "blocks",
  dismissals: "match_dismissals",
  reports: "reports",
  groups: "study_groups",
  groupMembers: "study_group_members",
  activities: "school_activities",
  announcements: "announcements",
  checkins: "wb_checkins",
  alertRules: "wb_alert_rules",
  alerts: "wb_alerts",
  followups: "wb_followups",
  supportSessions: "wb_support_sessions",
  supportResources: "support_resources",
  guardianLinks: "guardian_links",
  consents: "consent_records",
  notifications: "notifications",
  notificationPrefs: "notification_preferences",
  auditLogs: "audit_logs",
  plans: "subscription_plans",
  subscriptions: "school_subscriptions",
  billing: "billing_records",
} as const;

export type CollectionName = (typeof COLLECTIONS)[keyof typeof COLLECTIONS];

/** Collections without a school_id (global reference data or credential stores). */
export const GLOBAL_COLLECTIONS = new Set<string>([
  COLLECTIONS.users, COLLECTIONS.sessions, COLLECTIONS.passwordResets, COLLECTIONS.interests, COLLECTIONS.plans,
]);

/** Credential collections are never reachable through tenant(). */
export const PRIVILEGED_COLLECTIONS = new Set<string>([COLLECTIONS.users, COLLECTIONS.sessions, COLLECTIONS.passwordResets]);

export const newId = (): string => randomUUID();

/** Convert a stored document (`_id`) into an API row (`id`). */
export function toRow<T extends Document>(doc: T): Omit<T, "_id"> & { id: string } {
  const { _id, ...rest } = doc;
  return { id: String(_id), ...rest } as Omit<T, "_id"> & { id: string };
}

type State = { client: MongoClient; db: MongoDb; stop?: () => Promise<void> };
const g = globalThis as { __educonnectMongo?: Promise<State>; __educonnectMongoReady?: Promise<State> };
/** Marks code running inside the startup seed, which must not wait for "ready". */
const seeding = new AsyncLocalStorage<boolean>();

async function connect(): Promise<State> {
  const dbName = process.env.MONGODB_DB ?? "educonnect";
  let uri = process.env.MONGODB_URI;
  let stop: (() => Promise<void>) | undefined;
  if (!uri) {
    if (process.env.NODE_ENV === "production" && process.env.ALLOW_EMBEDDED_MONGO !== "true") {
      throw new Error("MONGODB_URI is not set. Configure it in your hosting provider's environment variables.");
    }
    const { MongoMemoryServer } = await import("mongodb-memory-server");
    const ephemeral = process.env.MONGO_MEMORY === "ephemeral";
    let dbPath: string | undefined;
    if (!ephemeral) {
      const fs = await import("node:fs");
      dbPath = process.env.MONGO_DATA_DIR ?? ".data/mongo";
      fs.mkdirSync(dbPath, { recursive: true });
    }
    const server = await MongoMemoryServer.create({ instance: dbPath ? { dbPath, storageEngine: "wiredTiger" } : {} });
    uri = server.getUri();
    stop = async () => {
      await server.stop({ doCleanup: ephemeral, force: false });
    };
  }
  const client = new MongoClient(uri, {
    maxPoolSize: Number(process.env.MONGODB_POOL_SIZE ?? 10),
    appName: "educonnect-ai",
  });
  await client.connect();
  const db = client.db(dbName);
  await ensureIndexes(db);
  return { client, db, stop };
}

function base(): Promise<State> {
  if (!g.__educonnectMongo) {
    g.__educonnectMongo = connect().catch((err) => {
      g.__educonnectMongo = undefined;
      throw err;
    });
  }
  return g.__educonnectMongo;
}

/** Connected, indexed and (in demo mode) seeded. */
function ready(): Promise<State> {
  if (!g.__educonnectMongoReady) {
    g.__educonnectMongoReady = base()
      .then(async (s) => {
        const { seedIfEmpty, seedReference } = await import("./seed");
        // Reference data (interests, plans, platform helplines) is tiny and idempotent.
        await seeding.run(true, () => seedReference(s.db));
        // The demo school is seeded on request only outside production. In
        // production it is seeded by `npm run db:init` (run in the Netlify build),
        // because a serverless request could time out half-way through.
        const seedOnRequest = process.env.NODE_ENV !== "production" || process.env.SEED_ON_REQUEST === "true";
        if (process.env.DEMO_MODE !== "false" && process.env.SKIP_AUTO_SEED !== "true" && seedOnRequest) {
          await seeding.run(true, () => seedIfEmpty(s.db));
        }
        return s;
      })
      .catch((err) => {
        g.__educonnectMongoReady = undefined;
        throw err;
      });
  }
  return g.__educonnectMongoReady;
}

function state(): Promise<State> {
  return seeding.getStore() ? base() : ready();
}

/**
 * Privileged database handle. Use only in trusted server code that has
 * already authorised the operation (authentication, alert engine,
 * notifications, seed, audited administrator operations).
 */
export async function system(): Promise<MongoDb> {
  return (await state()).db;
}

export async function col<T extends Document = Document & { _id: string }>(name: CollectionName): Promise<Collection<T>> {
  return (await system()).collection<T>(name);
}

/** Test helper: close the connection (and embedded server). */
export async function closeMongo(): Promise<void> {
  const current = g.__educonnectMongo;
  g.__educonnectMongo = undefined;
  g.__educonnectMongoReady = undefined;
  if (!current) return;
  const s = await current;
  await s.client.close();
  await s.stop?.();
}

async function ensureIndexes(db: MongoDb) {
  const C = COLLECTIONS;
  const ix = (name: string, specs: Array<[Record<string, 1 | -1>, Record<string, unknown>?]>) =>
    Promise.all(specs.map(([keys, opts]) => db.collection(name).createIndex(keys, opts ?? {})));
  await Promise.all([
    ix(C.schools, [[{ join_code: 1 }, { unique: true }]]),
    ix(C.users, [[{ email: 1 }, { unique: true }]]),
    ix(C.sessions, [[{ user_id: 1 }], [{ expires_at: 1 }, { expireAfterSeconds: 0 }]]),
    ix(C.passwordResets, [[{ user_id: 1 }], [{ expires_at: 1 }, { expireAfterSeconds: 0 }]]),
    ix(C.profiles, [[{ school_id: 1, role: 1 }]]),
    ix(C.staffPermissions, [[{ user_id: 1, permission: 1 }, { unique: true }], [{ school_id: 1, permission: 1 }]]),
    ix(C.invitations, [[{ token_hash: 1 }, { unique: true }], [{ school_id: 1 }]]),
    ix(C.classes, [[{ school_id: 1, name: 1, academic_year: 1 }, { unique: true }]]),
    ix(C.enrollments, [[{ class_id: 1, student_id: 1 }, { unique: true }], [{ student_id: 1 }], [{ school_id: 1 }]]),
    ix(C.subjects, [[{ school_id: 1, name: 1 }, { unique: true }]]),
    ix(C.teachingAssignments, [[{ class_id: 1, subject_id: 1, teacher_id: 1 }, { unique: true }], [{ teacher_id: 1 }]]),
    ix(C.timetable, [[{ class_id: 1, weekday: 1 }]]),
    ix(C.assessments, [[{ class_id: 1, due_date: 1 }]]),
    ix(C.grades, [[{ student_id: 1, subject_id: 1 }], [{ class_id: 1, subject_id: 1 }], [{ school_id: 1 }]]),
    ix(C.attendance, [[{ student_id: 1, class_id: 1, subject_id: 1, date: 1 }, { unique: true }], [{ class_id: 1, subject_id: 1, date: 1 }]]),
    ix(C.goals, [[{ student_id: 1 }]]),
    ix(C.interests, [[{ slug: 1 }, { unique: true }]]),
    ix(C.studentProfiles, [[{ school_id: 1 }]]),
    ix(C.connections, [[{ pair: 1 }, { unique: true }], [{ requester_id: 1 }], [{ addressee_id: 1, status: 1 }]]),
    ix(C.blocks, [[{ blocker_id: 1, blocked_id: 1 }, { unique: true }], [{ blocked_id: 1 }]]),
    ix(C.dismissals, [[{ user_id: 1, dismissed_id: 1 }, { unique: true }]]),
    ix(C.reports, [[{ school_id: 1, status: 1 }]]),
    ix(C.groups, [[{ school_id: 1 }]]),
    ix(C.groupMembers, [[{ group_id: 1, user_id: 1 }, { unique: true }], [{ user_id: 1 }]]),
    ix(C.checkins, [[{ student_id: 1, date: 1 }, { unique: true }], [{ school_id: 1, date: 1 }]]),
    ix(C.alertRules, [[{ school_id: 1 }]]),
    ix(C.alerts, [[{ school_id: 1, status: 1 }], [{ student_id: 1 }]]),
    ix(C.followups, [[{ alert_id: 1 }]]),
    ix(C.supportSessions, [[{ school_id: 1 }], [{ student_id: 1 }]]),
    ix(C.supportResources, [[{ school_id: 1 }]]),
    ix(C.guardianLinks, [[{ guardian_id: 1, student_id: 1 }, { unique: true }], [{ student_id: 1 }]]),
    ix(C.consents, [[{ subject_id: 1, consent_type: 1, recorded_at: -1 }], [{ school_id: 1 }]]),
    ix(C.notifications, [[{ user_id: 1, created_at: -1 }]]),
    ix(C.notificationPrefs, [[{ user_id: 1, type: 1 }, { unique: true }]]),
    ix(C.auditLogs, [[{ school_id: 1, created_at: -1 }]]),
    ix(C.subscriptions, [[{ school_id: 1 }, { unique: true }]]),
    ix(C.billing, [[{ school_id: 1 }]]),
  ]);
}
