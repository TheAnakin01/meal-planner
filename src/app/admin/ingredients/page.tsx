import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import IngredientImporter from "@/components/admin/IngredientImporter";
import { isCurrentUserAdmin } from "@/lib/admin-server";
import { allergenLabel } from "@/lib/allergens";
import { AISLES } from "@/lib/library";
import { getAllIngredients } from "@/lib/library-server";

export const metadata: Metadata = {
  title: "Ingredients · Admin · Meal Planner",
};

export default async function AdminIngredientsPage({ searchParams }: PageProps<"/admin/ingredients">) {
  if (!(await isCurrentUserAdmin())) notFound();

  const params = await searchParams;
  const ingredients = await getAllIngredients();
  const editing = ingredients.find((i) => String(i.id) === params.edit);
  const savedName = typeof params.saved === "string" ? params.saved : null;
  const recipesUpdated = Number(params.recipes ?? 0);
  // "Add to library" links from the AI drafter pass the ingredient name as ?q=
  const initialQuery = typeof params.q === "string" ? params.q.slice(0, 80) : "";
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

      {savedName && (
        <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
          Saved &ldquo;{savedName}&rdquo;.
          {recipesUpdated > 0 && ` ${recipesUpdated} recipe${recipesUpdated === 1 ? "" : "s"} using it were recalculated.`}
        </p>
      )}

      {/* key: switch cleanly between adding and editing different ingredients */}
      <IngredientImporter key={editing?.id ?? "new"} editing={editing} initialQuery={initialQuery} />

      <section aria-labelledby="ingredient-list">
        <h2 id="ingredient-list" className="text-xl font-bold">
          {ingredients.length} ingredient{ingredients.length === 1 ? "" : "s"}
        </h2>
        {ingredients.length > 0 && (
          <ul className="mt-3 divide-y divide-zinc-200 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {ingredients.map((i) => (
              <li key={i.id} className="p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-semibold">
                    {i.name}{" "}
                    <Link
                      href={`/admin/ingredients?edit=${i.id}`}
                      className="text-sm font-normal text-emerald-700 hover:underline dark:text-emerald-400"
                    >
                      Edit<span className="sr-only"> {i.name}</span>
                    </Link>
                  </span>
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
