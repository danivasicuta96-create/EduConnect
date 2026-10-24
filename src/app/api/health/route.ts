import { NextResponse } from "next/server";

// Operational health check. Reports which settings are present (never their
// values) and whether the database answers. Error messages are sanitised so
// connection strings and credentials can never appear in the output.

export const dynamic = "force-dynamic";

function sanitise(message: string): string {
  return message
    .replace(/mongodb(\+srv)?:\/\/[^\s"']+/gi, "mongodb://<redacted>")
    .replace(/\/\/[^/\s:@]+:[^@\s]+@/g, "//<redacted>@")
    .slice(0, 300);
}

function keyStatus(): "missing" | "valid" | "invalid" {
  const raw = process.env.DATA_ENCRYPTION_KEY;
  if (!raw) return "missing";
  return Buffer.from(raw, "base64").length === 32 ? "valid" : "invalid";
}

export async function GET() {
  const env = {
    NODE_ENV: process.env.NODE_ENV ?? null,
    MONGODB_URI: process.env.MONGODB_URI ? (/^mongodb(\+srv)?:\/\//.test(process.env.MONGODB_URI) ? "set" : "set-but-malformed") : "missing",
    MONGODB_DB: process.env.MONGODB_DB ?? "educonnect (default)",
    DATA_ENCRYPTION_KEY: keyStatus(),
    DEMO_MODE: process.env.DEMO_MODE ?? "(unset → demo on)",
    APP_URL: process.env.APP_URL ? "set" : "unset (derived from request)",
    AI: process.env.ANTHROPIC_API_KEY ? "anthropic" : "demo provider",
    region: process.env.AWS_REGION ?? process.env.NETLIFY_REGION ?? null,
  };

  const started = Date.now();
  let db: Record<string, unknown>;
  try {
    const { system, COLLECTIONS } = await import("@/lib/db/mongo");
    const handle = await system();
    await handle.command({ ping: 1 });
    const [schools, users, marker] = await Promise.all([
      handle.collection(COLLECTIONS.schools).countDocuments(),
      handle.collection(COLLECTIONS.users).countDocuments(),
      handle.collection("app_meta").findOne({ _id: "demo_seed" as never }),
    ]);
    db = { ok: true, latencyMs: Date.now() - started, schools, users, demoSeeded: Boolean(marker) };
  } catch (err) {
    const e = err as { name?: string; code?: unknown; codeName?: string; message?: string };
    db = {
      ok: false,
      latencyMs: Date.now() - started,
      error: { name: e?.name ?? "Error", code: e?.code ?? null, codeName: e?.codeName ?? null, message: sanitise(String(e?.message ?? err)) },
    };
  }

  const ok = db.ok === true && env.MONGODB_URI === "set" && env.DATA_ENCRYPTION_KEY === "valid";
  return NextResponse.json({ ok, env, db, checkedAt: new Date().toISOString() }, { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
