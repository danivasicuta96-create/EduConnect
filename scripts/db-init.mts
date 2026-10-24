// Connects to the configured MongoDB, creates indexes and (unless DEMO_MODE=false) seeds the demo.
// Useful once after creating a new Atlas cluster:
//   MONGODB_URI="mongodb+srv://..." DATA_ENCRYPTION_KEY=... npx tsx scripts/db-init.mts
import { closeMongo, col, COLLECTIONS } from "../src/lib/db/mongo";

const schools = await (await col(COLLECTIONS.schools)).countDocuments();
const users = await (await col(COLLECTIONS.users)).countDocuments();
console.log(`Connected. Indexes ensured. Schools: ${schools}, users: ${users}.`);
await closeMongo();
process.exit(0);
