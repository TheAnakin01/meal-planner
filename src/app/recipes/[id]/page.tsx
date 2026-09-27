import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { allergenLabel } from "@/lib/allergens";
import { dietLabel } from "@/lib/diet";
import { type RecipeRow, recipeFromRow } from "@/lib/library";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Recipe · Meal Planner",
};

interface LineRow {
  grams: number | string;
  display_amount: string;
  note: string;
  ingredients: { name: string } | null;
}

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
    .select("grams, display_amount, note, ingredients(name)")
    .eq("recipe_id", recipeId)
    .order("position")
    .returns<LineRow[]>();

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
        <ul className="mt-2 divide-y divide-zinc-200 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {(lines ?? []).map((l, i) => (
            <li key={i} className="flex justify-between gap-3 p-3 text-sm">
              <span className="font-medium">{l.ingredients?.name ?? "ingredient"}</span>
              <span className="text-zinc-600 dark:text-zinc-400">
                {l.display_amount ? `${l.display_amount} · ` : ""}
                {fmt(Number(l.grams))} g
              </span>
            </li>
          ))}
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
