// Tenant-scoped collection access — the application-level replacement for
// Postgres row-level security.
//
// Every filter is forced to `school_id = <caller's school>`, every insert is
// stamped with it, and updates can never change it. This makes cross-school
// reads and writes structurally impossible through this API, whatever ids a
// caller passes in. Role- and relationship-based rules (who may see which
// student's data) live in src/lib/authz.ts and are applied by the services.

import type { AggregateOptions, Document, Filter, FindOptions, OptionalUnlessRequiredId, UpdateFilter, UpdateOptions, WithId } from "mongodb";
import { col, COLLECTIONS, newId, PRIVILEGED_COLLECTIONS, GLOBAL_COLLECTIONS, type CollectionName } from "./mongo";

/** Application documents use string UUID ids. */
export interface AppDoc extends Document {
  _id: string;
}

export class TenantViolation extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthorizationError";
  }
}

function assertNoSchoolChange(update: UpdateFilter<Document> | Document) {
  const u = update as Record<string, Record<string, unknown> | undefined>;
  for (const op of ["$set", "$unset", "$setOnInsert", "$rename", "$inc", "$push", "$addToSet"]) {
    if (u[op] && Object.prototype.hasOwnProperty.call(u[op], "school_id")) {
      throw new TenantViolation("school_id cannot be modified.");
    }
  }
  if (!Object.keys(u).some((k) => k.startsWith("$"))) throw new TenantViolation("Replacement updates are not allowed.");
}

export interface Scoped<T extends Document = AppDoc> {
  readonly name: CollectionName;
  find(filter?: Filter<T>, options?: FindOptions): Promise<WithId<T>[]>;
  findOne(filter: Filter<T>, options?: FindOptions): Promise<WithId<T> | null>;
  count(filter?: Filter<T>): Promise<number>;
  distinct<K extends string>(key: K, filter?: Filter<T>): Promise<unknown[]>;
  /** Inserts with a generated string `_id` (unless given), `school_id` and `created_at`. Returns the id. */
  insertOne(doc: Partial<T> & Document): Promise<string>;
  insertMany(docs: Array<Partial<T> & Document>): Promise<string[]>;
  updateOne(filter: Filter<T>, update: UpdateFilter<T>, options?: UpdateOptions): Promise<{ matched: number; modified: number; upsertedId: string | null }>;
  updateMany(filter: Filter<T>, update: UpdateFilter<T>): Promise<{ matched: number; modified: number }>;
  findOneAndUpdate(filter: Filter<T>, update: UpdateFilter<T>, options?: { upsert?: boolean }): Promise<WithId<T> | null>;
  deleteOne(filter: Filter<T>): Promise<number>;
  deleteMany(filter: Filter<T>): Promise<number>;
  aggregate<R extends Document = Document>(pipeline: Document[], options?: AggregateOptions): Promise<R[]>;
}

export function scopedCollection<T extends Document = AppDoc>(schoolId: string, name: CollectionName): Scoped<T> {
  if (!schoolId) throw new TenantViolation("No school context.");
  if (PRIVILEGED_COLLECTIONS.has(name) || GLOBAL_COLLECTIONS.has(name)) {
    throw new TenantViolation(`Collection ${name} is not tenant-scoped.`);
  }
  const scope = <F,>(filter?: F) => ({ ...(filter ?? {}), school_id: schoolId }) as unknown as Filter<T>;
  const c = () => col<T>(name);
  const stamp = (doc: Partial<T> & Document) =>
    ({ _id: newId(), created_at: new Date(), ...doc, school_id: schoolId }) as unknown as OptionalUnlessRequiredId<T>;

  return {
    name,
    find: async (filter, options) => (await c()).find(scope(filter), options).toArray(),
    findOne: async (filter, options) => (await c()).findOne(scope(filter), options),
    count: async (filter) => (await c()).countDocuments(scope(filter)),
    distinct: async (key, filter) => (await c()).distinct(key, scope(filter)),
    insertOne: async (doc) => {
      if (doc.school_id && doc.school_id !== schoolId) throw new TenantViolation("Cannot write to another school.");
      const d = stamp(doc);
      await (await c()).insertOne(d);
      return String((d as Document)._id);
    },
    insertMany: async (docs) => {
      if (docs.length === 0) return [];
      if (docs.some((d) => d.school_id && d.school_id !== schoolId)) throw new TenantViolation("Cannot write to another school.");
      const ds = docs.map(stamp);
      await (await c()).insertMany(ds);
      return ds.map((d) => String((d as Document)._id));
    },
    updateOne: async (filter, update, options) => {
      assertNoSchoolChange(update);
      const r = await (await c()).updateOne(scope(filter), update, options);
      return { matched: r.matchedCount, modified: r.modifiedCount, upsertedId: r.upsertedId ? String(r.upsertedId) : null };
    },
    updateMany: async (filter, update) => {
      assertNoSchoolChange(update);
      const r = await (await c()).updateMany(scope(filter), update);
      return { matched: r.matchedCount, modified: r.modifiedCount };
    },
    findOneAndUpdate: async (filter, update, options) => {
      assertNoSchoolChange(update);
      return (await c()).findOneAndUpdate(scope(filter), update, { returnDocument: "after", upsert: options?.upsert ?? false });
    },
    deleteOne: async (filter) => (await (await c()).deleteOne(scope(filter))).deletedCount,
    deleteMany: async (filter) => (await (await c()).deleteMany(scope(filter))).deletedCount,
    aggregate: async <R extends Document>(pipeline: Document[], options?: AggregateOptions) => {
      for (const stage of pipeline) {
        if ("$out" in stage || "$merge" in stage || "$unionWith" in stage) throw new TenantViolation("Stage not allowed.");
      }
      return (await c()).aggregate<R>([{ $match: { school_id: schoolId } }, ...pipeline], options).toArray();
    },
  };
}

/** All tenant-scoped collections for one school. */
export function tenant(actor: { schoolId: string }) {
  const s = actor.schoolId;
  const C = COLLECTIONS;
  const sc = <T extends Document = AppDoc>(n: CollectionName) => scopedCollection<T>(s, n);
  return {
    schoolId: s,
    schools: {
      /** The caller's own school document. */
      get: async () => (await col(C.schools)).findOne({ _id: s as unknown as never }),
      update: async (update: UpdateFilter<Document>) => {
        assertNoSchoolChange(update);
        return (await col(C.schools)).updateOne({ _id: s as unknown as never }, update);
      },
    },
    profiles: sc(C.profiles),
    staffPermissions: sc(C.staffPermissions),
    invitations: sc(C.invitations),
    classes: sc(C.classes),
    enrollments: sc(C.enrollments),
    subjects: sc(C.subjects),
    teachingAssignments: sc(C.teachingAssignments),
    timetable: sc(C.timetable),
    assessments: sc(C.assessments),
    grades: sc(C.grades),
    attendance: sc(C.attendance),
    goals: sc(C.goals),
    studentProfiles: sc(C.studentProfiles),
    connections: sc(C.connections),
    blocks: sc(C.blocks),
    dismissals: sc(C.dismissals),
    reports: sc(C.reports),
    groups: sc(C.groups),
    groupMembers: sc(C.groupMembers),
    activities: sc(C.activities),
    announcements: sc(C.announcements),
    checkins: sc(C.checkins),
    alertRules: sc(C.alertRules),
    alerts: sc(C.alerts),
    followups: sc(C.followups),
    supportSessions: sc(C.supportSessions),
    supportResources: sc(C.supportResources),
    guardianLinks: sc(C.guardianLinks),
    consents: sc(C.consents),
    notifications: sc(C.notifications),
    notificationPrefs: sc(C.notificationPrefs),
    auditLogs: sc(C.auditLogs),
    subscriptions: sc(C.subscriptions),
    billing: sc(C.billing),
    /** Global, read-only reference data. */
    interests: async () => (await col<{ _id: number; slug: string; label: string; category: string }>(C.interests)).find({}).sort({ category: 1, label: 1 }).toArray(),
    plans: async () => (await col(C.plans)).find({}).sort({ sort_order: 1 }).toArray(),
  };
}

export type Tenant = ReturnType<typeof tenant>;
