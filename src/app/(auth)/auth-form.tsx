"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signIn, signUp, type AuthState } from "./actions";
import { inputClass, labelClass, primaryButtonClass } from "@/components/ui";

export function AuthForm({
  mode,
  next,
}: {
  mode: "login" | "signup";
  next: string;
}) {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    mode === "login" ? signIn : signUp,
    {},
  );
  const nextQuery = next !== "/" ? `?next=${encodeURIComponent(next)}` : "";

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      {mode === "signup" && (
        <p className="bg-sand/60 text-foreground/70 rounded-lg p-3 text-sm">
          trailmix is invite-only. Sign up with the email address you were
          invited with.
        </p>
      )}
      {mode === "signup" && (
        <div>
          <label htmlFor="display_name" className={labelClass}>
            Your name
          </label>
          <input
            id="display_name"
            name="display_name"
            autoComplete="given-name"
            required
            maxLength={60}
            className={inputClass}
          />
        </div>
      )}
      <div>
        <label htmlFor="email" className={labelClass}>
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="password" className={labelClass}>
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          minLength={mode === "signup" ? 8 : undefined}
          required
          className={inputClass}
        />
      </div>

      {state.error && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 p-3 text-sm text-red-800"
        >
          {state.error}
        </p>
      )}

      <button type="submit" disabled={pending} className={primaryButtonClass}>
        {pending ? "One sec…" : mode === "login" ? "Sign in" : "Create account"}
      </button>

      <p className="text-foreground/70 text-center text-sm">
        {mode === "login" ? (
          <>
            New here?{" "}
            <Link
              href={`/signup${nextQuery}`}
              className="text-forest inline-flex min-h-11 items-center px-1 font-medium underline"
            >
              Create an account
            </Link>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <Link
              href={`/login${nextQuery}`}
              className="text-forest inline-flex min-h-11 items-center px-1 font-medium underline"
            >
              Sign in
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
