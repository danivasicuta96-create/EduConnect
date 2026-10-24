import { Portal } from "@/components/shell/portal";

export default function TeacherLayout({ children }: LayoutProps<"/teacher">) {
  return <Portal roles={["teacher"]}>{children}</Portal>;
}
