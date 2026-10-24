import { SearchX } from "lucide-react";
import { EmptyState, LinkButton } from "@/components/ui";

export default function AlertNotFound() {
  return (
    <EmptyState icon={SearchX} title="Alert not found" action={<LinkButton href="/counselor/alerts">Back to the queue</LinkButton>}>
      It may belong to another school, or the link is incomplete.
    </EmptyState>
  );
}
