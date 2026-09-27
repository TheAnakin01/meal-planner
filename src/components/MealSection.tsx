"use client";

import { useState } from "react";
import MealCard from "@/components/MealCard";
import type { MealType } from "@/lib/nutrition";
import type { Recipe } from "@/lib/spoonacular";

interface MealSectionProps {
  mealType: MealType;
  title: string;
  targetCalories: number;
  recipes: Recipe[];
  // Plain-language message when recipes couldn't be loaded.
  error?: string;
  savedIds: number[];
}

export default function MealSection({
  mealType,
  title,
  targetCalories,
  recipes,
  error,
  savedIds,
}: MealSectionProps) {
  const [index, setIndex] = useState(0);
  const recipe = recipes[index];

  return (
    <section aria-labelledby={`meal-${title}`} className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id={`meal-${title}`} className="text-xl font-bold">
          {title}
        </h2>
        <span className="text-sm text-zinc-600 dark:text-zinc-400">
          Target {targetCalories.toLocaleString()} kcal
        </span>
      </div>

      {error ? (
        <Notice>{error}</Notice>
      ) : !recipe ? (
        <Notice>
          No recipes that are safe for your allergies came up this time. Refresh the page later to try a new
          set of suggestions.
        </Notice>
      ) : (
        <>
          <MealCard recipe={recipe} mealType={mealType} saved={savedIds.includes(recipe.id)} />
          {recipes.length > 1 && (
            <button
              type="button"
              onClick={() => setIndex((i) => (i + 1) % recipes.length)}
              className="w-full rounded-xl border border-zinc-300 px-4 py-3 font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              Show another{" "}
              <span className="text-sm text-zinc-600 dark:text-zinc-400">
                ({index + 1} of {recipes.length})
              </span>
            </button>
          )}
        </>
      )}
    </section>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p role="status" className="rounded-xl border border-dashed border-zinc-300 p-4 text-sm dark:border-zinc-700">
      {children}
    </p>
  );
}
