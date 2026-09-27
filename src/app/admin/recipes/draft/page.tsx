import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import RecipeDrafter from "@/components/admin/RecipeDrafter";
import { isCurrentUserAdmin } from "@/lib/admin-server";

export const metadata: Metadata = {
  title: "Draft with AI · Admin · Meal Planner",
};

// Gemini's free tier can take ~25 s or more per answer; allow up to 2 minutes for this page's actions.
export const maxDuration = 120;

export default async function DraftRecipePage() {
  if (!(await isCurrentUserAdmin())) notFound();

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-8 sm:py-12">
      <div>
        <Link href="/admin/recipes" className="text-sm font-semibold text-emerald-700 hover:underline dark:text-emerald-400">
          ← Recipes
        </Link>
        <h1 className="mt-2 text-3xl font-bold">Draft a recipe with AI</h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          The AI suggests a recipe; our engine works out nutrition, allergens and diets from your ingredient library. It
          is saved as a draft for you to check and publish.
        </p>
      </div>
      <RecipeDrafter />
    </main>
  );
}
