// Loads recipes for each meal on the server and hands them to the interactive MealSection.

import MealSection from "@/components/MealSection";
import type { MealType, NutritionPlan } from "@/lib/nutrition";
import { type RecipeError, searchRecipes } from "@/lib/recipes";
import { getSavedRecipeIds } from "@/lib/saved-recipes-server";
import type { ProfileInput } from "@/lib/validation";

const MEALS: { type: MealType; title: string }[] = [
  { type: "breakfast", title: "Breakfast" },
  { type: "lunch", title: "Lunch" },
  { type: "dinner", title: "Dinner" },
];

const ERROR_MESSAGES: Record<RecipeError, string> = {
  not_configured: "Recipe suggestions aren't set up yet.",
  unauthorized: "The recipe service didn't accept our key. The site owner needs to check the Spoonacular API key.",
  quota:
    "Today's free recipe limit has been reached. New suggestions will be available after midnight UTC.",
  rate_limited: "The recipe service is busy. Please refresh the page in a minute.",
  unavailable: "We couldn't reach the recipe service. Please try again later.",
};

interface MealPlanProps {
  profile: ProfileInput;
  plan: NutritionPlan;
}

export default async function MealPlan({ profile, plan }: MealPlanProps) {
  const sections = [];
  const savedIds = await getSavedRecipeIds();

  // One after another, not in parallel: the free plan allows 1 request per second.
  for (const meal of MEALS) {
    const target = plan.meals[meal.type];
    const result = await searchRecipes({
      meal: meal.type,
      target,
      allergies: profile.allergies,
      otherAllergies: profile.otherAllergies,
      dietType: profile.dietType,
    });
    sections.push(
      <MealSection
        key={meal.type}
        mealType={meal.type}
        title={meal.title}
        targetCalories={target.calories}
        recipes={result.ok ? result.recipes : []}
        error={result.ok ? undefined : ERROR_MESSAGES[result.error]}
        savedIds={savedIds}
      />,
    );
  }

  return <div className="space-y-10">{sections}</div>;
}

export function MealPlanSkeleton() {
  return (
    <div className="space-y-10" aria-busy="true" aria-label="Loading recipes">
      {MEALS.map((meal) => (
        <div key={meal.type} className="space-y-3">
          <h2 className="text-xl font-bold">{meal.title}</h2>
          <div className="overflow-hidden motion-safe:animate-pulse rounded-xl border border-zinc-200 dark:border-zinc-800">
            <div className="aspect-[3/2] w-full bg-zinc-200 dark:bg-zinc-800" />
            <div className="space-y-2 p-4">
              <div className="h-5 w-3/4 rounded bg-zinc-200 dark:bg-zinc-800" />
              <div className="h-4 w-1/2 rounded bg-zinc-200 dark:bg-zinc-800" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
