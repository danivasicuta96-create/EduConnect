import type { Role } from "@/lib/constants";

export type IconName =
  | "home" | "connect" | "users" | "groups" | "academics" | "grades" | "calendar" | "attendance"
  | "wellbeing" | "history" | "assistant" | "tutor" | "profile" | "classes" | "gradebook" | "analytics"
  | "alerts" | "followups" | "sessions" | "resources" | "reports" | "rules" | "safeguarding" | "consent"
  | "audit" | "billing" | "settings" | "assessments" | "school";

export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  /** Shown in the mobile bottom bar (students only, max 5). */
  primary?: boolean;
  exact?: boolean;
}

export interface NavSection {
  title?: string;
  items: NavItem[];
}

export const NAV: Record<Role, NavSection[]> = {
  student: [
    {
      items: [
        { href: "/student", label: "Home", icon: "home", primary: true, exact: true },
        { href: "/student/connect", label: "Connect", icon: "connect", primary: true },
        { href: "/student/academics", label: "Academics", icon: "academics", primary: true },
        { href: "/student/wellbeing", label: "Wellbeing", icon: "wellbeing", primary: true },
        { href: "/student/profile", label: "Profile", icon: "profile", primary: true },
      ],
    },
    {
      title: "Social",
      items: [
        { href: "/student/connections", label: "Connections", icon: "users" },
        { href: "/student/groups", label: "Study groups", icon: "groups" },
      ],
    },
    {
      title: "Learning",
      items: [
        { href: "/student/academics/grades", label: "Grades & calculator", icon: "grades" },
        { href: "/student/academics/attendance", label: "Attendance", icon: "attendance" },
        { href: "/student/academics/timetable", label: "Timetable", icon: "calendar" },
        { href: "/student/tutor", label: "AI tutor", icon: "tutor" },
      ],
    },
    {
      title: "Wellbeing",
      items: [
        { href: "/student/wellbeing/history", label: "My trends", icon: "history" },
        { href: "/student/wellbeing/assistant", label: "Wellbeing assistant", icon: "assistant" },
        { href: "/student/wellbeing/support", label: "Get support", icon: "resources" },
      ],
    },
  ],
  teacher: [
    {
      items: [
        { href: "/teacher", label: "Dashboard", icon: "home", exact: true },
        { href: "/teacher/classes", label: "Classes & rosters", icon: "classes" },
        { href: "/teacher/gradebook", label: "Gradebook", icon: "gradebook" },
        { href: "/teacher/attendance", label: "Attendance", icon: "attendance" },
        { href: "/teacher/assessments", label: "Assessments", icon: "assessments" },
        { href: "/teacher/analytics", label: "Academic analytics", icon: "analytics" },
        { href: "/teacher/wellbeing", label: "Class wellbeing", icon: "wellbeing" },
      ],
    },
  ],
  counselor: [
    {
      items: [
        { href: "/counselor", label: "Dashboard", icon: "home", exact: true },
        { href: "/counselor/alerts", label: "Alert queue", icon: "alerts" },
        { href: "/counselor/sessions", label: "Support conversations", icon: "sessions" },
        { href: "/counselor/reports", label: "Aggregate reports", icon: "reports" },
      ],
    },
    {
      title: "Configuration",
      items: [
        { href: "/counselor/rules", label: "Alert rules", icon: "rules" },
        { href: "/counselor/resources", label: "Support resources", icon: "resources" },
        { href: "/counselor/safeguarding", label: "Safety reports", icon: "safeguarding" },
      ],
    },
  ],
  admin: [
    {
      items: [
        { href: "/admin", label: "School dashboard", icon: "school", exact: true },
        { href: "/admin/users", label: "Users & roles", icon: "users" },
        { href: "/admin/classes", label: "Classes & subjects", icon: "classes" },
        { href: "/admin/consent", label: "Consent", icon: "consent" },
        { href: "/admin/audit", label: "Security & audit", icon: "audit" },
        { href: "/admin/subscription", label: "Subscription", icon: "billing" },
        { href: "/admin/settings", label: "System configuration", icon: "settings" },
      ],
    },
  ],
  parent: [
    {
      items: [{ href: "/parent", label: "My child's progress", icon: "academics", exact: true }],
    },
  ],
};
