// AI recipe drafting (admin only, CLAUDE.md §18): the prompt and JSON shape we ask Gemini for,
// validation of what comes back, and matching its ingredients to our library.
//
// The AI only proposes. Nutrition, allergens and diet suitability are always computed by our own
// engine from library ingredients, and a human reviews and publishes.

import { z } from "zod";
import { type DietType, dietLabel } from "@/lib/diet";
import type { Ingredient } from "@/lib/library";
import type { MealType } from "@/lib/nutrition";
import type { RecipeInput } from "@/lib/recipe-input";

// JSON Schema sent to Gemini (structured output).
export const DRAFT_JSON_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string", description: "Short dish name, e.g. 'Moong Dal Chilla'" },
    description: { type: "string", description: "One sentence, no health claims" },
    cuisine: { type: "string", description: "e.g. indian, south indian, gujarati, italian" },
    servings: { type: "integer" },
    prepMinutes: { type: "integer" },
    cookMinutes: { type: "integer" },
    ingredients: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string", description: "Generic lowercase ingredient name, no preparation words" },
          grams: { type: "number", description: "Raw weight in grams for the WHOLE recipe" },
          displayAmount: { type: "string", description: "Kitchen measure, e.g. '1 cup', '2 tsp', '1 medium'" },
        },
        required: ["name", "grams", "displayAmount"],
      },
    },
    steps: { type: "array", items: { type: "string" } },
  },
  required: ["title", "description", "cuisine", "servings", "prepMinutes", "cookMinutes", "ingredients", "steps"],
} as const;

export const draftSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(600).catch(""),
  cuisine: z.string().trim().toLowerCase().min(1).max(40).catch("indian"),
  servings: z.number().int().min(1).max(20),
  prepMinutes: z.number().int().min(0).max(600).catch(10),
  cookMinutes: z.number().int().min(0).max(1440).catch(20),
  ingredients: z
    .array(
      z.object({
        name: z.string().trim().toLowerCase().min(1).max(80),
        grams: z.number().positive().max(5000),
        displayAmount: z.string().trim().max(40).catch(""),
      }),
    )
    .min(1)
    .max(40),
  steps: z.array(z.string().trim().min(1).max(500)).min(1).max(30),
});

export type RecipeDraft = z.infer<typeof draftSchema>;

export interface DraftRequest {
  description: string;
  mealTypes: MealType[];
  servings: number;
  diet: DietType | null;
}

export const DRAFT_SYSTEM_INSTRUCTION = `You are a recipe developer for a meal-planning app used mainly in India.
Write realistic, everyday home recipes that a beginner can cook.
Rules:
- Ingredient "grams" is the RAW weight for the WHOLE recipe (all servings), not per serving.
- Ingredient "name" is a generic lowercase name with no preparation words ("onion", not "finely chopped onion").
  When the provided library list has a suitable ingredient, use its name EXACTLY.
- Put preparation details in the steps. Keep steps short and practical; at most 10 steps.
- Include cooking oil or ghee, salt and water with realistic amounts when the dish needs them.
- Never make health or medical claims. Never state whether the dish is allergen-free; the app checks that itself.
- Follow the requested diet strictly.`;

const DIET_RULES: Record<DietType, string> = {
  veg: "Vegetarian: no meat, fish, seafood or eggs. Dairy is allowed.",
  eggetarian: "Eggetarian: vegetarian plus eggs. No meat, fish or seafood.",
  vegan: "Vegan: no meat, fish, eggs, dairy (including ghee, butter, paneer, curd) or honey.",
  jain: "Jain: vegetarian, no eggs, and NO onion, garlic, potato, carrot, beetroot, radish, ginger, mushrooms or honey.",
  nonveg: "Non-vegetarian: any ingredients allowed.",
};

export function buildDraftPrompt(request: DraftRequest, libraryNames: readonly string[]): string {
  const lines = [
    `Dish: ${request.description.trim()}`,
    `Meal: ${request.mealTypes.join(" or ")}`,
    `Servings: ${request.servings}`,
    request.diet ? `Diet: ${DIET_RULES[request.diet]} (${dietLabel(request.diet)})` : "Diet: no restriction.",
    "",
    "Ingredient library (prefer these exact names):",
    libraryNames.length > 0 ? libraryNames.join(", ") : "(empty — use common generic names)",
  ];
  return lines.join("\n");
}

// Reduces singular and plural spellings to the same stem:
// berry/berries → "berri", chilli/chillies → "chilli", tomato/tomatoes → "tomato", date/dates → "date".
function stemWord(word: string): string {
  if (word.length <= 3) return word;
  let w = word;
  if (w.endsWith("ies")) w = `${w.slice(0, -3)}i`;
  else if (/(oes|ches|shes|xes|zes|sses)$/.test(w)) w = w.slice(0, -2);
  else if (w.endsWith("s") && !/(ss|us|is)$/.test(w)) w = w.slice(0, -1);
  return w.endsWith("y") ? `${w.slice(0, -1)}i` : w;
}

// Lowercase, drop brackets and punctuation, collapse spaces, stem each word.
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map(stemWord)
    .join(" ");
}

// The library ingredient whose name or alias matches, or null.
export function matchIngredient(name: string, library: readonly Pick<Ingredient, "id" | "name" | "aliases">[]) {
  const target = normalizeName(name);
  return library.find((i) => [i.name, ...i.aliases].some((n) => normalizeName(n) === target)) ?? null;
}

export interface DraftLine {
  name: string;
  grams: number;
  displayAmount: string;
  ingredientId: number | null; // null = not in the library yet
}

export function matchDraft(draft: RecipeDraft, library: readonly Pick<Ingredient, "id" | "name" | "aliases">[]): DraftLine[] {
  return draft.ingredients.map((i) => ({
    name: i.name,
    grams: i.grams,
    displayAmount: i.displayAmount,
    ingredientId: matchIngredient(i.name, library)?.id ?? null,
  }));
}

// Recipe editor input from a fully matched draft (unmatched lines must be resolved or removed first).
export function draftToRecipeInput(draft: RecipeDraft, lines: readonly DraftLine[], mealTypes: MealType[]): RecipeInput {
  return {
    id: null,
    title: draft.title,
    description: draft.description,
    cuisine: draft.cuisine,
    mealTypes,
    servings: draft.servings,
    prepMinutes: draft.prepMinutes,
    cookMinutes: draft.cookMinutes,
    steps: draft.steps,
    imageUrl: "",
    lines: lines
      .filter((l): l is DraftLine & { ingredientId: number } => l.ingredientId !== null)
      .map((l) => ({ ingredientId: l.ingredientId, grams: l.grams, displayAmount: l.displayAmount, note: "" })),
  };
}
