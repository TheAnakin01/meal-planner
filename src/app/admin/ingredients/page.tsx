import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import IngredientImporter from "@/components/admin/IngredientImporter";
import { isCurrentUserAdmin } from "@/lib/admin-server";
import { allergenLabel } from "@/lib/allergens";
import { AISLES, type IngredientRow, ingredientFromRow } from "@/lib/library";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Ingredients · Admin · Meal Planner",
};

export default async function AdminIngredientsPage() {
  if (!(await isCurrentUserAdmin())) notFound();

  const supabase = await createClient();
  const { data, error } = await supabase.from("ingredients").select("*").order("name").returns<IngredientRow[]>();
  if (error) throw new Error(`Could not load ingredients: ${error.message}`);
  const ingredients = (data ?? []).map(ingredientFromRow);
  const aisleLabel = (id: string) => AISLES.find((a) => a.id === id)?.label ?? id;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-8 px-4 py-8 sm:py-12">
      <div>
        <Link href="/admin" className="text-sm font-semibold text-emerald-700 hover:underline dark:text-emerald-400">
          ← Recipe library
        </Link>
        <h1 className="mt-2 text-3xl font-bold">Ingredients</h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Nutrition comes from USDA FoodData Central (public domain). Values are per 100 g.
        </p>
      </div>

      <IngredientImporter />

      <section aria-labelledby="ingredient-list">
        <h2 id="ingredient-list" className="text-xl font-bold">
          {ingredients.length} ingredient{ingredients.length === 1 ? "" : "s"}
        </h2>
        {ingredients.length > 0 && (
          <ul className="mt-3 divide-y divide-zinc-200 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {ingredients.map((i) => (
              <li key={i.id} className="p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-semibold">{i.name}</span>
                  <span className="text-sm text-zinc-600 dark:text-zinc-400">
                    {i.per100g
                      ? `${i.per100g.kcal} kcal · P ${i.per100g.proteinG} · C ${i.per100g.carbsG} · F ${i.per100g.fatG}`
                      : "No nutrition yet"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                  {aisleLabel(i.aisle)}
                  {i.allergenTags.length > 0 && ` · Contains: ${i.allergenTags.map(allergenLabel).join(", ")}`}
                  {i.jainAvoid && " · Not Jain"}
                  {i.containsMeat && " · Meat"}
                  {i.containsFish && " · Fish"}
                  {i.containsEgg && " · Egg"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
