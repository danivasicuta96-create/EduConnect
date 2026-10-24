"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";
import { Button, EmptyState } from "@/components/ui";

export default function CounselorError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div role="alert">
      <EmptyState icon={TriangleAlert} title="This page couldn't be loaded" action={<Button onClick={() => retry()}>Try again</Button>}>
        Nothing was changed. If this keeps happening, contact your school administrator.
      </EmptyState>
    </div>
  );
}
