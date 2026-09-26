"use client";

import type { ReactNode } from "react";

/** A 44px square icon button (reorder arrows, delete ×) for list rows. */
export function IconButton({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={`flex size-11 shrink-0 items-center justify-center text-lg disabled:opacity-25 ${
        danger ? "text-red-700" : "text-foreground/60"
      }`}
    >
      {children}
    </button>
  );
}
