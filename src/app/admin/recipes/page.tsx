import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import PublishDraftsButton from "@/components/admin/PublishDraftsButton";
import { isCurrentUserAdmin } from "@/lib/admin-server";
import { dietLabel } from "@/lib/diet";
import { getAllRecipes } from "@/lib/library-server";

// Publishing many drafts at once recalculates each one.
export const maxDuration = 60;

export const metadata: Metadata = {
  title: "Recipes · Admin · Meal Planner",
};

export default async function AdminRecipesPage() {
  if (!(await isCurrentUserAdmin())) notFound();
  const recipes = await getAllRecipes();
  const draftCount = recipes.filter((r) => r.status === "draft").length;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-8 sm:py-12">
      <div>
        <Link href="/admin" className="text-sm font-semibold text-emerald-700 hover:underline dark:text-emerald-400">
          ← Recipe library
        </Link>
        <div className="mt-2 flex items-center justify-between gap-4">
          <h1 className="text-3xl font-bold">Recipes</h1>
          <div className="flex shrink-0 gap-2">
            <Link
              href="/admin/recipes/draft"
              className="rounded-xl bg-emerald-700 px-4 py-2 font-semibold text-white hover:bg-emerald-800"
            >
              Draft with AI
            </Link>
            <Link
              href="/admin/recipes/new"
              className="rounded-xl border border-zinc-300 px-4 py-2 font-semibold hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              New
            </Link>
          </div>
        </div>
      </div>

      {draftCount > 0 && <PublishDraftsButton draftCount={draftCount} />}

      {recipes.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-300 p-6 text-center dark:border-zinc-700">
          No recipes yet. Add ingredients first, then create your first recipe.
        </p>
      ) : (
        <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {recipes.map((r) => (
            <li key={r.id}>
              <Link href={`/admin/recipes/${r.id}`} className="block p-3 hover:bg-zinc-50 dark:hover:bg-zinc-900">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-semibold">{r.title}</span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                      r.status === "published"
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                        : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                    }`}
                  >
                    {r.status === "published" ? "Published" : "Draft"}
                  </span>
                </div>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  {r.mealTypes.join(", ")} · {r.perServing ? `${r.perServing.kcal} kcal/serving` : "no nutrition yet"}
                  {r.dietTypes.length > 0 && ` · ${r.dietTypes.map(dietLabel).join(", ")}`}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
