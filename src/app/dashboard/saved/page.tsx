import type { Metadata } from "next";
import Link from "next/link";
import SaveButton from "@/components/SaveButton";
import { MEAL_TYPES, spoonacularRecipeUrl } from "@/lib/saved-recipes";
import { getSavedRecipes } from "@/lib/saved-recipes-server";

export const metadata: Metadata = {
  title: "Saved recipes · Meal Planner",
};

const MEAL_LABELS = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner" } as const;

// No Spoonacular calls here: we only show what we're allowed to store (id, title, image),
// so viewing this page costs no API points.
export default async function SavedRecipesPage() {
  const saved = await getSavedRecipes();

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:py-12">
      <h1 className="text-3xl font-bold">Saved recipes</h1>

      {saved.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-zinc-300 p-6 text-center dark:border-zinc-700">
          <p>You haven&apos;t saved any recipes yet.</p>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Tap <span aria-hidden>♡</span> Save on a recipe in Discover to keep it here.
          </p>
          <Link
            href="/discover"
            className="mt-4 inline-block rounded-xl bg-emerald-700 px-5 py-3 font-semibold text-white hover:bg-emerald-800"
          >
            Go to Discover
          </Link>
        </div>
      ) : (
        MEAL_TYPES.map((meal) => {
          const recipes = saved.filter((r) => r.mealType === meal);
          if (recipes.length === 0) return null;
          return (
            <section key={meal} aria-labelledby={`saved-${meal}`} className="mt-8">
              <h2 id={`saved-${meal}`} className="text-xl font-bold">
                {MEAL_LABELS[meal]}
              </h2>
              <ul className="mt-3 space-y-3">
                {recipes.map((r) => (
                  <li
                    key={r.recipeId}
                    className="flex items-center gap-3 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800"
                  >
                    {r.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={r.imageUrl}
                        alt=""
                        loading="lazy"
                        className="h-16 w-20 shrink-0 rounded-lg bg-zinc-100 object-cover dark:bg-zinc-800"
                      />
                    ) : (
                      <div className="h-16 w-20 shrink-0 rounded-lg bg-zinc-100 dark:bg-zinc-800" aria-hidden />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold leading-snug">{r.title}</p>
                      <a
                        href={spoonacularRecipeUrl(r.recipeId, r.title)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
                      >
                        View recipe<span className="sr-only"> for {r.title} (opens in a new tab)</span> →
                      </a>
                    </div>
                    <SaveButton
                      recipe={{ recipeId: r.recipeId, title: r.title, imageUrl: r.imageUrl, mealType: r.mealType }}
                      initiallySaved
                      variant="icon"
                    />
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}

      <p className="mt-10 text-xs text-zinc-600 dark:text-zinc-400">
        Nutrition isn&apos;t shown here because Spoonacular&apos;s terms don&apos;t let us store it. Tap
        &ldquo;View recipe&rdquo; for full details, and always check ingredient labels.
      </p>
    </main>
  );
}
