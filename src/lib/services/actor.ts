import type { Role } from "@/lib/constants";
import { AuthorizationError } from "./errors";

/** The minimum identity a service needs. `CurrentUser` satisfies it. */
export interface Actor {
  id: string;
  schoolId: string;
  role: Role;
  timezone: string;
  permissions: string[];
  accountState?: "active" | "pending_guardian_consent" | "suspended";
}

export function assertRole(actor: Actor, ...roles: Role[]): void {
  if (!roles.includes(actor.role)) throw new AuthorizationError();
}

export function assertPermission(actor: Actor, permission: string): void {
  if (!actor.permissions.includes(permission)) throw new AuthorizationError();
}
