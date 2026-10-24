// Fictional demo data. Every person, school and record here is invented and
// flagged `is_demo`. Dates are generated relative to today so dashboards look
// current whenever the demo is started.

import type { Db as MongoDb, Document } from "mongodb";
import { INTEREST_CATALOG } from "../constants";
import { DEFAULT_RULES } from "../engines/alerts";
import { addDays, isSchoolDay, todayIn } from "../dates";
import { disabledPasswordHash, hashPassword } from "../auth/crypto";
import { runAlertEngine } from "../services/alert-engine";
import { COLLECTIONS as C, newId } from "./mongo";
import { encryptField } from "./field-crypto";

/** Small deterministic PRNG so the demo looks the same on every machine. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SUBJECTS = [
  { name: "Mathematics", color: "coral" },
  { name: "Romanian Language", color: "rose" },
  { name: "English", color: "sky" },
  { name: "Physics", color: "violet" },
  { name: "Biology", color: "teal" },
  { name: "History", color: "amber" },
  { name: "Computer Science", color: "pink" },
  { name: "Art", color: "slate" },
];

const TEACHERS = [
  { key: "math", name: "Mihai Ionescu", email: "mihai.ionescu@aurora.demo", subjects: ["Mathematics", "Physics"] },
  { key: "ro", name: "Andreea Stan", email: "andreea.stan@aurora.demo", subjects: ["Romanian Language", "History"] },
  { key: "en", name: "David Petrescu", email: "david.petrescu@aurora.demo", subjects: ["English", "Computer Science"] },
  { key: "bio", name: "Laura Dinu", email: "laura.dinu@aurora.demo", subjects: ["Biology", "Art"] },
];

const CLASSES = [
  { name: "9A", grade: 9, homeroom: "math" },
  { name: "10B", grade: 10, homeroom: "ro" },
  { name: "11C", grade: 11, homeroom: "en" },
];

// mood profile: base mood and an optional pattern used to create demo alerts.
type MoodPattern = "steady" | "declining" | "low_streak" | "upbeat" | "recovering";
interface DemoStudent {
  first: string; last: string; cls: string; interests: string[]; goals: string[];
  style: string; mood: number; pattern: MoodPattern; ability: number; discoverable?: boolean; bio?: string;
}

const STUDENTS: DemoStudent[] = [
  { first: "Maria", last: "Georgescu", cls: "9A", interests: ["programming", "music", "art", "science"], goals: ["learn_coding", "improve_math"], style: "visual", mood: 7, pattern: "steady", ability: 8.2, bio: "Learning Python and playing guitar 🎸" },
  { first: "Alex", last: "Pop", cls: "9A", interests: ["programming", "gaming", "robotics", "math"], goals: ["learn_coding", "science_fair"], style: "hands_on", mood: 7, pattern: "upbeat", ability: 7.6, bio: "Building a line-following robot." },
  { first: "Sofia", last: "Rusu", cls: "9A", interests: ["art", "photography", "music", "reading"], goals: ["creative_projects", "reading_more"], style: "visual", mood: 8, pattern: "upbeat", ability: 8.8 },
  { first: "Tudor", last: "Lazăr", cls: "9A", interests: ["football", "gaming", "history"], goals: ["improve_math", "time_management"], style: "auditory", mood: 6, pattern: "declining", ability: 6.4 },
  { first: "Bianca", last: "Niculescu", cls: "9A", interests: ["dance", "music", "languages", "theatre"], goals: ["public_speaking", "language_skills"], style: "auditory", mood: 7, pattern: "steady", ability: 7.9 },
  { first: "Vlad", last: "Constantin", cls: "9A", interests: ["chess", "math", "programming", "reading"], goals: ["improve_math", "exam_prep"], style: "reading", mood: 6, pattern: "steady", ability: 9.1, discoverable: false },
  { first: "Daria", last: "Mihai", cls: "10B", interests: ["science", "environment", "volunteering", "programming"], goals: ["science_fair", "learn_coding"], style: "hands_on", mood: 7, pattern: "steady", ability: 8.5 },
  { first: "Luca", last: "Stoica", cls: "10B", interests: ["music", "film", "writing", "art"], goals: ["creative_projects", "make_friends"], style: "mixed", mood: 7, pattern: "recovering", ability: 7.2 },
  { first: "Irina", last: "Dobre", cls: "10B", interests: ["reading", "writing", "languages", "art"], goals: ["language_skills", "reading_more"], style: "reading", mood: 5, pattern: "low_streak", ability: 8.0 },
  { first: "Matei", last: "Ene", cls: "10B", interests: ["basketball", "running", "entrepreneurship"], goals: ["time_management", "public_speaking"], style: "hands_on", mood: 7, pattern: "steady", ability: 6.9 },
  { first: "Carla", last: "Voicu", cls: "10B", interests: ["debate", "history", "languages", "volunteering"], goals: ["public_speaking", "exam_prep"], style: "auditory", mood: 8, pattern: "upbeat", ability: 8.7 },
  { first: "Radu", last: "Iordache", cls: "10B", interests: ["gaming", "design", "programming", "film"], goals: ["learn_coding", "creative_projects"], style: "visual", mood: 6, pattern: "steady", ability: 7.0 },
  { first: "Ioana", last: "Filip", cls: "11C", interests: ["science", "math", "chess", "robotics"], goals: ["exam_prep", "science_fair"], style: "reading", mood: 7, pattern: "steady", ability: 9.0 },
  { first: "Andrei", last: "Toma", cls: "11C", interests: ["football", "music", "gaming"], goals: ["exam_prep", "time_management"], style: "auditory", mood: 6, pattern: "steady", ability: 6.6 },
  { first: "Elisa", last: "Barbu", cls: "11C", interests: ["photography", "environment", "art", "volunteering"], goals: ["creative_projects", "make_friends"], style: "visual", mood: 8, pattern: "upbeat", ability: 8.1 },
  { first: "Cristian", last: "Munteanu", cls: "11C", interests: ["programming", "entrepreneurship", "design", "debate"], goals: ["learn_coding", "public_speaking"], style: "hands_on", mood: 7, pattern: "steady", ability: 7.8 },
  { first: "Ana", last: "Neagu", cls: "11C", interests: ["theatre", "dance", "writing", "film"], goals: ["public_speaking", "creative_projects"], style: "mixed", mood: 7, pattern: "steady", ability: 7.4 },
  { first: "Paul", last: "Sandu", cls: "11C", interests: ["running", "history", "reading"], goals: ["exam_prep", "reading_more"], style: "reading", mood: 7, pattern: "steady", ability: 7.7 },
];

const FACTOR_KEYS = ["tests", "workload", "breaks", "friendships", "teachers", "sleep", "family", "activities", "online"];

function slugEmail(first: string, last: string) {
  const clean = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  return `${clean(first)}.${clean(last)}@aurora.demo`;
}

async function demoHash(): Promise<string> {
  // Demo accounts sign in through the one-click demo panel. A shared password
  // is only set when DEMO_PASSWORD is explicitly configured.
  const pw = process.env.DEMO_PASSWORD;
  return pw ? hashPassword(pw) : disabledPasswordHash();
}

/** Buffers documents per collection and writes them with insertMany. */
class Batch {
  private docs = new Map<string, Document[]>();
  constructor(private db: MongoDb) {}
  add(collection: string, doc: Document): string {
    const id = (doc._id as string | undefined) ?? newId();
    const list = this.docs.get(collection) ?? [];
    list.push({ created_at: new Date(), ...doc, _id: id });
    this.docs.set(collection, list);
    return id;
  }
  async flush() {
    for (const [name, list] of this.docs) {
      if (list.length) await this.db.collection(name).insertMany(list as never[]);
    }
    this.docs.clear();
  }
}

function createUser(
  b: Batch,
  u: { email: string; schoolId: string; role: string; name: string; color: string; grade?: number; birthYear?: number; state?: string; hash: string },
): string {
  const id = b.add(C.users, { email: u.email, password_hash: u.hash, status: "active", is_demo: true, failed_logins: 0, locked_until: null, last_login_at: null });
  b.add(C.profiles, {
    _id: id, school_id: u.schoolId, role: u.role, display_name: u.name, avatar_color: u.color, avatar_emoji: null, locale: "en",
    grade_level: u.grade ?? null, birth_year: u.birthYear ?? null, onboarded: true, account_state: u.state ?? "active", is_demo: true,
  });
  return id;
}

export async function seedReference(db: MongoDb): Promise<void> {
  const interests = db.collection(C.interests);
  if ((await interests.countDocuments()) === 0) {
    await interests.insertMany(INTEREST_CATALOG.map((i, idx) => ({ _id: (idx + 1) as never, ...i })));
  }
  const plans = db.collection(C.plans);
  if ((await plans.countDocuments()) === 0) {
    await plans.insertMany([
      { _id: "pilot" as never, name: "Pilot", description: "Free 3-month pilot for one school: student app, check-ins, matchmaking, basic dashboards.", price_monthly_cents: 0, price_annual_cents: 0, currency: "EUR", max_students: 150, features: ["student_app", "checkins", "matchmaking", "teacher_dashboard"], sort_order: 0 },
      { _id: "school" as never, name: "School", description: "Full platform for one school, including counselor tools, AI tutor and wellbeing assistant.", price_monthly_cents: 14900, price_annual_cents: 149000, currency: "EUR", max_students: 1000, features: ["student_app", "checkins", "matchmaking", "teacher_dashboard", "counselor_dashboard", "ai_tutor", "wellbeing_assistant", "audit_logs"], sort_order: 1 },
      { _id: "school_plus" as never, name: "School Plus", description: "Everything in School plus advanced analytics, personal development reports and the extended relaxation library.", price_monthly_cents: 29900, price_annual_cents: 299000, currency: "EUR", max_students: null, features: ["student_app", "checkins", "matchmaking", "teacher_dashboard", "counselor_dashboard", "ai_tutor", "wellbeing_assistant", "audit_logs", "advanced_analytics", "premium_reports", "relaxation_library"], sort_order: 2 },
    ]);
  }
  const resources = db.collection(C.supportResources);
  if ((await resources.countDocuments({ school_id: null })) === 0) {
    const r = (category: string, name: string, phone: string | null, url: string | null, description: string, hours: string | null, sort_order: number) =>
      ({ _id: newId() as never, school_id: null, country: "RO", category, name, phone, url, description, hours, last_verified: null, sort_order, created_at: new Date() });
    await resources.insertMany([
      r("emergency", "Emergency services — 112", "112", null, "If you or someone else is in immediate danger, call 112. Free, 24/7.", "24/7", 1),
      r("helpline", "Telefonul Copilului — 116 111", "116 111", "https://www.telefonulcopilului.ro", "Free, confidential helpline for children and teenagers in Romania. You can talk about anything that worries you.", "Check current hours on the website", 2),
      r("helpline", "Child abuse reporting — 119", "119", null, "National number for reporting abuse, neglect or violence against a child.", "24/7", 3),
      r("helpline", "Antisuicid helpline (ARPS) — 0800 801 200", "0800 801 200", "https://www.antisuicid.com", "Free, anonymous emotional support line run by volunteers (aimed at adults 18+). If you are under 18, 116 111 is the best first call.", "Evening/night hours — check the website", 4),
      r("selfcare", "Guided breathing (in app)", null, "/student/wellbeing/assistant", "A one-minute box-breathing exercise you can do anywhere.", null, 10),
    ]);
  }
}

export async function installDefaultRules(db: MongoDb, schoolId: string): Promise<void> {
  await db.collection(C.alertRules).insertMany(
    DEFAULT_RULES.map((r) => ({
      _id: newId() as never, school_id: schoolId, name: r.name, kind: r.kind, window_days: r.windowDays, threshold: r.threshold,
      consecutive_count: r.consecutiveCount, min_checkins: r.minCheckins, severity: r.severity, enabled: r.enabled, updated_by: null, updated_at: new Date(), created_at: new Date(),
    })),
  );
}

function moodFor(pattern: MoodPattern, base: number, dayIndex: number, totalDays: number, rnd: () => number): number {
  const progress = dayIndex / Math.max(1, totalDays - 1); // 0 = oldest, 1 = today
  let m = base + (rnd() - 0.5) * 2.4;
  if (pattern === "declining") m = 7.2 - progress * 4.6 + (rnd() - 0.5) * 1.2;
  if (pattern === "low_streak") m = progress > 0.62 ? 2 + rnd() * 1.2 : base + (rnd() - 0.5) * 2;
  if (pattern === "upbeat") m = base + 0.6 + (rnd() - 0.5) * 1.6;
  if (pattern === "recovering") m = 4.5 + progress * 3 + (rnd() - 0.5) * 1.2;
  return Math.max(1, Math.min(10, Math.round(m)));
}

const pairKey = (a: string, b: string) => (a < b ? `${a}:${b}` : `${b}:${a}`);

export async function seedDemo(db: MongoDb): Promise<void> {
  const today = todayIn("Europe/Bucharest");
  const rnd = mulberry32(20261024);
  const hash = await demoHash();
  const b = new Batch(db);
  const daysAgo = (n: number) => new Date(Date.now() - n * 86400_000);

  await seedReference(db);

  // ── School A ────────────────────────────────────────────────────────────
  const school = b.add(C.schools, {
    name: "Aurora Demo High School (fictional)", join_code: "AURORA-DEMO", country: "RO", timezone: "Europe/Bucharest", data_region: "eu", is_demo: true,
    settings: { wellbeing_retention_days: 365, audit_retention_days: 730, checkin_reminder_time: "15:00", min_group_size: 5 },
  });

  const adminId = createUser(b, { email: "ioana.marin@aurora.demo", schoolId: school, role: "admin", name: "Ioana Marin", color: "slate", hash });
  const counselorId = createUser(b, { email: "elena.popa@aurora.demo", schoolId: school, role: "counselor", name: "Elena Popa", color: "teal", hash });
  for (const p of ["wellbeing.alerts", "wellbeing.rules", "wellbeing.aggregate", "safeguarding.reports"]) {
    b.add(C.staffPermissions, { school_id: school, user_id: counselorId, permission: p, granted_by: adminId, granted_at: new Date() });
  }

  const teacherIds: Record<string, string> = {};
  for (const [i, t] of TEACHERS.entries()) {
    teacherIds[t.key] = createUser(b, { email: t.email, schoolId: school, role: "teacher", name: t.name, color: ["sky", "violet", "amber", "rose"][i], hash });
  }

  const subjectIds: Record<string, string> = {};
  for (const s of SUBJECTS) subjectIds[s.name] = b.add(C.subjects, { school_id: school, name: s.name, color: s.color });
  const teacherFor = (subject: string) => teacherIds[TEACHERS.find((t) => t.subjects.includes(subject))!.key];

  const classIds: Record<string, string> = {};
  for (const c of CLASSES) {
    classIds[c.name] = b.add(C.classes, { school_id: school, name: c.name, grade_level: c.grade, academic_year: "2026-2027", homeroom_teacher_id: teacherIds[c.homeroom] });
    for (const s of SUBJECTS) {
      b.add(C.teachingAssignments, { school_id: school, class_id: classIds[c.name], subject_id: subjectIds[s.name], teacher_id: teacherFor(s.name) });
    }
  }

  // Timetable: 6 periods a day, Monday–Friday, rotated per class.
  const periods = [["08:00", "08:50"], ["09:00", "09:50"], ["10:00", "10:50"], ["11:10", "12:00"], ["12:10", "13:00"], ["13:10", "14:00"]];
  const timetable: Array<{ class_id: string; subject_id: string; weekday: number }> = [];
  for (const [ci, c] of CLASSES.entries()) {
    for (let day = 1; day <= 5; day++) {
      for (let p = 0; p < periods.length; p++) {
        const subject = SUBJECTS[(day * 3 + p + ci * 2) % SUBJECTS.length].name;
        const entry = { class_id: classIds[c.name], subject_id: subjectIds[subject], weekday: day };
        timetable.push(entry);
        b.add(C.timetable, { school_id: school, ...entry, teacher_id: teacherFor(subject), start_time: periods[p][0], end_time: periods[p][1], room: `${c.grade}0${(p % 4) + 1}` });
      }
    }
  }

  // Students, profiles, interests, consent.
  const interestId = Object.fromEntries(INTEREST_CATALOG.map((i, idx) => [i.slug, idx + 1]));
  const studentIds: Record<string, string> = {};
  const thisYear = Number(today.slice(0, 4));
  for (const [i, s] of STUDENTS.entries()) {
    const grade = CLASSES.find((c) => c.name === s.cls)!.grade;
    const id = createUser(b, {
      email: slugEmail(s.first, s.last), schoolId: school, role: "student", name: `${s.first} ${s.last}`,
      color: ["coral", "pink", "rose", "amber", "teal", "sky", "violet"][i % 7], grade, birthYear: thisYear - (grade + 6), hash,
    });
    studentIds[s.first] = id;
    b.add(C.enrollments, { school_id: school, class_id: classIds[s.cls], student_id: id, enrolled_at: new Date() });
    b.add(C.studentProfiles, {
      _id: id, school_id: school, bio: s.bio ?? null, learning_style: s.style, goals: s.goals, clubs: [], open_to: ["study_partner", "project", "club"],
      discoverable: s.discoverable ?? true, show_class: true, interest_ids: s.interests.map((slug) => interestId[slug]), updated_at: new Date(),
    });
    // Under-16s: consent recorded by the school from a guardian's paper form.
    const under16 = grade + 6 < 16;
    for (const type of ["platform", "wellbeing_checkins", "matchmaking", "ai_features"]) {
      b.add(C.consents, {
        school_id: school, subject_id: id, consent_type: type, granted: true, given_by: under16 ? adminId : id,
        given_by_role: under16 ? "guardian" : "student", method: under16 ? "paper_form" : "in_app", recorded_at: daysAgo(60),
      });
    }
  }

  // A new student still waiting for guardian consent (shows the consent workflow).
  const saraId = createUser(b, { email: "sara.oprea@aurora.demo", schoolId: school, role: "student", name: "Sara Oprea", color: "pink", grade: 9, birthYear: thisYear - 15, state: "pending_guardian_consent", hash });
  b.add(C.enrollments, { school_id: school, class_id: classIds["9A"], student_id: saraId, enrolled_at: new Date() });
  b.add(C.studentProfiles, { _id: saraId, school_id: school, bio: null, learning_style: null, goals: [], clubs: [], open_to: ["study_partner", "project", "club"], discoverable: false, show_class: true, interest_ids: [], updated_at: new Date() });

  // Guardian linked to Maria, with guardian-access consent.
  const parentId = createUser(b, { email: "radu.georgescu@aurora.demo", schoolId: school, role: "parent", name: "Radu Georgescu", color: "amber", hash });
  b.add(C.guardianLinks, { school_id: school, guardian_id: parentId, student_id: studentIds.Maria, relationship: "parent", status: "active" });
  b.add(C.consents, { school_id: school, subject_id: studentIds.Maria, consent_type: "guardian_access", granted: true, given_by: adminId, given_by_role: "admin", method: "paper_form", recorded_at: daysAgo(60) });

  // Assessments, grades.
  const kinds = ["test", "quiz", "homework", "oral", "project"];
  const studentAbility = (s: DemoStudent, subjectIdx: number) => Math.max(4, Math.min(10, s.ability + Math.sin(subjectIdx * 1.7 + s.ability) * 1.3));
  for (const c of CLASSES) {
    const classStudents = STUDENTS.filter((s) => s.cls === c.name);
    for (const [si, subj] of SUBJECTS.entries()) {
      const teacher = teacherFor(subj.name);
      for (let a = 0; a < 4; a++) {
        const due = addDays(today, -56 + a * 14 + si);
        const kind = kinds[(a + si) % kinds.length];
        const asmt = b.add(C.assessments, { school_id: school, class_id: classIds[c.name], subject_id: subjectIds[subj.name], title: `${subj.name} ${kind} ${a + 1}`, kind, due_date: due, description: null, created_by: teacher });
        for (const s of classStudents) {
          if (rnd() < 0.08) continue; // not everyone has every grade
          const trend = s.pattern === "declining" ? -a * 0.35 : 0;
          const score = Math.max(1, Math.min(10, Math.round(studentAbility(s, si) + trend + (rnd() - 0.5) * 2.2)));
          b.add(C.grades, {
            school_id: school, student_id: studentIds[s.first], class_id: classIds[c.name], subject_id: subjectIds[subj.name], assessment_id: asmt,
            score, weight: kind === "test" ? 2 : 1, kind, comment: null, graded_on: addDays(due, 2), entered_by: teacher, is_demo: true, updated_at: new Date(),
          });
        }
      }
      const upcoming = [3 + (si % 5), 12 + (si % 6)];
      for (const [u, inDays] of upcoming.entries()) {
        b.add(C.assessments, {
          school_id: school, class_id: classIds[c.name], subject_id: subjectIds[subj.name], title: u === 0 ? `${subj.name} test` : `${subj.name} project`,
          kind: u === 0 ? "test" : "project", due_date: addDays(today, inDays),
          description: u === 0 ? "Covers the last two units. Revise your notes and the practice sheet." : "Group or individual project — details in class.", created_by: teacher,
        });
      }
    }
  }

  // Attendance for the last 15 school days, following the timetable.
  for (let d = 1, counted = 0; counted < 15 && d < 40; d++) {
    const date = addDays(today, -d);
    if (!isSchoolDay(date)) continue;
    counted++;
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
    for (const c of CLASSES) {
      const subjectsToday = [...new Set(timetable.filter((t) => t.class_id === classIds[c.name] && t.weekday === weekday).map((t) => t.subject_id))];
      for (const s of STUDENTS.filter((x) => x.cls === c.name)) {
        for (const subjectId of subjectsToday) {
          const r = rnd();
          const status = r < 0.035 ? "absent" : r < 0.06 ? "late" : r < 0.075 ? "excused" : "present";
          b.add(C.attendance, { school_id: school, student_id: studentIds[s.first], class_id: classIds[c.name], subject_id: subjectId, date, status, note: null, entered_by: teacherFor(SUBJECTS[0].name) });
        }
      }
    }
  }

  // Wellbeing check-ins for the last 21 school days.
  const days: string[] = [];
  for (let d = 0; days.length < 21 && d < 40; d++) {
    const date = addDays(today, -d);
    if (isSchoolDay(date)) days.unshift(date);
  }
  const notes = [
    "Felt proud after the coding club today.",
    "A bit tired, the maths homework took long.",
    "Lunch with Sofia was fun.",
    "Nervous about the test but I prepared.",
  ];
  for (const s of STUDENTS) {
    for (const [di, date] of days.entries()) {
      const forcedDaily = s.pattern === "low_streak" || s.pattern === "declining";
      if (!forcedDaily && rnd() < 0.15) continue;
      const mood = moodFor(s.pattern, s.mood, di, days.length, rnd);
      const exp = mood >= 8 ? "great" : mood >= 7 ? "good" : mood >= 5 ? "mixed" : mood >= 3 ? "hard" : "very_hard";
      const factors = FACTOR_KEYS.filter(() => rnd() < 0.18).slice(0, 3);
      const withNote = s.first === "Maria" && di % 5 === 0;
      b.add(C.checkins, {
        school_id: school, student_id: studentIds[s.first], date, mood, experience: exp, factors,
        note_enc: withNote ? encryptField(notes[(di / 5) % notes.length]) : null, note_shared: false, updated_at: new Date(),
      });
    }
  }

  // Alert rules must exist before the engine runs.
  await b.flush();
  await installDefaultRules(db, school);

  // A historic, resolved alert with follow-ups (shows the full workflow).
  const rules = await db.collection(C.alertRules).find({ school_id: school }).toArray();
  const weeklyRule = rules.find((r) => r.kind === "window_average" && r.window_days === 7);
  const past = b.add(C.alerts, {
    school_id: school, student_id: studentIds.Luca, rule_id: weeklyRule ? String(weeklyRule._id) : null, source: "rule", severity: "attention", status: "resolved",
    summary: "Average self-reported mood of 4.4/10 across 5 check-ins in the last 7 days is below the configured level of 5.",
    observed: { average: 4.4, checkins: 5, lowest: 3, windowDays: 7, threshold: 5 }, window_start: addDays(today, -48), window_end: addDays(today, -42),
    assigned_to: counselorId, acknowledged_by: counselorId, acknowledged_at: daysAgo(40), resolved_at: daysAgo(30),
    resolution_enc: encryptField("Talked with the student; things improved after exam week. No further action needed."), created_at: daysAgo(41), updated_at: daysAgo(30),
  });
  b.add(C.followups, { school_id: school, alert_id: past, author_id: counselorId, action: "conversation_offered", note_enc: encryptField("Offered a short, informal chat via the support-conversation invite."), created_at: daysAgo(40) });
  b.add(C.followups, { school_id: school, alert_id: past, author_id: counselorId, action: "conversation_held", note_enc: encryptField("Friendly conversation. Exam stress; agreed on a revision plan and check-in in two weeks."), created_at: daysAgo(38) });
  b.add(C.followups, { school_id: school, alert_id: past, author_id: counselorId, action: "status_change", note_enc: encryptField("Resolved — mood back to usual levels."), created_at: daysAgo(30) });

  // Social graph.
  const conn = (a: string, z: string, status: string, msg: string | null = null) =>
    b.add(C.connections, {
      school_id: school, requester_id: studentIds[a], addressee_id: studentIds[z], pair: pairKey(studentIds[a], studentIds[z]),
      status, message: msg, responded_at: status === "pending" ? null : new Date(),
    });
  conn("Maria", "Sofia", "accepted");
  conn("Maria", "Daria", "accepted");
  conn("Alex", "Maria", "pending", "Want to work on the robotics project together?");
  conn("Maria", "Cristian", "pending");
  conn("Bianca", "Sofia", "accepted");
  conn("Ioana", "Daria", "accepted");

  const group = (name: string, desc: string, subject: string | null, interests: string[], owner: string, members: string[], meeting: string) => {
    const id = b.add(C.groups, {
      school_id: school, name, description: desc, subject_id: subject ? subjectIds[subject] : null, interest_ids: interests.map((i) => interestId[i]),
      max_members: 8, meeting_info: meeting, created_by: studentIds[owner],
    });
    b.add(C.groupMembers, { school_id: school, group_id: id, user_id: studentIds[owner], status: "member", role: "owner", invited_by: null, joined_at: new Date() });
    for (const m of members) b.add(C.groupMembers, { school_id: school, group_id: id, user_id: studentIds[m], status: "member", role: "member", invited_by: null, joined_at: new Date() });
    return id;
  };
  group("Maths Olympiad Prep", "Weekly problem-solving sessions for the county olympiad.", "Mathematics", ["math", "chess"], "Vlad", ["Ioana"], "Thursdays 15:00, room 204");
  const codeClub = group("Code Club", "Learn Python and build small games and robots together.", "Computer Science", ["programming", "robotics", "gaming"], "Alex", ["Radu", "Cristian"], "Tuesdays 14:30, computer lab");
  group("Book Circle", "One book a month, then we talk about it over tea.", "Romanian Language", ["reading", "writing"], "Irina", ["Paul"], "Every other Friday, library");
  group("Eco Lab", "Small science experiments and a school garden project.", "Biology", ["science", "environment"], "Daria", ["Elisa"], "Wednesdays 14:00, bio lab");
  b.add(C.groupMembers, { school_id: school, group_id: codeClub, user_id: studentIds.Maria, status: "invited", role: "member", invited_by: studentIds.Alex, joined_at: new Date() });

  const activity = (title: string, desc: string, interests: string[], inDays: number, location: string) =>
    b.add(C.activities, { school_id: school, title, description: desc, interest_ids: interests.map((i) => interestId[i]), starts_at: new Date(`${addDays(today, inDays)}T14:00:00+03:00`), location, created_by: adminId });
  activity("Robotics workshop", "Build and program a small robot. No experience needed.", ["robotics", "programming"], 4, "Computer lab");
  activity("Choir auditions", "Join the school choir for the winter concert.", ["music", "theatre"], 6, "Auditorium");
  activity("Eco volunteering day", "Help plant trees in the park next to school.", ["environment", "volunteering"], 9, "Main entrance");
  activity("Debate tournament", "Inter-class debate on technology and society.", ["debate", "history"], 13, "Library");

  b.add(C.announcements, { school_id: school, title: "Welcome to EduConnect AI (demo)", body: "This is a fictional demo school. All people and records are invented for demonstration purposes.", audience: "all", created_by: adminId });
  b.add(C.announcements, { school_id: school, title: "Parent–teacher meetings", body: "Parent–teacher meetings take place next Thursday from 17:00. Book a slot with your homeroom teacher.", audience: "all", created_by: adminId });

  const n = (user: string, type: string, title: string, body: string, link: string) =>
    b.add(C.notifications, { school_id: school, user_id: user, type, title, body, link, sensitive: false, read_at: null });
  n(studentIds.Maria, "connection_request", "Alex Pop wants to connect", "Want to work on the robotics project together?", "/student/connections");
  n(studentIds.Maria, "group_invite", "You're invited to Code Club", "Alex Pop invited you to join the study group.", "/student/groups");
  n(studentIds.Maria, "grade_update", "New grade in Mathematics", "Your teacher added a new grade.", "/student/academics/grades");
  n(parentId, "announcement", "Parent–teacher meetings", "Next Thursday from 17:00.", "/parent");

  b.add(C.subscriptions, { school_id: school, plan_id: "school", billing_cycle: "annual", status: "active", funding_source: "grant", seats: 400, current_period_end: addDays(today, 240), updated_at: new Date() });
  b.add(C.billing, { school_id: school, description: "School plan — annual (grant-funded, demo record)", amount_cents: 149000, currency: "EUR", status: "paid", period_start: addDays(today, -125), period_end: addDays(today, 240), provider_ref: null });
  b.add(C.auditLogs, { school_id: school, actor_id: adminId, action: "school.created", resource_type: "school", resource_id: school, metadata: { demo: true } });

  // ── School B (used to verify tenant isolation) ─────────────────────────
  const schoolB = b.add(C.schools, { name: "Birchwood Demo School (fictional)", join_code: "BIRCH-DEMO", country: "RO", timezone: "Europe/Bucharest", data_region: "eu", is_demo: true, settings: {} });
  createUser(b, { email: "admin@birchwood.demo", schoolId: schoolB, role: "admin", name: "Victor Olaru", color: "slate", hash });
  const bTeacher = createUser(b, { email: "teacher@birchwood.demo", schoolId: schoolB, role: "teacher", name: "Nora Pavel", color: "sky", hash });
  const bClass = b.add(C.classes, { school_id: schoolB, name: "9X", grade_level: 9, academic_year: "2026-2027", homeroom_teacher_id: null });
  const bSubject = b.add(C.subjects, { school_id: schoolB, name: "Mathematics", color: "coral" });
  b.add(C.teachingAssignments, { school_id: schoolB, class_id: bClass, subject_id: bSubject, teacher_id: bTeacher });
  for (const name of ["Emil Radu", "Lia Matei", "Ilie Cosma"]) {
    const id = createUser(b, { email: `${name.split(" ")[0].toLowerCase()}@birchwood.demo`, schoolId: schoolB, role: "student", name, color: "teal", grade: 9, birthYear: thisYear - 15, hash });
    b.add(C.enrollments, { school_id: schoolB, class_id: bClass, student_id: id, enrolled_at: new Date() });
    b.add(C.studentProfiles, { _id: id, school_id: schoolB, bio: null, learning_style: null, goals: [], clubs: [], open_to: ["study_partner"], discoverable: true, show_class: true, interest_ids: [interestId.programming], updated_at: new Date() });
    b.add(C.grades, { school_id: schoolB, student_id: id, class_id: bClass, subject_id: bSubject, assessment_id: null, score: 8, weight: 1, kind: "test", comment: null, graded_on: today, entered_by: bTeacher, is_demo: true, updated_at: new Date() });
    b.add(C.checkins, { school_id: schoolB, student_id: id, date: today, mood: 3, experience: null, factors: [], note_enc: null, note_shared: false, updated_at: new Date() });
  }
  b.add(C.subscriptions, { school_id: schoolB, plan_id: "pilot", billing_cycle: "annual", status: "trialing", funding_source: "pilot", seats: 150, current_period_end: addDays(today, 60), updated_at: new Date() });
  await b.flush();
  await installDefaultRules(db, schoolB);

  // Run the real alert engine for every student so demo alerts are genuine rule outcomes.
  const students = await db.collection(C.profiles).find({ role: "student" }, { projection: { _id: 1 } }).toArray();
  for (const s of students) await runAlertEngine(String(s._id), today);
}

export async function seedIfEmpty(db: MongoDb): Promise<void> {
  await seedReference(db);
  if ((await db.collection(C.schools).countDocuments({}, { limit: 1 })) > 0) return;
  await seedDemo(db);
}
