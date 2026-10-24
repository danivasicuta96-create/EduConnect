import { SubNav } from "@/components/sub-nav";

export function WellbeingNav() {
  return (
    <SubNav
      label="Wellbeing"
      items={[
        { href: "/student/wellbeing", label: "Daily check-in", exact: true },
        { href: "/student/wellbeing/history", label: "My trends" },
        { href: "/student/wellbeing/assistant", label: "Assistant & exercises" },
        { href: "/student/wellbeing/support", label: "Get support" },
      ]}
    />
  );
}
