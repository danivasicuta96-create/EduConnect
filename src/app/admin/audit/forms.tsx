"use client";

import { Filter } from "lucide-react";
import { Input, Select } from "@/components/forms";
import { buttonClass } from "@/components/ui";

export function AuditFilter({ prefixes, action, from, to }: { prefixes: string[]; action: string; from?: string; to?: string }) {
  const known = prefixes.includes(action.split(".")[0]) && !action.includes(".");
  return (
    <form method="get" role="search" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_auto] lg:items-end">
      <div>
        <label htmlFor="audit-area" className="mb-1.5 block text-sm font-semibold text-ink-800">Area</label>
        <Select id="audit-area" name="action" defaultValue={known ? action : ""}>
          <option value="">All areas</option>
          {prefixes.map((p) => <option key={p} value={p}>{p}</option>)}
        </Select>
      </div>
      <div>
        <label htmlFor="audit-prefix" className="mb-1.5 block text-sm font-semibold text-ink-800">
          Or action prefix
        </label>
        <Input id="audit-prefix" name="prefix" defaultValue={known ? "" : action} placeholder="e.g. permission.granted" pattern="[A-Za-z_.]*" maxLength={60} />
      </div>
      <div>
        <label htmlFor="audit-from" className="mb-1.5 block text-sm font-semibold text-ink-800">From</label>
        <Input id="audit-from" name="from" type="date" defaultValue={from} />
      </div>
      <div>
        <label htmlFor="audit-to" className="mb-1.5 block text-sm font-semibold text-ink-800">To</label>
        <Input id="audit-to" name="to" type="date" defaultValue={to} />
      </div>
      <button type="submit" className={buttonClass("secondary")}><Filter className="size-4" aria-hidden /> Apply</button>
    </form>
  );
}
