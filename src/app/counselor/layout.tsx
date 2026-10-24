import { Portal } from "@/components/shell/portal";

export default function CounselorLayout({ children }: LayoutProps<"/counselor">) {
  return <Portal roles={["counselor"]}>{children}</Portal>;
}
