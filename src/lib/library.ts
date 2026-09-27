// Our own recipe library (CLAUDE.md §15, §20): shapes of ingredients and recipes, and conversion
// from database rows. Matches supabase/migrations/0004_recipe_library.sql.

import { ALLERGEN_IDS, type AllergenId } from "@/lib/allergens";
import { DIET_TYPE_IDS, type DietType } from "@/lib/diet";
import type { MealType } from "@/lib/nutrition";

export const AISLES = [
  { id: "produce", label: "Fruit & vegetables" },
  { id: "dairy", label: "Dairy & eggs" },
  { id: "meat_fish", label: "Meat & fish" },
  { id: "grains", label: "Rice, flour & grains" },
  { id: "pulses", label: "Dals & pulses" },
  { id: "spices", label: "Spices & masalas" },
  { id: "oils", label: "Oils & ghee" },
  { id: "bakery", label: "Bread & bakery" },
  { id: "frozen", label: "Frozen" },
  { id: "beverages", label: "Drinks" },
  { id: "snacks", label: "Snacks & dry fruits" },
  { id: "condiments", label: "Sauces & condiments" },
  { id: "other", label: "Other" },
] as const;

export type AisleId = (typeof AISLES)[number]["id"];
export type PurchaseUnit = "g" | "ml" | "piece";
export type RecipeStatus = "draft" | "published";

export interface Nutrients {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
}

export interface Ingredient {
  id: number;
  name: string;
  aliases: string[];
  fdcId: number | null;
  per100g: Nutrients | null; // null until nutrition is imported (Step 16)
  allergenTags: AllergenId[];
  containsMeat: boolean;
  containsFish: boolean;
  containsEgg: boolean;
  containsDairy: boolean;
  containsHoney: boolean;
  jainAvoid: boolean;
  aisle: AisleId;
  purchaseUnit: PurchaseUnit;
  packSize: number;
  gramsPerPiece: number | null;
  gramsPerMl: number;
  searchTerm: string;
}

export interface LibraryRecipe {
  id: number;
  title: string;
  description: string;
  cuisine: string;
  mealTypes: MealType[];
  servings: number;
  prepMinutes: number;
  cookMinutes: number;
  steps: string[];
  imageUrl: string | null;
  status: RecipeStatus;
  source: "owner" | "ai";
  perServing: Nutrients | null; // null until computed (Step 16)
  allergenTags: AllergenId[];
  dietTypes: DietType[];
}

type Num = number | string | null;

// Postgres numeric columns can arrive as strings; null stays null.
function num(value: Num): number | null {
  if (value === null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function nutrients(kcal: Num, protein: Num, carbs: Num, fat: Num, fiber: Num): Nutrients | null {
  const k = num(kcal);
  const p = num(protein);
  const c = num(carbs);
  const f = num(fat);
  if (k === null || p === null || c === null || f === null) return null;
  return { kcal: k, proteinG: p, carbsG: c, fatG: f, fiberG: num(fiber) ?? 0 };
}

// Unknown tags are dropped rather than trusted.
function knownAllergens(tags: string[]): AllergenId[] {
  return tags.filter((t): t is AllergenId => (ALLERGEN_IDS as string[]).includes(t));
}

export interface IngredientRow {
  id: number;
  name: string;
  aliases: string[];
  fdc_id: number | null;
  kcal_per_100g: Num;
  protein_per_100g: Num;
  carbs_per_100g: Num;
  fat_per_100g: Num;
  fiber_per_100g: Num;
  allergen_tags: string[];
  contains_meat: boolean;
  contains_fish: boolean;
  contains_egg: boolean;
  contains_dairy: boolean;
  contains_honey: boolean;
  jain_avoid: boolean;
  aisle: AisleId;
  purchase_unit: PurchaseUnit;
  pack_size: Num;
  grams_per_piece: Num;
  grams_per_ml: Num;
  search_term: string;
}

export function ingredientFromRow(r: IngredientRow): Ingredient {
  return {
    id: Number(r.id),
    name: r.name,
    aliases: r.aliases,
    fdcId: r.fdc_id,
    per100g: nutrients(r.kcal_per_100g, r.protein_per_100g, r.carbs_per_100g, r.fat_per_100g, r.fiber_per_100g),
    allergenTags: knownAllergens(r.allergen_tags),
    containsMeat: r.contains_meat,
    containsFish: r.contains_fish,
    containsEgg: r.contains_egg,
    containsDairy: r.contains_dairy,
    containsHoney: r.contains_honey,
    jainAvoid: r.jain_avoid,
    aisle: r.aisle,
    purchaseUnit: r.purchase_unit,
    packSize: num(r.pack_size) ?? 500,
    gramsPerPiece: num(r.grams_per_piece),
    gramsPerMl: num(r.grams_per_ml) ?? 1,
    searchTerm: r.search_term,
  };
}

export interface RecipeRow {
  id: number;
  title: string;
  description: string;
  cuisine: string;
  meal_types: string[];
  servings: number;
  prep_minutes: number;
  cook_minutes: number;
  steps: string[];
  image_url: string | null;
  status: RecipeStatus;
  source: "owner" | "ai";
  kcal_per_serving: Num;
  protein_per_serving: Num;
  carbs_per_serving: Num;
  fat_per_serving: Num;
  fiber_per_serving: Num;
  allergen_tags: string[];
  diet_types: string[];
}

const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner"];

export function recipeFromRow(r: RecipeRow): LibraryRecipe {
  return {
    id: Number(r.id),
    title: r.title,
    description: r.description,
    cuisine: r.cuisine,
    mealTypes: r.meal_types.filter((m): m is MealType => (MEAL_TYPES as string[]).includes(m)),
    servings: r.servings,
    prepMinutes: r.prep_minutes,
    cookMinutes: r.cook_minutes,
    steps: r.steps,
    imageUrl: r.image_url,
    status: r.status,
    source: r.source,
    perServing: nutrients(
      r.kcal_per_serving,
      r.protein_per_serving,
      r.carbs_per_serving,
      r.fat_per_serving,
      r.fiber_per_serving,
    ),
    allergenTags: knownAllergens(r.allergen_tags),
    dietTypes: r.diet_types.filter((d): d is DietType => (DIET_TYPE_IDS as string[]).includes(d)),
  };
}
