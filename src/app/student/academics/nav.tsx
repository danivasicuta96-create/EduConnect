import { SubNav } from "@/components/sub-nav";

export function AcademicsNav() {
  return (
    <SubNav
      label="Academics"
      items={[
        { href: "/student/academics", label: "Overview", exact: true },
        { href: "/student/academics/grades", label: "Grades & calculator" },
        { href: "/student/academics/attendance", label: "Attendance" },
        { href: "/student/academics/timetable", label: "Timetable" },
        { href: "/student/tutor", label: "AI tutor" },
      ]}
    />
  );
}
