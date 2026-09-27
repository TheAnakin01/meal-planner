// Server-only reads/writes for the recipe library (admin pages and actions).

import "server-only";
import {
  type Ingredient,
  type IngredientRow,
  type LibraryRecipe,
  type RecipeRow,
  ingredientFromRow,
  recipeFromRow,
} from "@/lib/library";
import { type RecipeLine, analyzeRecipe } from "@/lib/recipe-analysis";
import { type RecipeInput, bulkPublishBlockers, toSaveRecipeArgs } from "@/lib/recipe-input";
import { createClient } from "@/lib/supabase/server";

export async function getAllIngredients(): Promise<Ingredient[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("ingredients").select("*").order("name").returns<IngredientRow[]>();
  if (error) throw new Error(`Could not load ingredients: ${error.message}`);
  return (data ?? []).map(ingredientFromRow);
}

export async function getAllRecipes(): Promise<LibraryRecipe[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recipes")
    .select("*")
    .order("updated_at", { ascending: false })
    .returns<RecipeRow[]>();
  if (error) throw new Error(`Could not load recipes: ${error.message}`);
  return (data ?? []).map(recipeFromRow);
}

interface RecipeIngredientRow {
  ingredient_id: number;
  position: number;
  grams: number | string;
  display_amount: string;
  note: string;
}

// A recipe in editor form, or null if it doesn't exist (or isn't visible to this user).
export async function getRecipeInput(id: number): Promise<{ input: RecipeInput; status: LibraryRecipe["status"] } | null> {
  const supabase = await createClient();
  const { data: row, error } = await supabase.from("recipes").select("*").eq("id", id).maybeSingle<RecipeRow>();
  if (error) throw new Error(`Could not load recipe: ${error.message}`);
  if (!row) return null;

  const { data: lines, error: linesError } = await supabase
    .from("recipe_ingredients")
    .select("ingredient_id, position, grams, display_amount, note")
    .eq("recipe_id", id)
    .order("position")
    .returns<RecipeIngredientRow[]>();
  if (linesError) throw new Error(`Could not load recipe ingredients: ${linesError.message}`);

  const recipe = recipeFromRow(row);
  return {
    status: recipe.status,
    input: {
      id: recipe.id,
      title: recipe.title,
      description: recipe.description,
      cuisine: recipe.cuisine,
      mealTypes: recipe.mealTypes,
      servings: recipe.servings,
      prepMinutes: recipe.prepMinutes,
      cookMinutes: recipe.cookMinutes,
      steps: recipe.steps,
      imageUrl: recipe.imageUrl ?? "",
      lines: (lines ?? []).map((l) => ({
        ingredientId: Number(l.ingredient_id),
        grams: Number(l.grams),
        displayAmount: l.display_amount,
        note: l.note,
      })),
    },
  };
}

// Pairs each recipe line with its ingredient from the database. Unknown ingredient ids → null.
export function toRecipeLines(input: Pick<RecipeInput, "lines">, ingredients: Ingredient[]): RecipeLine[] | null {
  const byId = new Map(ingredients.map((i) => [i.id, i]));
  const lines: RecipeLine[] = [];
  for (const l of input.lines) {
    const ingredient = byId.get(l.ingredientId);
    if (!ingredient) return null;
    lines.push({ grams: l.grams, ingredient });
  }
  return lines;
}

// Recomputes nutrition/allergens/diets from the database and saves atomically. Returns the recipe id.
export async function saveRecipe(input: RecipeInput, source: "owner" | "ai" = "owner") {
  const ingredients = await getAllIngredients();
  const lines = toRecipeLines(input, ingredients);
  if (!lines) return { error: "One of the ingredients no longer exists. Please re-add it." } as const;

  const analysis = analyzeRecipe(input.title, input.servings, lines);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_recipe", toSaveRecipeArgs(input, analysis, source));
  if (error) {
    console.error("save_recipe failed:", error.message);
    return { error: "Couldn't save the recipe. Please try again." } as const;
  }
  return { id: Number(data), analysis } as const;
}

export interface BulkPublishResult {
  published: number;
  skipped: { id: number; title: string; reasons: string[] }[];
}

// "Publish ready drafts": recomputes every draft from the database ingredients (same engine as the
// editor) and publishes the ones with no blockers, storing fresh nutrition/allergens/diets. Drafts with
// any problem or tag warning stay drafts and are listed so the owner can fix them in the editor.
export async function publishReadyDrafts(): Promise<BulkPublishResult> {
  const supabase = await createClient();
  const [ingredients, recipes] = await Promise.all([getAllIngredients(), getAllRecipes()]);
  const drafts = recipes.filter((r) => r.status === "draft");
  if (drafts.length === 0) return { published: 0, skipped: [] };

  const { data: rows, error } = await supabase
    .from("recipe_ingredients")
    .select("recipe_id, ingredient_id, position, grams, display_amount, note")
    .in("recipe_id", drafts.map((d) => d.id))
    .order("position")
    .returns<(RecipeIngredientRow & { recipe_id: number })[]>();
  if (error) throw new Error(`Could not load recipe ingredients: ${error.message}`);

  const linesByRecipe = new Map<number, RecipeInput["lines"]>();
  for (const row of rows ?? []) {
    const id = Number(row.recipe_id);
    const list = linesByRecipe.get(id) ?? [];
    list.push({ ingredientId: Number(row.ingredient_id), grams: Number(row.grams), displayAmount: row.display_amount, note: row.note });
    linesByRecipe.set(id, list);
  }

  const skipped: BulkPublishResult["skipped"] = [];
  const ready: { id: number; update: Record<string, unknown> }[] = [];
  for (const draft of drafts) {
    const inputLines = linesByRecipe.get(draft.id) ?? [];
    const lines = toRecipeLines({ lines: inputLines }, ingredients);
    if (!lines) {
      skipped.push({ id: draft.id, title: draft.title, reasons: ["One of its ingredients no longer exists."] });
      continue;
    }
    const analysis = analyzeRecipe(draft.title, draft.servings, lines);
    const reasons = bulkPublishBlockers({ steps: draft.steps, lines: inputLines }, analysis);
    const n = analysis.nutrition.perServing;
    if (reasons.length > 0 || !n) {
      skipped.push({ id: draft.id, title: draft.title, reasons });
      continue;
    }
    ready.push({
      id: draft.id,
      update: {
        kcal_per_serving: n.kcal,
        protein_per_serving: n.proteinG,
        carbs_per_serving: n.carbsG,
        fat_per_serving: n.fatG,
        fiber_per_serving: n.fiberG,
        allergen_tags: analysis.allergens.tags,
        diet_types: analysis.diets.dietTypes,
        status: "published",
        published_at: new Date().toISOString(),
      },
    });
  }

  // A few updates at a time: quick, without flooding the free database.
  let published = 0;
  for (let i = 0; i < ready.length; i += 8) {
    const results = await Promise.all(
      ready.slice(i, i + 8).map(({ id, update }) =>
        supabase.from("recipes").update(update).eq("id", id).eq("status", "draft"),
      ),
    );
    results.forEach((r, j) => {
      if (r.error) {
        console.error("publishReadyDrafts update failed:", r.error.message);
        const { id } = ready[i + j];
        skipped.push({ id, title: drafts.find((d) => d.id === id)!.title, reasons: ["Couldn't save. Please try again."] });
      } else published++;
    });
  }
  return { published, skipped };
}

// After an ingredient changes, re-save every recipe that uses it so stored nutrition stays correct.
export async function recomputeRecipesUsing(ingredientId: number): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recipe_ingredients")
    .select("recipe_id")
    .eq("ingredient_id", ingredientId)
    .returns<{ recipe_id: number }[]>();
  if (error) throw new Error(`Could not find recipes using ingredient: ${error.message}`);

  const ids = [...new Set((data ?? []).map((r) => Number(r.recipe_id)))];
  for (const id of ids) {
    const existing = await getRecipeInput(id);
    if (existing) await saveRecipe(existing.input);
  }
  return ids.length;
}
