"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { swapMealAction } from "@/app/week/actions";
import { MEAL_STYLE, MealIcon, ShuffleIcon, iconButton, servingsText } from "@/components/meal-ui";
import type { MealType } from "@/lib/nutrition";

export interface TodayMeal {
  meal: MealType;
  recipeId: number | null;
  title: string | null;
  portion: number;
  kcal: number;
  proteinG: number;
  locked: boolean;
  isLeftover: boolean;
}

export default function TodayMeals({ day, meals }: { day: number; meals: TodayMeal[] }) {
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<MealType | null>(null);
  const [error, setError] = useState("");

  function swap(meal: MealType) {
    setError("");
    if (!navigator.onLine) {
      setError("You're offline — changing the plan needs internet.");
      return;
    }
    setBusy(meal);
    startTransition(async () => {
      try {
        const r = await swapMealAction(day, meal);
        if (!r.ok) setError(r.error);
      } catch {
        setError(navigator.onLine ? "Something went wrong. Please try again." : "You're offline — changing the plan needs internet.");
      } finally {
        setBusy(null);
      }
    });
  }

  return (
    <section aria-labelledby="today-meals" className="space-y-3" aria-busy={pending}>
      <div className="flex items-baseline justify-between">
        <h2 id="today-meals" className="text-xl font-bold tracking-tight">
          Today&apos;s meals
        </h2>
        <Link href="/week" className="text-sm font-semibold text-emerald-700 hover:underline dark:text-emerald-400">
          Whole week →
        </Link>
      </div>
      {error && (
        <p role="alert" className="rounded-2xl bg-red-50 p-3 text-sm text-red-700 motion-safe:animate-fade-up dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}
      <ul className="space-y-3">
        {meals.map((m, i) => {
          const style = MEAL_STYLE[m.meal];
          return (
            <li
              key={`${m.meal}-${m.recipeId ?? "empty"}-${m.portion}`}
              style={{ animationDelay: `${i * 80}ms` }}
              className={`group relative overflow-hidden rounded-3xl border border-zinc-200/80 bg-gradient-to-br ${style.glow} to-white to-60% p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md motion-safe:animate-fade-up dark:border-zinc-800 dark:to-zinc-900`}
            >
              <div className="flex items-center gap-4">
                <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${style.badge} transition group-hover:scale-105`}>
                  <MealIcon meal={m.meal} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wide muted">
                    {style.label}
                    {m.isLeftover && " · leftovers"}
                    {m.locked && " · locked"}
                  </p>
                  {m.recipeId ? (
                    <>
                      <Link
                        href={`/recipes/${m.recipeId}?portion=${m.portion}`}
                        className="block text-lg font-semibold leading-snug after:absolute after:inset-0 hover:underline"
                      >
                        {m.title}
                      </Link>
                      <p className="mt-1 flex flex-wrap gap-1.5">
                        <span className="chip">{Math.round(m.kcal)} kcal</span>
                        <span className="chip">{Math.round(m.proteinG)} g protein</span>
                        <span className="chip">{servingsText(m.portion)}</span>
                      </p>
                    </>
                  ) : (
                    <p className="text-sm muted">No safe recipe for this meal yet.</p>
                  )}
                </div>
                {!m.locked && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => swap(m.meal)}
                    className={`${iconButton} relative z-10`}
                    aria-label={`${m.recipeId ? "Swap" : "Fill"} ${style.label.toLowerCase()}`}
                    title={m.recipeId ? "Swap" : "Fill"}
                  >
                    <ShuffleIcon spinning={busy === m.meal} />
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
