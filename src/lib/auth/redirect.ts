import "server-only";
import { redirect } from "next/navigation";
import { getCurrentUser } from "./session";
import { ROLE_HOME } from "@/lib/constants";

/** On public auth pages: send signed-in users straight to their portal. */
export async function redirectIfSignedIn(): Promise<void> {
  const user = await getCurrentUser();
  if (user) redirect(user.onboarded ? ROLE_HOME[user.role] : "/onboarding");
}
