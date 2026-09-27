"use client";

import Link from "next/link";
import { type FormEvent, type ReactNode, useState, useTransition } from "react";
import { createHouseholdAction, createInviteAction, joinHouseholdAction, leaveHouseholdAction } from "@/app/household/actions";
import { inviteMessage } from "@/lib/household";
import type { Household } from "@/lib/household-server";

const inputClass = "mt-1 block w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-base dark:border-zinc-700";
const primary = "rounded-xl bg-emerald-700 px-4 py-2 font-semibold text-white hover:bg-emerald-800 disabled:opacity-60";
const secondary =
  "rounded-xl border border-zinc-300 px-4 py-2 font-semibold hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-800";

export default function HouseholdPanel({ household, appUrl }: { household: Household | null; appUrl: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [create, setCreate] = useState({ name: "", displayName: "" });
  const [join, setJoin] = useState({ code: "", displayName: "" });

  function run(task: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    setError("");
    if (!navigator.onLine) {
      setError("You're offline — this needs internet.");
      return;
    }
    startTransition(async () => {
      try {
        const r = await task();
        if (!r.ok) setError(r.error);
      } catch {
        setError("Something went wrong. Please try again.");
      }
    });
  }

  const errorBox = error && (
    <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
      {error}
    </p>
  );

  if (!household) {
    return (
      <div className="space-y-6">
        {errorBox}
        <Card title="Start a household">
          <form
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              run(() => createHouseholdAction(create.name, create.displayName));
            }}
            className="space-y-3"
          >
            <Field label="Household name">
              <input value={create.name} onChange={(e) => setCreate({ ...create, name: e.target.value })} maxLength={60} placeholder="e.g. Sharma family" required className={inputClass} />
            </Field>
            <Field label="Your name (what others will see)">
              <input value={create.displayName} onChange={(e) => setCreate({ ...create, displayName: e.target.value })} maxLength={40} required className={inputClass} />
            </Field>
            <button type="submit" disabled={pending} className={primary}>
              Create household
            </button>
          </form>
        </Card>
        <Card title="Join with a code">
          <form
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              run(() => joinHouseholdAction(join.code, join.displayName));
            }}
            className="space-y-3"
          >
            <Field label="Invite code">
              <input value={join.code} onChange={(e) => setJoin({ ...join, code: e.target.value })} maxLength={12} autoCapitalize="characters" placeholder="8 letters and numbers" required className={`${inputClass} uppercase tracking-widest`} />
            </Field>
            <Field label="Your name (what others will see)">
              <input value={join.displayName} onChange={(e) => setJoin({ ...join, displayName: e.target.value })} maxLength={40} required className={inputClass} />
            </Field>
            <button type="submit" disabled={pending} className={primary}>
              Join household
            </button>
          </form>
        </Card>
      </div>
    );
  }

  const invite = household.invite;
  return (
    <div className="space-y-6">
      {errorBox}
      <Card title={household.name}>
        <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {household.members.map((m, i) => (
            <li key={i} className="flex items-center justify-between py-2 text-sm">
              <span className="font-medium">
                {m.displayName}
                {m.isMe && " (you)"}
              </span>
              {m.role === "owner" && <span className="text-xs text-zinc-600 dark:text-zinc-400">Started it</span>}
            </li>
          ))}
        </ul>
        <Link href="/shopping?list=household" className={`mt-4 inline-block ${primary}`}>
          Open shared shopping list
        </Link>
      </Card>

      <Card title="Invite someone">
        {invite ? (
          <div className="space-y-3">
            <p className="text-sm">
              Code: <span className="font-mono text-2xl font-bold tracking-widest">{invite.code}</span>
            </p>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              Works for 7 days (until {new Date(invite.expiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}).
            </p>
            <div className="flex flex-wrap gap-2">
              <a
                href={`https://wa.me/?text=${encodeURIComponent(inviteMessage(invite.code, household.name, appUrl))}`}
                target="_blank"
                rel="noopener noreferrer"
                className={primary}
              >
                Send on WhatsApp<span className="sr-only"> (opens in a new tab)</span>
              </a>
              <button type="button" disabled={pending} onClick={() => run(() => createInviteAction())} className={secondary}>
                New code
              </button>
            </div>
          </div>
        ) : (
          <button type="button" disabled={pending} onClick={() => run(() => createInviteAction())} className={primary}>
            Create invite code
          </button>
        )}
      </Card>

      <button
        type="button"
        disabled={pending}
        onClick={() => window.confirm(`Leave "${household.name}"? Your own plan stays; you'll stop sharing the shopping list.`) && run(() => leaveHouseholdAction())}
        className={secondary}
      >
        Leave household
      </button>
    </div>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <h2 className="text-lg font-bold">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-sm font-medium">
      {label}
      {children}
    </label>
  );
}
