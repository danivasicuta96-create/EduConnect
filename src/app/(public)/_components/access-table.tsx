// "Who sees what" matrix. Mirrors the access model enforced by Postgres row-level
// security (see docs/ARCHITECTURE.md → Data separation). Keep the two in sync.
import { Check, Minus, X } from "lucide-react";
import { cx } from "@/components/ui";

type Level = "full" | "partial" | "none";
type Cell = { level: Level; text: string };

const COLUMNS = ["Grades", "Check-in scores", "Private notes", "Matchmaking profile"] as const;

const ROWS: { role: string; cells: Cell[] }[] = [
  {
    role: "Student",
    cells: [
      { level: "full", text: "Your own" },
      { level: "full", text: "Your own" },
      { level: "full", text: "Only you" },
      { level: "full", text: "Yours — you choose if classmates can discover you" },
    ],
  },
  {
    role: "Teacher",
    cells: [
      { level: "partial", text: "Classes and subjects they teach" },
      { level: "partial", text: "Class averages only, groups of 5+" },
      { level: "none", text: "Never" },
      { level: "partial", text: "View only, for school moderation" },
    ],
  },
  {
    role: "Counselor",
    cells: [
      { level: "none", text: "Not by default" },
      { level: "partial", text: "Only after a support alert, with permission" },
      { level: "partial", text: "Only notes you choose to share" },
      { level: "partial", text: "View only, for school moderation" },
    ],
  },
  {
    role: "Admin",
    cells: [
      { level: "partial", text: "School records" },
      { level: "none", text: "No" },
      { level: "none", text: "Never" },
      { level: "partial", text: "View only, for school moderation" },
    ],
  },
  {
    role: "Parent",
    cells: [
      { level: "partial", text: "Linked child, with consent" },
      { level: "none", text: "No" },
      { level: "none", text: "Never" },
      { level: "none", text: "No" },
    ],
  },
];

const LEVEL = {
  full: { Icon: Check, cls: "bg-emerald-50 text-emerald-700", sr: "Yes:" },
  partial: { Icon: Minus, cls: "bg-amber-50 text-amber-800", sr: "Limited:" },
  none: { Icon: X, cls: "bg-ink-100 text-ink-600", sr: "No:" },
} as const;

function CellView({ cell }: { cell: Cell }) {
  const { Icon, cls, sr } = LEVEL[cell.level];
  return (
    <span className="flex items-start gap-2">
      <span className={cx("mt-0.5 grid size-5 shrink-0 place-items-center rounded-full", cls)}>
        <Icon className="size-3" aria-hidden strokeWidth={3} />
      </span>
      <span>
        <span className="sr-only">{sr} </span>
        {cell.text}
      </span>
    </span>
  );
}

export function AccessTable() {
  return (
    <div>
      {/* Desktop / tablet: real table */}
      <div className="hidden overflow-hidden rounded-3xl bg-white shadow-[var(--shadow-card)] ring-1 ring-ink-100 md:block">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Who can see which data in EduConnect AI, by role</caption>
          <thead className="bg-ink-50">
            <tr>
              <th scope="col" className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-ink-500">Role</th>
              {COLUMNS.map((c) => (
                <th key={c} scope="col" className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-ink-500">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row.role} className="border-t border-ink-100 align-top">
                <th scope="row" className="px-5 py-4 font-bold text-ink-900">{row.role}</th>
                {row.cells.map((cell, i) => (
                  <td key={i} className="px-5 py-4 text-ink-700"><CellView cell={cell} /></td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: one card per role, no horizontal scrolling */}
      <ul className="grid gap-3 md:hidden">
        {ROWS.map((row) => (
          <li key={row.role} className="rounded-2xl bg-white p-4 shadow-[var(--shadow-card)] ring-1 ring-ink-100">
            <h3 className="font-bold text-ink-900">{row.role}</h3>
            <dl className="mt-3 grid gap-2.5 text-sm">
              {row.cells.map((cell, i) => (
                <div key={i} className="grid grid-cols-[7.5rem_1fr] gap-2">
                  <dt className="font-semibold text-ink-500">{COLUMNS[i]}</dt>
                  <dd className="text-ink-700"><CellView cell={cell} /></dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>

      <p className="mt-4 text-sm text-ink-500">
        Access is enforced in the database with row-level security and school isolation, not only in the app. Sensitive views are written to an audit log.
      </p>
    </div>
  );
}
