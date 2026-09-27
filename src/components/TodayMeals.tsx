"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { swapMealAction } from "@/app/week/actions";
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

const MEAL_LABEL: Record<MealType, string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner" };

export default function TodayMeals({ day, meals }: { day: number; meals: TodayMeal[] }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function swap(meal: MealType) {
    setError("");
    if (!navigator.onLine) {
      setError("You're offline — changing the plan needs internet.");
      return;
    }
    startTransition(async () => {
      try {
        const r = await swapMealAction(day, meal);
        if (!r.ok) setError(r.error);
      } catch {
        setError(navigator.onLine ? "Something went wrong. Please try again." : "You're offline — changing the plan needs internet.");
      }
    });
  }

  return (
    <section aria-labelledby="today-meals" className="space-y-3" aria-busy={pending}>
      <h2 id="today-meals" className="text-xl font-bold">
        Today&apos;s meals
      </h2>
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}
      <ul className="space-y-3">
        {meals.map((m) => (
          <li key={m.meal} className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
              {MEAL_LABEL[m.meal]}
              {m.isLeftover && " · leftovers"}
              {m.locked && " · 🔒 locked"}
            </p>
            {m.recipeId ? (
              <>
                <Link href={`/recipes/${m.recipeId}?portion=${m.portion}`} className="mt-1 block text-lg font-semibold hover:underline">
                  {m.title}
                </Link>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {m.portion} serving{m.portion === 1 ? "" : "s"} · {Math.round(m.kcal)} kcal · {Math.round(m.proteinG)} g protein
                </p>
              </>
            ) : (
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">No safe recipe for this meal yet.</p>
            )}
            {!m.locked && (
              <button
                type="button"
                disabled={pending}
                onClick={() => swap(m.meal)}
                className="mt-2 rounded-lg border border-zinc-300 px-3 py-1 text-sm font-medium hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                {m.recipeId ? "Swap" : "Try to fill"}
                <span className="sr-only"> {MEAL_LABEL[m.meal]}</span>
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
