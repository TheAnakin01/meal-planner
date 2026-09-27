import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isCurrentUserAdmin } from "@/lib/admin-server";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Admin · Meal Planner",
};

async function countRows(table: "ingredients" | "recipes", status?: "draft" | "published") {
  const supabase = await createClient();
  let query = supabase.from(table).select("id", { count: "exact", head: true });
  if (status) query = query.eq("status", status);
  const { count, error } = await query;
  if (error) throw new Error(`Could not count ${table}: ${error.message}`);
  return count ?? 0;
}

// Owner-only overview of the recipe library. Non-admins get a normal "page not found".
export default async function AdminPage() {
  if (!(await isCurrentUserAdmin())) notFound();

  const [ingredients, drafts, published] = await Promise.all([
    countRows("ingredients"),
    countRows("recipes", "draft"),
    countRows("recipes", "published"),
  ]);

  const stats = [
    { label: "Ingredients", value: ingredients },
    { label: "Draft recipes", value: drafts },
    { label: "Published recipes", value: published },
  ];

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:py-12">
      <h1 className="text-3xl font-bold">Recipe library</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">Only admins can see this page.</p>

      <dl className="mt-8 grid grid-cols-3 gap-3">
        {stats.map((s) => (
          <div
            key={s.label}
            className="flex flex-col-reverse rounded-xl border border-zinc-200 p-4 text-center dark:border-zinc-800"
          >
            <dt className="text-sm text-zinc-600 dark:text-zinc-400">{s.label}</dt>
            <dd className="text-3xl font-bold">{s.value}</dd>
          </div>
        ))}
      </dl>

      <Link
        href="/admin/ingredients"
        className="mt-8 inline-block rounded-xl bg-emerald-700 px-5 py-3 font-semibold text-white hover:bg-emerald-800"
      >
        Manage ingredients
      </Link>

      <p className="mt-8 rounded-xl border border-dashed border-zinc-300 p-4 text-sm dark:border-zinc-700">
        Coming next: the recipe editor (Step 17).
      </p>
    </main>
  );
}
