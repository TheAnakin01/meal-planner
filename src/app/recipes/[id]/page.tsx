import type { Metadata } from "next";
import Link from "next/link";
import { ClockIcon } from "@/components/ui/icons";
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
    <main className="page">
      <Link href="/week" className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700 hover:underline dark:text-emerald-400">
        ← This week
      </Link>
      <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-emerald-50 via-white to-amber-50 p-6 shadow-sm dark:from-emerald-950/60 dark:via-zinc-900 dark:to-zinc-900">
        <span aria-hidden="true" className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-emerald-200/40 motion-safe:animate-float dark:bg-emerald-800/20" />
        <p className="relative text-sm font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
          {recipe.mealTypes.join(" · ")}
        </p>
        <h1 className="relative mt-1 text-3xl font-bold tracking-tight">{recipe.title}</h1>
        {recipe.description && <p className="relative mt-2 muted">{recipe.description}</p>}
        <p className="relative mt-4 flex flex-wrap gap-1.5">
          <span className="chip bg-white/80 dark:bg-zinc-800">
            <ClockIcon size={14} /> {totalMinutes > 0 ? `${totalMinutes} min` : "Quick"}
          </span>
          <span className="chip bg-white/80 dark:bg-zinc-800">
            Makes {recipe.servings} serving{recipe.servings === 1 ? "" : "s"}
          </span>
          {recipe.status === "draft" && <span className="chip bg-amber-100 text-amber-900">Draft — only admins see this</span>}
        </p>
      </div>

      {n && (
        <section aria-labelledby="nutrition" className="card">
          <h2 id="nutrition" className="font-semibold">
            Your portion: {portion} serving{portion === 1 ? "" : "s"}
          </h2>
          <dl className="stagger mt-3 grid grid-cols-4 gap-2 text-center">
            {[
              { label: "kcal", value: Math.round(n.kcal * portion), tint: "bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200" },
              { label: "protein", value: `${fmt(n.proteinG * portion)} g`, tint: "bg-sky-50 text-sky-900 dark:bg-sky-950 dark:text-sky-200" },
              { label: "carbs", value: `${fmt(n.carbsG * portion)} g`, tint: "bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200" },
              { label: "fat", value: `${fmt(n.fatG * portion)} g`, tint: "bg-rose-50 text-rose-900 dark:bg-rose-950 dark:text-rose-200" },
            ].map((x) => (
              <div key={x.label} className={`rounded-2xl px-1 py-3 ${x.tint}`}>
                <dt className="text-xs font-medium">{x.label}</dt>
                <dd className="text-lg font-bold tabular-nums">{x.value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-sm">
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
        <p className="text-xs muted">
          &ldquo;Buy&rdquo; opens {storeName(store)} (change it on your shopping list). &ldquo;Swap ideas&rdquo; only suggest
          ingredients that suit your diet and allergies.
        </p>
        <ul className="card mt-3 divide-y divide-zinc-100 p-0 dark:divide-zinc-800">
          {(lines ?? []).map((l, i) => {
            const swaps = swapsFor(l);
            return (
            <li key={i} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-4 py-3 text-sm">
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
          <ol className="stagger mt-3 space-y-3">
            {recipe.steps.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-700 text-sm font-bold text-white" aria-hidden="true">
                  {i + 1}
                </span>
                <p className="card flex-1 px-4 py-3">
                  <span className="sr-only">Step {i + 1}: </span>
                  {step}
                </p>
              </li>
            ))}
          </ol>
        </section>
      )}

      <p className="text-xs muted">
        Nutrition is calculated from ingredient data and is an estimate. Always check ingredient labels for allergens.
      </p>
    </main>
  );
}
