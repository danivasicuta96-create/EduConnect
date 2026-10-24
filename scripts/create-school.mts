// Creates a real school and a one-time invitation for its first administrator.
//
//   MONGODB_URI="mongodb+srv://..." DATA_ENCRYPTION_KEY=... DEMO_MODE=false \
//     npx tsx --tsconfig tsconfig.json scripts/create-school.mts "Liceul Exemplu" EXEMPLU-2026 director@scoala.ro
//
// The admin then registers at <APP_URL>/register?code=<printed code> and can
// invite teachers, counselors, students and parents from the admin portal.

import { closeMongo, col, COLLECTIONS as C, newId, system } from "../src/lib/db/mongo";
import { installDefaultRules, seedReference } from "../src/lib/db/seed";
import { humanCode, sha256 } from "../src/lib/auth/crypto";
import { addDays, todayIn } from "../src/lib/dates";

const [name, joinCodeRaw, adminEmailRaw] = process.argv.slice(2);
if (!name || !joinCodeRaw || !adminEmailRaw) {
  console.error('Usage: create-school.mts "<School name>" <JOIN-CODE> <admin email>');
  process.exit(1);
}
const joinCode = joinCodeRaw.toUpperCase();
const adminEmail = adminEmailRaw.trim().toLowerCase();
if (!/^[A-Z0-9-]{4,20}$/.test(joinCode)) {
  console.error("JOIN-CODE must be 4–20 characters: A–Z, 0–9 or '-'.");
  process.exit(1);
}

const db = await system();
await seedReference(db);
if (await (await col(C.schools)).findOne({ join_code: joinCode })) {
  console.error(`A school with join code ${joinCode} already exists.`);
  process.exit(1);
}
const schoolId = newId();
const today = todayIn("Europe/Bucharest");
await (await col(C.schools)).insertOne({
  _id: schoolId as never, name, join_code: joinCode, country: "RO", timezone: "Europe/Bucharest", data_region: "eu", is_demo: false,
  settings: { wellbeing_retention_days: 365, audit_retention_days: 730, min_group_size: 5 }, created_at: new Date(),
});
await installDefaultRules(db, schoolId);
await (await col(C.subscriptions)).insertOne({
  _id: newId() as never, school_id: schoolId, plan_id: "pilot", billing_cycle: "annual", status: "trialing", funding_source: "pilot",
  seats: 150, current_period_end: addDays(today, 90), updated_at: new Date(), created_at: new Date(),
});
const code = humanCode(10);
await (await col(C.invitations)).insertOne({
  _id: newId() as never, school_id: schoolId, email: adminEmail, role: "admin", class_id: null, student_id: null,
  token_hash: sha256(code), created_by: null, expires_at: new Date(Date.now() + 14 * 86400_000), accepted_at: null, created_at: new Date(),
});
await (await col(C.auditLogs)).insertOne({
  _id: newId() as never, school_id: schoolId, actor_id: null, action: "school.created", resource_type: "school", resource_id: schoolId, metadata: { via: "cli" }, created_at: new Date(),
});

const base = process.env.APP_URL ?? "http://localhost:3000";
console.log(`\nSchool created: ${name} (join code for students: ${joinCode})`);
console.log(`Administrator invitation for ${adminEmail} (valid 14 days, shown once):`);
console.log(`  ${base}/register?code=${code}\n`);
await closeMongo();
process.exit(0);
