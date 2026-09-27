"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  regenerateDayAction,
  regenerateWeekAction,
  setLeftoversAction,
  swapMealAction,
  toggleLockAction,
} from "@/app/week/actions";
import type { Nutrients } from "@/lib/library";
import type { MealType } from "@/lib/nutrition";

export interface WeekMeal {
  meal: MealType;
  recipeId: number | null; // null = empty (no safe recipe)
  title: string | null;
  portion: number;
  kcal: number;
  locked: boolean;
  isLeftover: boolean;
}

export interface WeekDay {
  day: number;
  label: string; // e.g. "Mon 28 Sep"
  isToday: boolean;
  meals: WeekMeal[];
  totals: Nutrients;
}

interface WeekViewProps {
  days: WeekDay[];
  targetKcal: number;
  targetProteinG: number;
  leftovers: boolean;
  notes: string[];
}

const MEAL_LABEL: Record<MealType, string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner" };
const smallButton =
  "rounded-lg border border-zinc-300 px-2 py-1 text-xs font-medium hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800";

const servingsText = (p: number) => `${p} serving${p === 1 ? "" : "s"}`;

export default function WeekView({ days, targetKcal, targetProteinG, leftovers, notes }: WeekViewProps) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  function run(task: () => Promise<{ ok: true; notes?: string[] } | { ok: false; error: string }>) {
    setMessage(null);
    startTransition(async () => {
      const r = await task();
      if (!r.ok) setMessage({ tone: "error", text: r.error });
      else if (r.notes && r.notes.length > 0) setMessage({ tone: "ok", text: r.notes.join(" ") });
    });
  }

  return (
    <div className="space-y-6" aria-busy={pending}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={leftovers}
            disabled={pending}
            onChange={(e) => run(() => setLeftoversAction(e.target.checked))}
            className="h-5 w-5 accent-emerald-700"
          />
          Leftovers mode (tonight&apos;s dinner = tomorrow&apos;s lunch)
        </label>
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => regenerateWeekAction())}
          className="rounded-xl border border-zinc-300 px-4 py-2 text-sm font-semibold hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          New week plan
        </button>
      </div>

      {notes.map((n) => (
        <p key={n} role="status" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          {n}
        </p>
      ))}
      {message && (
        <p
          role={message.tone === "error" ? "alert" : "status"}
          className={`rounded-lg p-3 text-sm ${
            message.tone === "error"
              ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
              : "bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
          }`}
        >
          {message.text}
        </p>
      )}
      {pending && (
        <p role="status" className="text-sm text-zinc-600 dark:text-zinc-400">
          Updating your plan…
        </p>
      )}

      <ol className="space-y-4">
        {days.map((d) => {
          const pct = targetKcal > 0 ? Math.round((d.totals.kcal / targetKcal) * 100) : 0;
          return (
            <li
              key={d.day}
              className={`rounded-xl border p-4 ${d.isToday ? "border-emerald-700" : "border-zinc-200 dark:border-zinc-800"}`}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-lg font-bold">
                  {d.label}
                  {d.isToday && <span className="ml-2 rounded-full bg-emerald-700 px-2 py-0.5 text-xs text-white">Today</span>}
                </h2>
                <span className="text-sm text-zinc-600 dark:text-zinc-400">
                  {Math.round(d.totals.kcal)} / {targetKcal.toLocaleString()} kcal · {Math.round(d.totals.proteinG)}/{targetProteinG} g protein
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800" role="img" aria-label={`${pct}% of daily calories planned`}>
                <div className={`h-full ${pct > 110 ? "bg-amber-500" : "bg-emerald-600"}`} style={{ width: `${Math.min(pct, 100)}%` }} />
              </div>

              <ul className="mt-3 divide-y divide-zinc-200 dark:divide-zinc-800">
                {d.meals.map((m) => (
                  <li key={m.meal} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
                        {MEAL_LABEL[m.meal]}
                        {m.locked && " · 🔒 locked"}
                        {m.isLeftover && " · leftovers"}
                      </p>
                      {m.recipeId ? (
                        <p>
                          <Link href={`/recipes/${m.recipeId}?portion=${m.portion}`} className="font-medium hover:underline">
                            {m.title}
                          </Link>{" "}
                          <span className="text-sm text-zinc-600 dark:text-zinc-400">
                            · {servingsText(m.portion)} · {Math.round(m.kcal)} kcal
                          </span>
                        </p>
                      ) : (
                        <p className="text-sm text-zinc-600 dark:text-zinc-400">No safe recipe yet</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={pending || m.locked}
                        onClick={() => run(() => swapMealAction(d.day, m.meal))}
                        className={smallButton}
                      >
                        {m.recipeId ? "Swap" : "Fill"}
                        <span className="sr-only"> {MEAL_LABEL[m.meal]} on {d.label}</span>
                      </button>
                      {m.recipeId && (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => run(() => toggleLockAction(d.day, m.meal))}
                          aria-pressed={m.locked}
                          className={smallButton}
                        >
                          {m.locked ? "Unlock" : "Lock"}
                          <span className="sr-only"> {MEAL_LABEL[m.meal]} on {d.label}</span>
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => regenerateDayAction(d.day))}
                className="mt-2 text-sm font-semibold text-emerald-700 hover:underline disabled:opacity-60 dark:text-emerald-400"
              >
                New meals for {d.label.split(" ")[0]}
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
