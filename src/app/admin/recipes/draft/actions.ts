"use server";

import { z } from "zod";
import { isCurrentUserAdmin } from "@/lib/admin-server";
import { allergenLabel } from "@/lib/allergens";
import { DIET_TYPE_IDS, dietLabel } from "@/lib/diet";
import { type GeminiError, generateJson } from "@/lib/gemini-server";
import type { Ingredient } from "@/lib/library";
import { getAllIngredients, saveRecipe, toRecipeLines } from "@/lib/library-server";
import { analyzeRecipe } from "@/lib/recipe-analysis";
import {
  DRAFT_JSON_SCHEMA,
  DRAFT_SYSTEM_INSTRUCTION,
  type DraftLine,
  type RecipeDraft,
  buildDraftPrompt,
  draftSchema,
  draftToRecipeInput,
  matchDraft,
} from "@/lib/recipe-draft";

const mealTypesSchema = z.array(z.enum(["breakfast", "lunch", "dinner"])).min(1, "Pick at least one meal.");

const requestSchema = z.object({
  description: z.string().trim().min(3, "Describe the dish in a few words.").max(300, "Keep it under 300 characters."),
  mealTypes: mealTypesSchema,
  servings: z.number().int().min(1).max(20),
  diet: z.enum(DIET_TYPE_IDS).nullable(),
});

const GEMINI_MESSAGES: Record<GeminiError, string> = {
  not_configured: "The Gemini key isn't set up. Add GEMINI_API_KEY to .env.local and Vercel.",
  unauthorized: "Gemini didn't accept the key. Check GEMINI_API_KEY.",
  rate_limited: "The free Gemini limit is used up for now. Try again in a minute (or tomorrow if it's the daily limit).",
  busy: "Gemini's free service is busy right now. Please try again in a minute.",
  blocked: "Gemini refused to answer this request. Try describing the dish differently.",
  rejected: "Gemini couldn't process the request. Please try again.",
  bad_output: "Gemini's answer wasn't a usable recipe. Please try again.",
  unavailable: "Couldn't reach Gemini. Please try again.",
};

export interface DraftSummary {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  allergens: string[];
  diets: string[];
}

export interface DraftResult {
  draft: RecipeDraft;
  lines: DraftLine[];
  summary: DraftSummary | null; // only when every ingredient is in the library
}

function summarize(draft: RecipeDraft, lines: DraftLine[], library: Ingredient[]): DraftSummary | null {
  if (lines.some((l) => l.ingredientId === null)) return null;
  const input = draftToRecipeInput(draft, lines, ["lunch"]);
  const recipeLines = toRecipeLines(input, library);
  if (!recipeLines) return null;
  const analysis = analyzeRecipe(draft.title, draft.servings, recipeLines);
  const n = analysis.nutrition.perServing;
  if (!n) return null;
  return {
    kcal: n.kcal,
    proteinG: n.proteinG,
    carbsG: n.carbsG,
    fatG: n.fatG,
    allergens: analysis.allergens.tags.map(allergenLabel),
    diets: analysis.diets.dietTypes.map(dietLabel),
  };
}

type ActionResult<T> = ({ ok: true } & T) | { ok: false; error: string };

// Asks Gemini to draft a recipe, then matches its ingredients to our library.
export async function draftRecipeAction(request: unknown): Promise<ActionResult<DraftResult>> {
  if (!(await isCurrentUserAdmin())) return { ok: false, error: "Only admins can do this." };
  const parsed = requestSchema.safeParse(request);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const library = await getAllIngredients();
  const result = await generateJson({
    systemInstruction: DRAFT_SYSTEM_INSTRUCTION,
    prompt: buildDraftPrompt(parsed.data, library.map((i) => i.name)),
    jsonSchema: DRAFT_JSON_SCHEMA,
  });
  if (!result.ok) return { ok: false, error: GEMINI_MESSAGES[result.error] };

  const draft = draftSchema.safeParse(result.json);
  if (!draft.success) return { ok: false, error: GEMINI_MESSAGES.bad_output };

  const lines = matchDraft(draft.data, library);
  return { ok: true, draft: draft.data, lines, summary: summarize(draft.data, lines, library) };
}

// Re-checks a draft against the library after the owner has added missing ingredients (no AI call).
export async function rematchDraftAction(draft: unknown): Promise<ActionResult<DraftResult>> {
  if (!(await isCurrentUserAdmin())) return { ok: false, error: "Only admins can do this." };
  const parsed = draftSchema.safeParse(draft);
  if (!parsed.success) return { ok: false, error: "That draft is no longer valid. Please create a new one." };

  const library = await getAllIngredients();
  const lines = matchDraft(parsed.data, library);
  return { ok: true, draft: parsed.data, lines, summary: summarize(parsed.data, lines, library) };
}

// Saves the draft as a DRAFT recipe (source "ai") and returns its id for the editor.
export async function saveDraftAction(
  draft: unknown,
  mealTypes: unknown,
  dropUnmatched: boolean,
): Promise<ActionResult<{ id: number }>> {
  if (!(await isCurrentUserAdmin())) return { ok: false, error: "Only admins can do this." };
  const parsedDraft = draftSchema.safeParse(draft);
  const parsedMeals = mealTypesSchema.safeParse(mealTypes);
  if (!parsedDraft.success || !parsedMeals.success) return { ok: false, error: "That draft is no longer valid." };

  const library = await getAllIngredients();
  const lines = matchDraft(parsedDraft.data, library);
  const unmatched = lines.filter((l) => l.ingredientId === null).map((l) => l.name);
  if (unmatched.length > 0 && !dropUnmatched) {
    return { ok: false, error: `Add these to your ingredients first: ${unmatched.join(", ")}.` };
  }
  if (unmatched.length === lines.length) return { ok: false, error: "None of the ingredients are in your library yet." };

  const result = await saveRecipe(draftToRecipeInput(parsedDraft.data, lines, parsedMeals.data), "ai");
  if ("error" in result) return { ok: false, error: result.error ?? "Couldn't save the recipe." };
  return { ok: true, id: result.id };
}
