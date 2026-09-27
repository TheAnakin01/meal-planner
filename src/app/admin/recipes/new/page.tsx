import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import RecipeEditor from "@/components/admin/RecipeEditor";
import { isCurrentUserAdmin } from "@/lib/admin-server";
import { getAllIngredients } from "@/lib/library-server";

export const metadata: Metadata = {
  title: "New recipe · Admin · Meal Planner",
};

export default async function NewRecipePage() {
  if (!(await isCurrentUserAdmin())) notFound();
  const ingredients = await getAllIngredients();

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-8 sm:py-12">
      <div>
        <Link href="/admin/recipes" className="text-sm font-semibold text-emerald-700 hover:underline dark:text-emerald-400">
          ← Recipes
        </Link>
        <h1 className="mt-2 text-3xl font-bold">New recipe</h1>
      </div>
      <RecipeEditor ingredients={ingredients} />
    </main>
  );
}
