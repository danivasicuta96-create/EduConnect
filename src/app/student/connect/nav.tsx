import { SubNav } from "@/components/sub-nav";

export function ConnectNav({ incoming = 0 }: { incoming?: number }) {
  return (
    <SubNav
      label="Connect"
      items={[
        { href: "/student/connect", label: "Discover", exact: true },
        { href: "/student/connections", label: incoming ? `Connections (${incoming} new)` : "Connections" },
        { href: "/student/groups", label: "Study groups" },
      ]}
    />
  );
}
