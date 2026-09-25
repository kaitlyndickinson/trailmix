"use client";

import { useActionState } from "react";
import { joinCrew, type JoinState } from "./actions";
import {
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui";

export function JoinForm({
  initialCode = "",
  prominent = false,
}: {
  initialCode?: string;
  prominent?: boolean;
}) {
  const [state, formAction, pending] = useActionState<JoinState, FormData>(
    joinCrew,
    {},
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="flex gap-2">
        <input
          name="code"
          defaultValue={initialCode}
          placeholder="ABCD1234"
          aria-label="Invite code"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          required
          className={`${inputClass} font-mono tracking-widest uppercase`}
        />
        <button
          type="submit"
          disabled={pending}
          className={prominent ? primaryButtonClass : secondaryButtonClass}
        >
          {pending ? "Joining…" : "Join"}
        </button>
      </div>
      {state.error && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 p-3 text-sm text-red-800"
        >
          {state.error}
        </p>
      )}
    </form>
  );
}
