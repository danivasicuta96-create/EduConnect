import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { requireUser } from "@/lib/auth/session";
import { unreadCount } from "@/lib/services/account";
import type { Role } from "@/lib/constants";
import { AppShell } from "./app-shell";

/** Server layout wrapper shared by every signed-in portal. */
export async function Portal({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const user = await requireUser(roles);
  if (!user.onboarded) redirect("/onboarding");
  const unread = await unreadCount(user);
  return (
    <AppShell
      user={{
        displayName: user.displayName,
        role: user.role,
        avatarColor: user.avatarColor,
        avatarEmoji: user.avatarEmoji,
        schoolName: user.schoolName,
        isDemo: user.isDemo,
      }}
      unread={unread}
    >
      {children}
    </AppShell>
  );
}
