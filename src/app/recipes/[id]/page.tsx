import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { allergenLabel } from "@/lib/allergens";
import { dietLabel } from "@/lib/diet";
import { type RecipeRow, recipeFromRow } from "@/lib/library";
import { getAllIngredients } from "@/lib/library-server";
import { getCurrentProfile } from "@/lib/profile-server";
import { DEFAULT_STORE, storeName, storeSearchUrl } from "@/lib/stores";
import { type SwapSuggestion, suggestSwaps } from "@/lib/swaps";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Recipe · Meal Planner",
};

interface LineRow {
  grams: number | string;
  display_amount: string;
  note: string;
  ingredients: { id: number; name: string; search_term: string } | null;
}

// Water, salt and pinches of spice aren't worth swapping.
const NOT_SWAPPABLE = new Set(["water", "salt"]);
const MIN_SWAP_GRAMS = 5;

// Portions shown in the plan are 0.5×–2× in 0.25 steps; anything else falls back to 1 serving.
function parsePortion(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0.25 && n <= 3 ? n : 1;
}

const fmt = (n: number) => (Math.round(n * 10) / 10).toString();

// Published recipe detail (RLS only returns drafts to admins).
export default async function RecipePage({ params, searchParams }: PageProps<"/recipes/[id]">) {
  const { id } = await params;
  const recipeId = Number(id);
  if (!Number.isInteger(recipeId) || recipeId <= 0) notFound();
  const portion = parsePortion((await searchParams).portion);

  const supabase = await createClient();
  const { data: row } = await supabase.from("recipes").select("*").eq("id", recipeId).maybeSingle<RecipeRow>();
  if (!row) notFound();
  const recipe = recipeFromRow(row);

  const { data: lines } = await supabase
    .from("recipe_ingredients")
    .select("grams, display_amount, note, ingredients(id, name, search_term)")
    .eq("recipe_id", recipeId)
    .order("position")
    .returns<LineRow[]>();

  const [profile, library] = await Promise.all([getCurrentProfile(), getAllIngredients()]);
  const store = profile?.preferredStore ?? DEFAULT_STORE;
  const byId = new Map(library.map((i) => [i.id, i]));
  // Safe substitutes for each ingredient (only for ingredients worth swapping).
  const swapsFor = (l: LineRow): SwapSuggestion[] => {
    const original = l.ingredients && byId.get(Number(l.ingredients.id));
    if (!profile || !original || NOT_SWAPPABLE.has(original.name) || Number(l.grams) < MIN_SWAP_GRAMS) return [];
    return suggestSwaps(original, Number(l.grams), library, profile);
  };
  const n = recipe.perServing;
  const totalMinutes = recipe.prepMinutes + recipe.cookMinutes;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-8 sm:py-12">
      <Link href="/week" className="text-sm font-semibold text-emerald-700 hover:underline dark:text-emerald-400">
        ← This week
      </Link>
      <div>
        <h1 className="text-3xl font-bold">{recipe.title}</h1>
        {recipe.description && <p className="mt-2 text-zinc-600 dark:text-zinc-400">{recipe.description}</p>}
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Makes {recipe.servings} serving{recipe.servings === 1 ? "" : "s"}
          {totalMinutes > 0 && ` · ${totalMinutes} min`}
          {recipe.status === "draft" && " · DRAFT (only admins see this)"}
        </p>
      </div>

      {n && (
        <section aria-labelledby="nutrition" className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <h2 id="nutrition" className="font-semibold">
            Your portion: {portion} serving{portion === 1 ? "" : "s"}
          </h2>
          <p className="mt-1 text-lg">
            <strong>{Math.round(n.kcal * portion)} kcal</strong> · Protein {fmt(n.proteinG * portion)} g · Carbs{" "}
            {fmt(n.carbsG * portion)} g · Fat {fmt(n.fatG * portion)} g
          </p>
          <p className="mt-2 text-sm">
            <span className="font-semibold">Contains:</span>{" "}
            {recipe.allergenTags.length > 0 ? recipe.allergenTags.map(allergenLabel).join(", ") : "none of the 16 listed allergens"}
          </p>
          <p className="text-sm">
            <span className="font-semibold">Suits:</span> {recipe.dietTypes.map(dietLabel).join(", ")}
          </p>
        </section>
      )}

      <section aria-labelledby="ingredients">
        <h2 id="ingredients" className="text-xl font-bold">
          Ingredients <span className="text-sm font-normal text-zinc-600 dark:text-zinc-400">(whole recipe)</span>
        </h2>
        <p className="text-xs text-zinc-600 dark:text-zinc-400">
          &ldquo;Buy&rdquo; opens {storeName(store)} (change it on your shopping list). &ldquo;Swap ideas&rdquo; only suggest
          ingredients that suit your diet and allergies.
        </p>
        <ul className="mt-2 divide-y divide-zinc-200 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {(lines ?? []).map((l, i) => {
            const swaps = swapsFor(l);
            return (
            <li key={i} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 p-3 text-sm">
              <span className="font-medium">{l.ingredients?.name ?? "ingredient"}</span>
              <span className="flex items-baseline gap-3 text-zinc-600 dark:text-zinc-400">
                <span>
                  {l.display_amount ? `${l.display_amount} · ` : ""}
                  {fmt(Number(l.grams))} g
                </span>
                {l.ingredients && l.ingredients.name !== "water" && (
                  <a
                    href={storeSearchUrl(store, l.ingredients.search_term)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
                  >
                    Buy<span className="sr-only"> {l.ingredients.name} on {storeName(store)} (opens in a new tab)</span> ↗
                  </a>
                )}
              </span>
              {swaps.length > 0 && (
                <details className="w-full">
                  <summary className="cursor-pointer text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                    Swap ideas<span className="sr-only"> for {l.ingredients?.name}</span>
                  </summary>
                  <ul className="mt-1 space-y-1 text-xs text-zinc-600 dark:text-zinc-400">
                    {swaps.map((s) => (
                      <li key={s.ingredient.id}>
                        Use <span className="font-semibold text-zinc-900 dark:text-zinc-100">{s.grams} g {s.ingredient.name}</span>{" "}
                        instead — about the same calories
                        {Math.abs(s.proteinDiff) >= 1 && `, ${s.proteinDiff > 0 ? "+" : "−"}${Math.abs(s.proteinDiff)} g protein`}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </li>
            );
          })}
        </ul>
      </section>

      {recipe.steps.length > 0 && (
        <section aria-labelledby="steps">
          <h2 id="steps" className="text-xl font-bold">
            Steps
          </h2>
          <ol className="mt-2 list-decimal space-y-2 pl-5">
            {recipe.steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </section>
      )}

      <p className="text-xs text-zinc-600 dark:text-zinc-400">
        Nutrition is calculated from ingredient data and is an estimate. Always check ingredient labels for allergens.
      </p>
    </main>
  );
}
