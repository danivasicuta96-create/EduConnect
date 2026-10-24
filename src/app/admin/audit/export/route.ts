import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { exportAuditCsv } from "@/lib/services/admin";
import { todayIn } from "@/lib/dates";
import { parseAuditParams } from "../params";

/** CSV export of the school's audit log (admins only). The export is itself audited. */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Please sign in.", { status: 401 });
  if (user.role !== "admin" || user.accountState === "suspended") return new NextResponse("Forbidden", { status: 403 });
  const csv = await exportAuditCsv(user, parseAuditParams(req.nextUrl.searchParams));
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="audit-log-${todayIn(user.timezone)}.csv"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
