import { Portal } from "@/components/shell/portal";

export default function ParentLayout({ children }: LayoutProps<"/parent">) {
  return <Portal roles={["parent"]}>{children}</Portal>;
}
