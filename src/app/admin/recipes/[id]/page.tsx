import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import RecipeEditor from "@/components/admin/RecipeEditor";
import { isCurrentUserAdmin } from "@/lib/admin-server";
import { getAllIngredients, getRecipeInput } from "@/lib/library-server";

export const metadata: Metadata = {
  title: "Edit recipe · Admin · Meal Planner",
};

export default async function EditRecipePage({ params, searchParams }: PageProps<"/admin/recipes/[id]">) {
  if (!(await isCurrentUserAdmin())) notFound();

  const { id } = await params;
  const recipeId = Number(id);
  if (!Number.isInteger(recipeId) || recipeId <= 0) notFound();

  const [recipe, ingredients, query] = await Promise.all([getRecipeInput(recipeId), getAllIngredients(), searchParams]);
  if (!recipe) notFound();

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-8 sm:py-12">
      <div>
        <Link href="/admin/recipes" className="text-sm font-semibold text-emerald-700 hover:underline dark:text-emerald-400">
          ← Recipes
        </Link>
        <h1 className="mt-2 text-3xl font-bold">{recipe.input.title}</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {recipe.status === "published" ? "Published — visible to users." : "Draft — only admins can see it."}
        </p>
      </div>
      {query.created && (
        <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
          Saved as a draft. Publish it when you&apos;re happy with it.
        </p>
      )}
      {/* key: reset the editor when switching recipes */}
      <RecipeEditor key={recipeId} ingredients={ingredients} initial={recipe.input} status={recipe.status} />
    </main>
  );
}
