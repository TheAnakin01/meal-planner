"use client";

import { useActionState, useState } from "react";
import { type AuthState, authenticate } from "@/app/login/actions";

type Mode = "signin" | "signup";

const inputClass =
  "mt-1 block w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-3 text-base " +
  "focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/30 dark:border-zinc-700";

export default function AuthForm({ next }: { next: string }) {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [state, formAction, pending] = useActionState<AuthState, FormData>(authenticate, {});

  if (state.message) {
    return (
      <div role="status" className="rounded-xl border border-emerald-600 bg-emerald-50 p-5 dark:bg-emerald-950">
        <h2 className="font-semibold">Check your email</h2>
        <p className="mt-2 text-sm">{state.message}</p>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Can&apos;t find it? Look in your spam or junk folder. It can take a few minutes to arrive.
        </p>
      </div>
    );
  }

  const tab = (value: Mode, label: string) => (
    <button
      type="button"
      onClick={() => setMode(value)}
      aria-pressed={mode === value}
      className={`flex-1 rounded-md px-3 py-2 text-sm font-medium ${
        mode === value ? "bg-white shadow-sm dark:bg-zinc-700" : "text-zinc-600 dark:text-zinc-400"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-6">
      <div className="flex rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800" role="group" aria-label="Sign in or create account">
        {tab("signin", "Sign in")}
        {tab("signup", "Create account")}
      </div>

      <form action={formAction} className="space-y-5">
        <input type="hidden" name="mode" value={mode} />
        <input type="hidden" name="next" value={next} />

        <div>
          <label htmlFor="email" className="block font-semibold">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="password" className="block font-semibold">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            required
            minLength={8}
            aria-describedby={mode === "signup" ? "password-hint" : undefined}
            className={inputClass}
          />
          {mode === "signup" && (
            <p id="password-hint" className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              At least 8 characters.
            </p>
          )}
        </div>

        {state.error && (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-xl bg-emerald-600 px-6 py-4 text-lg font-semibold text-white hover:bg-emerald-700 focus:outline-none focus:ring-4 focus:ring-emerald-600/40 disabled:opacity-60"
        >
          {pending ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
        </button>
      </form>
    </div>
  );
}
