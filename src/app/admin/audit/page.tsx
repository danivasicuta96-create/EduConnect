import type { Metadata } from "next";
import { Download, History, KeyRound, Lock, MonitorSmartphone, UserX } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { auditActionPrefixes, listAudit, securityOverview } from "@/lib/services/admin";
import { formatDateTime } from "@/lib/dates";
import { Card, CardHeader, EmptyState, PageHeader, Stat, Table, Td, Th, buttonClass } from "@/components/ui";
import { MetadataChips, shortId } from "../_shared";
import { AuditFilter } from "./forms";
import { auditQuery, parseAuditParams } from "./params";

export const metadata: Metadata = { title: "Security & audit" };

const LIMIT = 200;

export default async function AuditPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser(["admin"]);
  const filter = parseAuditParams(await searchParams);
  const [rows, prefixes, security] = await Promise.all([listAudit(user, filter, LIMIT), auditActionPrefixes(user), securityOverview(user)]);
  const filtered = Boolean(filter.action || filter.from || filter.to);

  return (
    <div className="space-y-6 animate-fade-up">
      <PageHeader
        title="Security & audit"
        description="Sign-in activity and an append-only record of privileged actions. Metadata shows identifiers and counts only — never notes, scores or credentials."
        actions={
          <a href={`/admin/audit/export${auditQuery(filter)}`} className={buttonClass("secondary", "sm")} download>
            <Download className="size-4" aria-hidden /> Export CSV
          </a>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Active sessions" value={security.sessions} icon={MonitorSmartphone} hint={`${security.users_signed_in} people signed in`} />
        <Stat label="Locked accounts" value={security.locked} icon={Lock} tone="amber" hint="After repeated failed sign-ins" />
        <Stat label="Disabled accounts" value={security.disabled} icon={UserX} tone="red" hint="Suspended or deletion requested" />
        <Stat label="Recent failed sign-ins" value={security.failed_attempts} icon={KeyRound} tone="blue" hint="Since each user's last success" />
      </div>

      <Card>
        <CardHeader title="Audit log" icon={History} subtitle={rows.length === LIMIT ? `Latest ${LIMIT} matching events — export for the full list` : `${rows.length} event${rows.length === 1 ? "" : "s"}`} />
        <div className="mb-4">
          <AuditFilter prefixes={prefixes} action={filter.action} from={filter.from} to={filter.to} />
          {filtered && (
            <p className="mt-2 text-sm"><a href="/admin/audit" className="font-semibold text-brand-700 hover:underline">Clear filters</a></p>
          )}
        </div>
        {rows.length === 0 ? (
          <EmptyState icon={History} title="No events match">{filtered ? "Try a wider date range or another area." : "Audit events appear here as people use the platform."}</EmptyState>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>When</Th>
                <Th>Action</Th>
                <Th>Actor</Th>
                <Th>Resource</Th>
                <Th>Details</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <Td className="whitespace-nowrap text-xs text-ink-600"><time dateTime={r.created_at}>{formatDateTime(r.created_at)}</time></Td>
                  <Td><code className="text-xs font-semibold text-ink-900">{r.action}</code></Td>
                  <Td className="text-xs">{r.actor_name ?? (r.actor_id ? <span title={r.actor_id}>Former user</span> : "System")}</Td>
                  <Td className="text-xs text-ink-600">{r.resource_type ? <>{r.resource_type} <span title={r.resource_id ?? undefined}>{shortId(r.resource_id)}</span></> : "—"}</Td>
                  <Td><MetadataChips metadata={r.metadata} /></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
