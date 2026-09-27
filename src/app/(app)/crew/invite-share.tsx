"use client";

import { useState } from "react";
import { secondaryButtonClass } from "@/components/ui";

export function InviteShare({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = `${window.location.origin}/join/${code}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: "trailmix invite",
          text: "Join my hiking crew on trailmix",
          url,
        });
        return;
      } catch {
        // Share sheet dismissed or unavailable; fall back to copying.
      }
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button type="button" onClick={share} className={secondaryButtonClass}>
      {copied ? "Link copied" : "Share link"}
    </button>
  );
}
