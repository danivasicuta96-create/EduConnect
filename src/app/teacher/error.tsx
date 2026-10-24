"use client";

import { TriangleAlert } from "lucide-react";
import { Button, EmptyState } from "@/components/ui";

export default function TeacherError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const safe = error.name === "AuthorizationError" || error.name === "UserFacingError";
  return (
    <EmptyState
      icon={TriangleAlert}
      title={safe ? "This page isn't available" : "Something went wrong"}
      action={<Button variant="secondary" onClick={reset}>Try again</Button>}
    >
      {safe ? error.message : "We couldn't load this page. Please try again in a moment."}
    </EmptyState>
  );
}
