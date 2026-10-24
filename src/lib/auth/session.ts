import "server-only";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { redirect } from "next/navigation";
import { col, COLLECTIONS as C } from "@/lib/db/mongo";
import { randomToken, sha256 } from "./crypto";
import { ROLE_HOME, type Role } from "@/lib/constants";
import { AuthorizationError } from "@/lib/services/errors";

export const SESSION_COOKIE = "ec_session";
const SESSION_DAYS = 7;

export interface CurrentUser {
  id: string;
  email: string;
  role: Role;
  schoolId: string;
  schoolName: string;
  timezone: string;
  displayName: string;
  avatarColor: string;
  avatarEmoji: string | null;
  locale: "en" | "ro";
  gradeLevel: number | null;
  onboarded: boolean;
  accountState: "active" | "pending_guardian_consent" | "suspended";
  permissions: string[];
  isDemo: boolean;
}

export async function createSession(userId: string): Promise<void> {
  const token = randomToken(32);
  const expires = new Date(Date.now() + SESSION_DAYS * 86400_000);
  const ua = (await headers()).get("user-agent")?.slice(0, 200) ?? null;
  const sessions = await col(C.sessions);
  await sessions.insertOne({ _id: sha256(token) as never, user_id: userId, expires_at: expires, created_at: new Date(), user_agent: ua });
  await (await col(C.users)).updateOne({ _id: userId as never }, { $set: { last_login_at: new Date(), failed_logins: 0, locked_until: null } });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await (await col(C.sessions)).deleteOne({ _id: sha256(token) as never });
  }
  jar.delete(SESSION_COOKIE);
}

/** Revoke every session for a user (password reset, account disable). */
export async function revokeAllSessions(userId: string): Promise<void> {
  await (await col(C.sessions)).deleteMany({ user_id: userId });
}

export async function loadUser(userId: string): Promise<CurrentUser | null> {
  const user = await (await col(C.users)).findOne({ _id: userId as never, status: "active" });
  if (!user) return null;
  const p = await (await col(C.profiles)).findOne({ _id: userId as never });
  if (!p) return null;
  const school = await (await col(C.schools)).findOne({ _id: p.school_id as never });
  if (!school) return null;
  const permissions = (await (await col(C.staffPermissions)).find({ user_id: userId, school_id: p.school_id }).toArray()).map((r) => String(r.permission));
  return {
    id: userId,
    email: user.email,
    role: p.role,
    schoolId: String(p.school_id),
    schoolName: school.name,
    timezone: school.timezone ?? "Europe/Bucharest",
    displayName: p.display_name,
    avatarColor: p.avatar_color,
    avatarEmoji: p.avatar_emoji ?? null,
    locale: p.locale ?? "en",
    gradeLevel: p.grade_level ?? null,
    onboarded: Boolean(p.onboarded),
    accountState: p.account_state,
    permissions,
    isDemo: Boolean(user.is_demo),
  };
}

/** The signed-in user for this request, or null. Memoised per request. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await (await col(C.sessions)).findOne({ _id: sha256(token) as never, expires_at: { $gt: new Date() } });
  if (!session) return null;
  return loadUser(String(session.user_id));
});

/**
 * Require a signed-in user, optionally with one of the given roles.
 * Redirects to login (unauthenticated) or to the user's own home (wrong role).
 */
export async function requireUser(roles?: Role[]): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (roles && !roles.includes(user.role)) redirect(ROLE_HOME[user.role]);
  return user;
}

export async function requirePermission(permission: string): Promise<CurrentUser> {
  const user = await requireUser();
  if (!user.permissions.includes(permission)) redirect(ROLE_HOME[user.role]);
  return user;
}

export { AuthorizationError };

/** For server actions: throw instead of redirecting. */
export async function assertUser(roles?: Role[]): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthorizationError("Please sign in again.");
  if (roles && !roles.includes(user.role)) throw new AuthorizationError();
  if (user.accountState === "suspended") throw new AuthorizationError("This account is suspended.");
  return user;
}
