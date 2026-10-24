"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

/** Horizontal tab-style navigation between related pages. Scrolls on small screens. */
export function SubNav({ items, label }: { items: Array<{ href: string; label: string; exact?: boolean }>; label: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label={label} className="-mx-4 mb-6 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex w-max gap-1 rounded-2xl bg-white p-1 ring-1 ring-ink-100">
        {items.map((item) => {
          const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={clsx(
                  "block rounded-xl px-3.5 py-2 text-sm font-semibold whitespace-nowrap transition-colors",
                  active ? "bg-brand-600 text-white" : "text-ink-600 hover:bg-ink-50",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
