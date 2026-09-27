"use server";

import { revalidatePath } from "next/cache";
import { isCurrentUserAdmin } from "@/lib/admin-server";
import { type BulkPublishResult, getRecipeInput, publishReadyDrafts, saveRecipe } from "@/lib/library-server";
import { publishProblems, recipeInputSchema } from "@/lib/recipe-input";
import { createClient } from "@/lib/supabase/server";

type Result<T> = ({ ok: true } & T) | { ok: false; error: string };

function revalidateLibrary(id?: number) {
  revalidatePath("/admin");
  revalidatePath("/admin/recipes");
  if (id) revalidatePath(`/admin/recipes/${id}`);
}

export async function saveRecipeAction(input: unknown): Promise<Result<{ id: number; warnings: string[] }>> {
  if (!(await isCurrentUserAdmin())) return { ok: false, error: "Only admins can do this." };

  const parsed = recipeInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const result = await saveRecipe(parsed.data);
  if ("error" in result) return { ok: false, error: result.error ?? "Couldn't save the recipe." };

  revalidateLibrary(result.id);
  return {
    ok: true,
    id: result.id,
    warnings: [...result.analysis.allergens.warnings, ...result.analysis.diets.warnings],
  };
}

export async function setRecipeStatusAction(id: number, publish: boolean): Promise<Result<object>> {
  if (!(await isCurrentUserAdmin())) return { ok: false, error: "Only admins can do this." };

  if (publish) {
    // Re-save first so the stored nutrition is fresh, then check it's complete.
    const existing = await getRecipeInput(id);
    if (!existing) return { ok: false, error: "Recipe not found." };
    const saved = await saveRecipe(existing.input);
    if ("error" in saved) return { ok: false, error: saved.error ?? "Couldn't save the recipe." };
    const problems = publishProblems(existing.input, saved.analysis);
    if (problems.length > 0) return { ok: false, error: problems.join(" ") };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("recipes")
    .update({ status: publish ? "published" : "draft", published_at: publish ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) {
    console.error("setRecipeStatusAction failed:", error.message);
    return { ok: false, error: "Couldn't change the status. Please try again." };
  }
  revalidateLibrary(id);
  return { ok: true };
}

export async function deleteRecipeAction(id: number): Promise<Result<object>> {
  if (!(await isCurrentUserAdmin())) return { ok: false, error: "Only admins can do this." };
  const supabase = await createClient();
  const { error } = await supabase.from("recipes").delete().eq("id", id);
  if (error) {
    console.error("deleteRecipeAction failed:", error.message);
    return { ok: false, error: "Couldn't delete the recipe. Please try again." };
  }
  revalidateLibrary();
  return { ok: true };
}

export async function publishReadyDraftsAction(): Promise<Result<BulkPublishResult>> {
  if (!(await isCurrentUserAdmin())) return { ok: false, error: "Only admins can do this." };
  try {
    const result = await publishReadyDrafts();
    revalidateLibrary();
    return { ok: true, ...result };
  } catch (e) {
    console.error("publishReadyDraftsAction failed:", e instanceof Error ? e.message : e);
    return { ok: false, error: "Couldn't publish the drafts. Please try again." };
  }
}
