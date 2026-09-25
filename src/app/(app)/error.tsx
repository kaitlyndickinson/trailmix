"use client";

import { primaryButtonClass } from "@/components/ui";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mt-10 flex flex-col items-center gap-4 text-center">
      <h1 className="text-xl font-semibold">Something went sideways</h1>
      <p className="text-foreground/70">
        {error.message || "Please try again."}
      </p>
      <button type="button" onClick={reset} className={primaryButtonClass}>
        Try again
      </button>
    </div>
  );
}
