import "server-only";
import { headers } from "next/headers";

/** Best-effort client IP for rate limiting (trust the first proxy hop). */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
}

export function demoModeEnabled(): boolean {
  return process.env.DEMO_MODE !== "false";
}
