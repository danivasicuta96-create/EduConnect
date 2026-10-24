import { col, COLLECTIONS } from "@/lib/db/mongo";
import type { Actor } from "@/lib/services/actor";
import type { Role } from "@/lib/constants";

/** Load a seeded (fictional) demo user as a service Actor. */
export async function actorFor(email: string): Promise<Actor & { displayName: string }> {
  const user = await (await col(COLLECTIONS.users)).findOne({ email });
  if (!user) throw new Error(`No demo user ${email}`);
  const p = await (await col(COLLECTIONS.profiles)).findOne({ _id: user._id });
  if (!p) throw new Error(`No profile for ${email}`);
  const permissions = (await (await col(COLLECTIONS.staffPermissions)).find({ user_id: String(user._id) }).toArray()).map((r) => String(r.permission));
  return {
    id: String(user._id),
    schoolId: String(p.school_id),
    role: p.role as Role,
    timezone: "Europe/Bucharest",
    permissions,
    accountState: p.account_state,
    displayName: String(p.display_name),
  };
}

export const DEMO = {
  maria: "maria.georgescu@aurora.demo",
  alex: "alex.pop@aurora.demo",
  sofia: "sofia.rusu@aurora.demo",
  tudor: "tudor.lazar@aurora.demo",
  vlad: "vlad.constantin@aurora.demo",
  irina: "irina.dobre@aurora.demo",
  sara: "sara.oprea@aurora.demo",
  mathTeacher: "mihai.ionescu@aurora.demo",
  roTeacher: "andreea.stan@aurora.demo",
  counselor: "elena.popa@aurora.demo",
  admin: "ioana.marin@aurora.demo",
  parent: "radu.georgescu@aurora.demo",
  otherAdmin: "admin@birchwood.demo",
  otherTeacher: "teacher@birchwood.demo",
  otherStudent: "emil@birchwood.demo",
} as const;
