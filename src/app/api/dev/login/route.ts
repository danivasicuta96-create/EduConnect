import { NextResponse, type NextRequest } from "next/server";
import { createSession } from "@/lib/auth/session";
import { demoUserId } from "@/lib/services/auth";
import { demoModeEnabled } from "@/lib/request";

/**
 * Development-only shortcut for automated checks: signs in as a *demo* user.
 * Returns 404 in production builds and when demo mode is off.
 *   curl -c jar.txt "http://localhost:3000/api/dev/login?email=maria.georgescu@aurora.demo"
 */
export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV !== "development" || !demoModeEnabled()) {
    return new NextResponse("Not found", { status: 404 });
  }
  const email = req.nextUrl.searchParams.get("email") ?? "";
  const id = await demoUserId(email);
  if (!id) return NextResponse.json({ error: "unknown demo user" }, { status: 404 });
  await createSession(id);
  return NextResponse.json({ ok: true });
}
