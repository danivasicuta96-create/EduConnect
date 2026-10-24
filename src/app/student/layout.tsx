import { Portal } from "@/components/shell/portal";

export default function StudentLayout({ children }: LayoutProps<"/student">) {
  return <Portal roles={["student"]}>{children}</Portal>;
}
