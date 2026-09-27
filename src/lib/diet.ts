// Diet types common in India (CLAUDE.md §13 add-on 6). Like allergies, diet rules are enforced
// twice: once in the recipe search, and again by our own word check on every recipe.

import { findAllergenHit, findWordHit } from "@/lib/allergen-safety";
import type { AllergenId } from "@/lib/allergens";
import type { Recipe } from "@/lib/spoonacular";

export const DIET_TYPES = [
  { id: "veg", label: "Vegetarian", hint: "No meat, fish or eggs. Milk products are fine." },
  { id: "eggetarian", label: "Eggetarian", hint: "Vegetarian, plus eggs." },
  { id: "vegan", label: "Vegan", hint: "No animal products: no meat, fish, eggs, dairy or honey." },
  { id: "jain", label: "Jain", hint: "Vegetarian, and no onion, garlic, root vegetables, mushrooms or honey." },
  { id: "nonveg", label: "Non-vegetarian", hint: "Everything, including meat, fish and eggs." },
] as const;

export type DietType = (typeof DIET_TYPES)[number]["id"];

export const DIET_TYPE_IDS = DIET_TYPES.map((d) => d.id) as [DietType, ...DietType[]];

export function dietLabel(id: DietType): string {
  return DIET_TYPES.find((d) => d.id === id)?.label ?? id;
}

const MEAT = [
  "meat", "chicken", "beef", "pork", "lamb", "mutton", "goat meat", "veal", "venison", "turkey", "duck", "goose",
  "bacon", "ham", "prosciutto", "pancetta", "sausage", "chorizo", "pepperoni", "salami", "hot dog", "meatball",
  "keema", "kheema", "steak", "mince", "ground beef", "ground turkey", "rabbit", "liver", "gelatin", "gelatine",
  "lard", "tallow", "suet", "bone broth", "chicken stock", "beef stock",
];
const JAIN_AVOID = [
  "onion", "shallot", "scallion", "spring onion", "green onion", "leek", "chive", "garlic", "potato",
  "sweet potato", "carrot", "beetroot", "beet", "radish", "turnip", "ginger", "yam", "taro", "cassava",
  "arrowroot", "mushroom", "honey",
];
const HONEY = ["honey"];

interface DietRule {
  meat: boolean; // meat must be absent
  allergens: AllergenId[]; // reuse the allergen rules (with their safe phrases)
  extraWords: string[];
  spoonacularDiet?: "vegetarian" | "vegan";
  spoonacularExcludes: string[];
}

const NO_FISH: AllergenId[] = ["fish-free", "shellfish-free"];

const RULES: Record<DietType, DietRule> = {
  veg: {
    meat: true,
    allergens: [...NO_FISH, "egg-free"],
    extraWords: [],
    spoonacularDiet: "vegetarian", // Spoonacular's "vegetarian" allows eggs, so eggs are excluded separately.
    spoonacularExcludes: ["egg"],
  },
  eggetarian: {
    meat: true,
    allergens: NO_FISH,
    extraWords: [],
    spoonacularDiet: "vegetarian",
    spoonacularExcludes: [],
  },
  vegan: {
    meat: true,
    allergens: [...NO_FISH, "egg-free", "dairy-free"],
    extraWords: HONEY,
    spoonacularDiet: "vegan",
    spoonacularExcludes: [],
  },
  jain: {
    meat: true,
    allergens: [...NO_FISH, "egg-free"],
    extraWords: JAIN_AVOID,
    spoonacularDiet: "vegetarian",
    spoonacularExcludes: ["egg", "onion", "garlic", "potato", "carrot", "mushroom"],
  },
  nonveg: { meat: false, allergens: [], extraWords: [], spoonacularExcludes: [] },
};

export function spoonacularDietParams(diet: DietType) {
  const rule = RULES[diet];
  return { diet: rule.spoonacularDiet, excludes: rule.spoonacularExcludes };
}

export interface DietResult {
  ok: boolean;
  reasons: string[];
}

export function checkRecipeDiet(
  recipe: Pick<Recipe, "title" | "ingredients" | "vegetarian" | "vegan">,
  diet: DietType,
): DietResult {
  const rule = RULES[diet];
  const reasons: string[] = [];

  // Spoonacular's own labels: if it says the recipe isn't vegetarian/vegan, believe it.
  if (rule.spoonacularDiet === "vegetarian" && recipe.vegetarian === false) {
    reasons.push("not vegetarian: flagged by Spoonacular");
  }
  if (rule.spoonacularDiet === "vegan" && recipe.vegan === false) reasons.push("not vegan: flagged by Spoonacular");

  if (rule.meat) {
    const hit = findWordHit(recipe, MEAT);
    if (hit) reasons.push(`meat: "${hit}"`);
  }
  for (const id of rule.allergens) {
    const hit = findAllergenHit(recipe, id);
    if (hit) reasons.push(`${id}: "${hit}"`);
  }
  const extra = findWordHit(recipe, rule.extraWords);
  if (extra) reasons.push(`${diet}: "${extra}"`);

  return { ok: reasons.length === 0, reasons };
}

export function filterDietRecipes(recipes: readonly Recipe[], diet: DietType): Recipe[] {
  return recipes.filter((r) => checkRecipeDiet(r, diet).ok);
}
