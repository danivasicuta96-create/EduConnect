import { Portal } from "@/components/shell/portal";

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return <Portal roles={["admin"]}>{children}</Portal>;
}
