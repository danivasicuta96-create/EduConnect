import { Portal } from "@/components/shell/portal";

export default function SharedLayout({ children }: { children: React.ReactNode }) {
  return <Portal roles={["student", "teacher", "counselor", "admin", "parent"]}>{children}</Portal>;
}
