"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import clsx from "clsx";
import {
  House, Handshake, Users, UsersRound, GraduationCap, ClipboardList, CalendarDays, ClipboardCheck, HeartPulse, Activity,
  Sparkles, Bot, UserRound, School, BookOpen, ChartColumn, TriangleAlert, ScrollText, MessageCircle, LifeBuoy, FileText,
  SlidersHorizontal, ShieldCheck, Lock, CreditCard, Settings, Bell, LogOut, Menu, X, BookMarked, type LucideIcon,
} from "lucide-react";
import { NAV, type IconName, type NavItem } from "./nav";
import { Avatar } from "../ui";
import { ROLE_LABELS, type Role } from "@/lib/constants";
import { logoutAction } from "@/app/(auth)/actions";

const ICONS: Record<IconName, LucideIcon> = {
  home: House, connect: Handshake, users: Users, groups: UsersRound, academics: GraduationCap, grades: ClipboardList,
  calendar: CalendarDays, attendance: ClipboardCheck, wellbeing: HeartPulse, history: Activity, assistant: Sparkles,
  tutor: Bot, profile: UserRound, classes: School, gradebook: BookOpen, analytics: ChartColumn, alerts: TriangleAlert,
  followups: ScrollText, sessions: MessageCircle, resources: LifeBuoy, reports: FileText, rules: SlidersHorizontal,
  safeguarding: ShieldCheck, consent: Lock, audit: ShieldCheck, billing: CreditCard, settings: Settings, assessments: BookMarked,
  school: School,
};

export interface ShellUser {
  displayName: string;
  role: Role;
  avatarColor: string;
  avatarEmoji: string | null;
  schoolName: string;
  isDemo: boolean;
}

function isActive(pathname: string, item: NavItem) {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/");
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={clsx("flex items-center gap-2 font-extrabold tracking-tight text-ink-900", className)}>
      <span className="grid size-8 place-items-center rounded-xl bg-brand-gradient text-white shadow-[var(--shadow-pop)]" aria-hidden>
        <Sparkles className="size-4" />
      </span>
      <span>
        EduConnect <span className="text-brand-600">AI</span>
      </span>
    </span>
  );
}

export function AppShell({ user, unread, children }: { user: ShellUser; unread: number; children: ReactNode }) {
  const pathname = usePathname();
  // The drawer remembers the path it was opened on, so navigating closes it.
  const [drawerPath, setDrawerPath] = useState<string | null>(null);
  const drawer = drawerPath === pathname;
  const setDrawer = (open: boolean) => setDrawerPath(open ? pathname : null);
  const sections = NAV[user.role];
  const primary = sections.flatMap((s) => s.items).filter((i) => i.primary);
  const hasBottomBar = primary.length > 0;

  const nav = (
    <nav aria-label="Main" className="flex flex-col gap-5">
      {sections.map((section, i) => (
        <div key={i}>
          {section.title && <p className="mb-1.5 px-3 text-xs font-bold uppercase tracking-wider text-ink-400">{section.title}</p>}
          <ul className="flex flex-col gap-0.5">
            {section.items.map((item) => {
              const Icon = ICONS[item.icon];
              const active = isActive(pathname, item);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={clsx(
                      "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition-colors",
                      active ? "bg-brand-50 text-brand-700" : "text-ink-600 hover:bg-ink-50 hover:text-ink-900",
                    )}
                  >
                    <Icon className="size-[18px] shrink-0" aria-hidden />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  const userBox = (
    <div className="flex items-center gap-3 rounded-2xl bg-ink-50 p-3">
      <Avatar name={user.displayName} color={user.avatarColor} emoji={user.avatarEmoji} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-ink-900">{user.displayName}</p>
        <p className="truncate text-xs text-ink-500">{ROLE_LABELS[user.role]}</p>
      </div>
      <form action={logoutAction}>
        <button type="submit" className="grid size-8 place-items-center rounded-lg text-ink-500 hover:bg-white hover:text-brand-700" title="Sign out">
          <LogOut className="size-4" aria-hidden />
          <span className="sr-only">Sign out</span>
        </button>
      </form>
    </div>
  );

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col gap-6 overflow-y-auto border-r border-ink-100 bg-white px-4 py-5 lg:flex">
        <Link href="/" className="px-2" aria-label="EduConnect AI home">
          <Logo />
        </Link>
        <p className="-mt-3 px-2 text-xs text-ink-500">{user.schoolName}</p>
        <div className="flex-1">{nav}</div>
        <div className="flex flex-col gap-1">
          <Link href="/settings" className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-ink-600 hover:bg-ink-50">
            <Settings className="size-[18px]" aria-hidden /> Settings & privacy
          </Link>
          {userBox}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-ink-100 bg-white/90 px-4 backdrop-blur sm:px-6">
          {!hasBottomBar && (
            <button type="button" className="grid size-10 place-items-center rounded-xl text-ink-700 hover:bg-ink-50 lg:hidden" onClick={() => setDrawer(true)} aria-label="Open menu" aria-expanded={drawer}>
              <Menu className="size-5" />
            </button>
          )}
          <Link href="/" className="lg:hidden" aria-label="EduConnect AI home">
            <Logo />
          </Link>
          <div className="flex-1" />
          {user.isDemo && <span className="hidden rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700 sm:inline">Demo — fictional data</span>}
          <Link href="/notifications" className="relative grid size-10 place-items-center rounded-xl text-ink-600 hover:bg-ink-50" aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}>
            <Bell className="size-5" aria-hidden />
            {unread > 0 && (
              <span className="absolute right-1.5 top-1.5 grid min-w-4 place-items-center rounded-full bg-brand-600 px-1 text-[10px] font-bold leading-4 text-white">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </Link>
          <Link href="/settings" className="lg:hidden" aria-label="Settings">
            <Avatar name={user.displayName} color={user.avatarColor} emoji={user.avatarEmoji} size="sm" />
          </Link>
        </header>

        <main id="main" className={clsx("mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:py-8", hasBottomBar && "pb-28 lg:pb-8")}>
          {children}
        </main>
      </div>

      {/* Mobile bottom navigation (students) */}
      {hasBottomBar && (
        <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 z-30 border-t border-ink-100 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
          <ul className="mx-auto grid max-w-lg grid-cols-5">
            {primary.map((item) => {
              const Icon = ICONS[item.icon];
              const active = isActive(pathname, item) || (item.href === "/student/connect" && /^\/student\/(connections|groups)/.test(pathname));
              return (
                <li key={item.href}>
                  <Link href={item.href} aria-current={active ? "page" : undefined} className={clsx("flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold", active ? "text-brand-600" : "text-ink-500")}>
                    <span className={clsx("grid h-7 w-12 place-items-center rounded-full transition", active && "bg-brand-50")}>
                      <Icon className="size-5" aria-hidden />
                    </span>
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}

      {/* Mobile drawer (staff) */}
      {drawer && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" className="absolute inset-0 bg-ink-950/40" onClick={() => setDrawer(false)} aria-label="Close menu" />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col gap-6 overflow-y-auto bg-white px-4 py-5 shadow-xl">
            <div className="flex items-center justify-between px-2">
              <Logo />
              <button type="button" onClick={() => setDrawer(false)} className="grid size-9 place-items-center rounded-lg hover:bg-ink-50" aria-label="Close menu">
                <X className="size-5" />
              </button>
            </div>
            <div className="flex-1">{nav}</div>
            <Link href="/settings" className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-ink-600 hover:bg-ink-50">
              <Settings className="size-[18px]" aria-hidden /> Settings & privacy
            </Link>
            {userBox}
          </div>
        </div>
      )}
    </div>
  );
}
