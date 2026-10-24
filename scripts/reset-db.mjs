// Deletes the local embedded MongoDB data so it is re-created and re-seeded on next start.
// Stop the dev server first. Never touches a MONGODB_URI database.
import { rmSync, existsSync } from "node:fs";
const dir = process.env.MONGO_DATA_DIR ?? ".data/mongo";
if (process.env.MONGODB_URI) {
  console.error("MONGODB_URI is set — refusing to touch a remote database. Use Atlas tools to reset it.");
  process.exit(1);
}
if (existsSync(dir)) {
  rmSync(dir, { recursive: true, force: true });
  console.log(`Removed ${dir}. Demo data will be re-created on the next start.`);
} else {
  console.log(`Nothing to remove at ${dir}.`);
}
