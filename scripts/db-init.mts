// Prepares the configured MongoDB: creates indexes, reference data and — unless
// DEMO_MODE=false — the fictional demo school (only once; an interrupted seed is
// cleaned up and redone).
//
// Runs automatically in the Netlify build (see netlify.toml). Locally:
//   MONGODB_URI="mongodb+srv://..." DATA_ENCRYPTION_KEY=... npm run db:init
//
// In CI it never fails the build: if the database isn't configured or reachable
// yet, it prints a warning and the site still deploys (the /install page and
// the APK download don't need the database).
import { closeMongo, col, COLLECTIONS, system } from "../src/lib/db/mongo";
import { seedIfEmpty } from "../src/lib/db/seed";

const inCI = Boolean(process.env.CI || process.env.NETLIFY);
const warn = (msg: string) => console.warn(`\n⚠ db:init — ${msg}\n`);

async function main() {
  if (!process.env.MONGODB_URI) {
    if (inCI) return warn("MONGODB_URI is not set for builds, skipping database setup. Set it in Netlify → Site configuration → Environment variables (scope: Builds and Functions).");
    console.log("No MONGODB_URI: using the embedded development database.");
  }
  const wantsDemo = process.env.DEMO_MODE !== "false";
  if (wantsDemo && process.env.MONGODB_URI && !process.env.DATA_ENCRYPTION_KEY) {
    return warn("DATA_ENCRYPTION_KEY is not set, so the demo isn't seeded (its notes must be encrypted with the production key). Add the variable and redeploy.");
  }
  process.env.SKIP_AUTO_SEED = "true"; // seed explicitly below
  const db = await system();
  const result = wantsDemo ? await seedIfEmpty(db) : "skipped";
  const schools = await (await col(COLLECTIONS.schools)).countDocuments();
  const users = await (await col(COLLECTIONS.users)).countDocuments();
  console.log(`✔ db:init — indexes ready; demo: ${result}; schools: ${schools}, users: ${users}.`);
}

try {
  await main();
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  if (!inCI) throw err;
  warn(`could not prepare the database (${message}). Check MONGODB_URI and Atlas → Network Access (allow 0.0.0.0/0 for Netlify).`);
} finally {
  await closeMongo().catch(() => {});
}
process.exit(0);
