"use client";

import { useSyncExternalStore } from "react";

// One shared clock that ticks every minute. Returns null during SSR and
// hydration, so relative times ("3h ago") never cause a hydration mismatch.
let now = Date.now();

function subscribe(onChange: () => void) {
  now = Date.now();
  const id = setInterval(() => {
    now = Date.now();
    onChange();
  }, 60_000);
  return () => clearInterval(id);
}

export function useNow(): number | null {
  return useSyncExternalStore(
    subscribe,
    () => now,
    () => null,
  );
}

export function timeAgo(iso: string, nowMs: number): string {
  const minutes = Math.max(0, Math.round((nowMs - Date.parse(iso)) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
