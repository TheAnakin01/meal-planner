// Builds the week's shopping list from the meal plan (CLAUDE.md §17). Pure and unit tested.
//
// For each planned meal: grams needed = recipe grams × (servings eaten ÷ recipe servings).
// Totals are combined per ingredient, converted to what shops sell (g / ml / pieces) and
// rounded UP to whole packs.

import { AISLES, type AisleId, type Ingredient } from "@/lib/library";
import type { PlanSlot } from "@/lib/planner";

export interface ShoppingRecipe {
  id: number;
  servings: number;
  lines: { ingredientId: number; grams: number }[];
}

export type ShoppingIngredient = Pick<
  Ingredient,
  "id" | "name" | "aisle" | "purchaseUnit" | "packSize" | "gramsPerPiece" | "gramsPerMl" | "searchTerm"
>;

export interface ShoppingItem {
  ingredientId: number;
  name: string;
  aisle: AisleId;
  amount: number; // in `unit`, rounded sensibly
  unit: "g" | "ml" | "piece";
  packs: number; // packs to buy
  packSize: number;
  searchTerm: string;
  mealCount: number; // how many planned meals use it
}

export interface ShoppingList {
  aisles: { aisle: AisleId; label: string; items: ShoppingItem[] }[];
  pantry: ShoppingItem[]; // needed but already at home
}

// Water comes from the tap: never on a shopping list.
const NOT_BOUGHT = new Set(["water", "tap water", "drinking water"]);

function roundAmount(n: number, unit: ShoppingItem["unit"]): number {
  if (unit === "piece") return Math.ceil(n - 1e-9);
  if (n < 10) return Math.ceil(n * 10 - 1e-9) / 10; // e.g. 2.5 g of spice
  if (n < 100) return Math.ceil(n - 1e-9);
  return Math.ceil(n / 10 - 1e-9) * 10; // 734 g → 740 g
}

export function buildShoppingList(
  slots: readonly PlanSlot[],
  recipes: readonly ShoppingRecipe[],
  ingredients: readonly ShoppingIngredient[],
  pantryIds: ReadonlySet<number>,
): ShoppingList {
  const recipeById = new Map(recipes.map((r) => [r.id, r]));
  const ingredientById = new Map(ingredients.map((i) => [i.id, i]));
  const grams = new Map<number, number>();
  const meals = new Map<number, number>();

  for (const slot of slots) {
    const recipe = recipeById.get(slot.recipeId);
    if (!recipe || recipe.servings <= 0) continue;
    const factor = slot.portion / recipe.servings;
    for (const line of recipe.lines) {
      grams.set(line.ingredientId, (grams.get(line.ingredientId) ?? 0) + line.grams * factor);
      meals.set(line.ingredientId, (meals.get(line.ingredientId) ?? 0) + 1);
    }
  }

  const items: ShoppingItem[] = [];
  for (const [id, g] of grams) {
    const ing = ingredientById.get(id);
    if (!ing || NOT_BOUGHT.has(ing.name)) continue;
    let unit: ShoppingItem["unit"] = ing.purchaseUnit;
    let amount = g;
    if (unit === "ml") amount = g / (ing.gramsPerMl || 1);
    if (unit === "piece") {
      if (!ing.gramsPerPiece) unit = "g"; // can't count pieces without a weight: fall back to grams
      else amount = g / ing.gramsPerPiece;
    }
    amount = roundAmount(amount, unit);
    const packSize = unit === ing.purchaseUnit ? ing.packSize : 500;
    items.push({
      ingredientId: id,
      name: ing.name,
      aisle: ing.aisle,
      amount,
      unit,
      packs: Math.max(1, Math.ceil(amount / packSize - 1e-9)),
      packSize,
      searchTerm: ing.searchTerm,
      mealCount: meals.get(id) ?? 0,
    });
  }

  items.sort((a, b) => a.name.localeCompare(b.name));
  const toBuy = items.filter((i) => !pantryIds.has(i.ingredientId));
  const aisles = AISLES.map((a) => ({ aisle: a.id, label: a.label, items: toBuy.filter((i) => i.aisle === a.id) })).filter(
    (a) => a.items.length > 0,
  );
  return { aisles, pantry: items.filter((i) => pantryIds.has(i.ingredientId)) };
}

// "740 g", "1.25 kg", "250 ml", "1.5 L", "3 pieces".
export function formatAmount(amount: number, unit: ShoppingItem["unit"]): string {
  if (unit === "piece") return `${amount} piece${amount === 1 ? "" : "s"}`;
  const big = unit === "g" ? "kg" : "L";
  if (amount >= 1000) return `${Math.round((amount / 1000) * 100) / 100} ${big}`;
  return `${amount} ${unit}`;
}

// "Buy 2 × 500 g" / "Buy 1 pack of 12".
export function formatPacks(item: Pick<ShoppingItem, "packs" | "packSize" | "unit">): string {
  if (item.unit === "piece") return `Buy ${item.packs} pack${item.packs === 1 ? "" : "s"} of ${item.packSize}`;
  return `Buy ${item.packs} × ${formatAmount(item.packSize, item.unit)}`;
}
