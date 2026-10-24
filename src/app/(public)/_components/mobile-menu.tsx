"use client";

// Mobile navigation built on <details>, so it opens and closes without JavaScript.
// The client part only closes the panel after a client-side navigation or Escape.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { Menu, X } from "lucide-react";
import { buttonClass } from "@/components/ui";
import { PUBLIC_NAV } from "./nav";

export function MobileMenu() {
  const ref = useRef<HTMLDetailsElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (ref.current) ref.current.open = false;
  }, [pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && ref.current?.open) {
        ref.current.open = false;
        ref.current.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <details ref={ref} className="group md:hidden">
      <summary
        className="grid size-10 cursor-pointer list-none place-items-center rounded-xl text-ink-800 ring-1 ring-inset ring-ink-200 hover:bg-ink-50 [&::-webkit-details-marker]:hidden"
        aria-label="Menu"
      >
        <Menu className="size-5 group-open:hidden" aria-hidden />
        <X className="hidden size-5 group-open:block" aria-hidden />
      </summary>
      <div className="absolute inset-x-0 top-full border-b border-ink-100 bg-white px-4 pb-5 pt-2 shadow-[var(--shadow-card)]">
        <nav aria-label="Mobile">
          <ul className="flex flex-col">
            {PUBLIC_NAV.map((item) => {
              const active = pathname === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={
                      "block rounded-xl px-3 py-3 font-semibold " +
                      (active ? "bg-brand-50 text-brand-700" : "text-ink-800 hover:bg-ink-50")
                    }
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Link href="/login" className={buttonClass("secondary", "md")}>Sign in</Link>
          <Link href="/register" className={buttonClass("primary", "md")}>Get started</Link>
        </div>
      </div>
    </details>
  );
}
