// Weekly meal planner (CLAUDE.md §16). Pure and deterministic for a given seed, so it's fully
// unit-tested and costs nothing to run (no API calls). Recipes come from our own library.
//
// Safety first: a recipe is only a candidate if it is published data that passes the user's
// allergies (stored tags + a fresh word check), "other allergies" words and diet type.

import { checkRecipeSafety, findWordHit } from "@/lib/allergen-safety";
import type { AllergenId } from "@/lib/allergens";
import { type DietType, checkRecipeDiet } from "@/lib/diet";
import type { Nutrients } from "@/lib/library";
import type { MealTarget, MealType, NutritionPlan } from "@/lib/nutrition";

export const DAYS = 7;
export const MEALS: MealType[] = ["breakfast", "lunch", "dinner"];

export const PORTION_MIN = 0.5;
export const PORTION_MAX = 2;
export const PORTION_STEP = 0.25;
// How close (±) a scaled meal should be to its calorie target to count as a good fit.
export const CALORIE_TOLERANCE = 0.1;

export interface PlannerRecipe {
  id: number;
  title: string;
  cuisine: string;
  mealTypes: MealType[];
  perServing: Nutrients;
  allergenTags: AllergenId[];
  dietTypes: DietType[];
  ingredientNames: string[]; // names + aliases, for the fresh word checks
}

export interface PlannerProfile {
  allergies: readonly AllergenId[];
  otherAllergies: readonly string[];
  dietType: DietType;
}

export interface PlanSlot {
  day: number; // 0 = Monday … 6 = Sunday
  meal: MealType;
  recipeId: number;
  portion: number; // servings to eat, e.g. 1.25
  locked: boolean;
  isLeftover: boolean; // yesterday's dinner, cooked in double
}

export interface PlanResult {
  slots: PlanSlot[];
  gaps: { day: number; meal: MealType }[]; // no safe recipe at all
  notes: string[]; // e.g. "variety relaxed because the library is small"
}

// ------------------------------------------------------------------ safety filter

// Recipes this user may eat. Checks stored tags AND re-runs the word checks, so a recipe saved
// before a keyword was added still gets caught.
export function eligibleRecipes(recipes: readonly PlannerRecipe[], profile: PlannerProfile): PlannerRecipe[] {
  return recipes.filter((r) => {
    if (!r.dietTypes.includes(profile.dietType)) return false;
    if (r.allergenTags.some((t) => profile.allergies.includes(t))) return false;
    const text = { title: r.title, ingredients: r.ingredientNames };
    const safety = checkRecipeSafety({ ...text, dairyFree: null, glutenFree: null }, profile.allergies, profile.otherAllergies);
    if (!safety.safe) return false;
    if (findWordHit(text, profile.otherAllergies)) return false;
    return checkRecipeDiet({ ...text, vegetarian: null, vegan: null }, profile.dietType).ok;
  });
}

// ------------------------------------------------------------------ scoring

// The portion (0.5×–2×, in 0.25 steps) whose calories are closest to the target.
export function bestPortion(kcalPerServing: number, targetKcal: number) {
  let best = { portion: 1, kcal: kcalPerServing, deviation: Infinity };
  for (let p = PORTION_MIN; p <= PORTION_MAX + 1e-9; p += PORTION_STEP) {
    const portion = Math.round(p * 100) / 100;
    const kcal = kcalPerServing * portion;
    const deviation = targetKcal > 0 ? Math.abs(kcal - targetKcal) / targetKcal : Infinity;
    if (deviation < best.deviation) best = { portion, kcal, deviation };
  }
  return { ...best, withinTolerance: best.deviation <= CALORIE_TOLERANCE };
}

function macroShares(n: Pick<Nutrients, "proteinG" | "carbsG" | "fatG">) {
  const p = n.proteinG * 4;
  const c = n.carbsG * 4;
  const f = n.fatG * 9;
  const total = p + c + f || 1;
  return { p: p / total, c: c / total, f: f / total };
}

// Lower is better: calorie fit after scaling + closeness to the user's macro balance + a little
// seeded randomness so plans vary week to week.
function score(recipe: PlannerRecipe, target: MealTarget, macroTarget: ReturnType<typeof macroShares>, jitter: number) {
  const fit = bestPortion(recipe.perServing.kcal, target.calories);
  const shares = macroShares(recipe.perServing);
  const macroDistance =
    Math.abs(shares.p - macroTarget.p) + Math.abs(shares.c - macroTarget.c) + Math.abs(shares.f - macroTarget.f);
  const outsidePenalty = fit.withinTolerance ? 0 : 1; // strongly prefer good calorie fits
  return {
    value: outsidePenalty + fit.deviation + macroDistance * 0.5 + jitter * 0.15,
    portion: fit.portion,
    fits: fit.withinTolerance,
  };
}

// Small seeded random number generator (mulberry32): same seed → same plan.
export function seededRandom(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ------------------------------------------------------------------ variety rules

interface VarietyLevel {
  maxPerWeek: number;
  allowConsecutiveDays: boolean;
  allowSameDay: boolean;
}
const STRICT: VarietyLevel = { maxPerWeek: 2, allowConsecutiveDays: false, allowSameDay: false };
const RELAXED: VarietyLevel = { maxPerWeek: 3, allowConsecutiveDays: false, allowSameDay: false };
const LOOSE: VarietyLevel = { maxPerWeek: 7, allowConsecutiveDays: true, allowSameDay: false };
const ANYTHING: VarietyLevel = { maxPerWeek: Infinity, allowConsecutiveDays: true, allowSameDay: true };

// Tried in order. Calorie fit matters more than variety, so a good-fitting recipe may repeat up to
// 3×/week before we accept a poor fit; heavy repetition is a last resort for tiny libraries
// (repeating a safe dish beats leaving a meal empty).
const SEARCH_ORDER: { level: VarietyLevel; mustFit: boolean }[] = [
  { level: STRICT, mustFit: true },
  { level: RELAXED, mustFit: true },
  { level: STRICT, mustFit: false },
  { level: RELAXED, mustFit: false },
  { level: LOOSE, mustFit: true },
  { level: LOOSE, mustFit: false },
  { level: ANYTHING, mustFit: false },
];

function allowedByVariety(recipeId: number, day: number, slots: readonly PlanSlot[], level: VarietyLevel): boolean {
  const uses = slots.filter((s) => s.recipeId === recipeId && !s.isLeftover);
  if (uses.length >= level.maxPerWeek) return false;
  if (!level.allowSameDay && uses.some((s) => s.day === day)) return false;
  if (!level.allowConsecutiveDays && uses.some((s) => Math.abs(s.day - day) === 1)) return false;
  return true;
}

// ------------------------------------------------------------------ choosing a meal

interface PickContext {
  candidates: readonly PlannerRecipe[];
  targets: NutritionPlan;
  macroTarget: ReturnType<typeof macroShares>;
  random: () => number;
}

// Best recipe for one slot given what's already planned; says whether variety rules had to relax.
function pick(ctx: PickContext, day: number, meal: MealType, planned: readonly PlanSlot[], exclude?: number) {
  const forMeal = ctx.candidates.filter((r) => r.mealTypes.includes(meal) && r.id !== exclude);
  if (forMeal.length === 0) return null;
  // Draw jitter once per candidate so the order of the checks below can't change the result.
  const scored = forMeal
    .map((r) => ({ recipe: r, ...score(r, ctx.targets.meals[meal], ctx.macroTarget, ctx.random()) }))
    .sort((a, b) => a.value - b.value || a.recipe.id - b.recipe.id);

  for (const { level, mustFit } of SEARCH_ORDER) {
    const choice = scored.find((c) => (!mustFit || c.fits) && allowedByVariety(c.recipe.id, day, planned, level));
    if (choice) return { recipe: choice.recipe, portion: choice.portion, fits: choice.fits, relaxed: level !== STRICT };
  }
  return null;
}

export interface PlanOptions {
  seed: number;
  leftovers: boolean;
  keep?: readonly PlanSlot[]; // kept exactly as they are (locked meals, or other days when regenerating one day)
}

export function generateWeek(
  recipes: readonly PlannerRecipe[],
  profile: PlannerProfile,
  targets: NutritionPlan,
  options: PlanOptions,
): PlanResult {
  const candidates = eligibleRecipes(recipes, profile);
  const ctx: PickContext = { candidates, targets, macroTarget: macroShares(targets.macros), random: seededRandom(options.seed) };
  const slots: PlanSlot[] = (options.keep ?? []).map((s) => ({ ...s }));
  const gaps: PlanResult["gaps"] = [];
  let relaxed = false;
  let poorFit = false;

  const isTaken = (day: number, meal: MealType) => slots.some((s) => s.day === day && s.meal === meal);

  for (let day = 0; day < DAYS; day++) {
    for (const meal of MEALS) {
      if (isTaken(day, meal)) continue;

      // Leftovers: today's lunch is yesterday's dinner, portioned for lunch.
      if (options.leftovers && meal === "lunch" && day > 0) {
        const lastDinner = slots.find((s) => s.day === day - 1 && s.meal === "dinner");
        const recipe = lastDinner && candidates.find((r) => r.id === lastDinner.recipeId);
        if (recipe) {
          const { portion } = bestPortion(recipe.perServing.kcal, targets.meals.lunch.calories);
          slots.push({ day, meal, recipeId: recipe.id, portion, locked: false, isLeftover: true });
          continue;
        }
      }

      const choice = pick(ctx, day, meal, slots);
      if (!choice) {
        gaps.push({ day, meal });
        continue;
      }
      relaxed ||= choice.relaxed;
      poorFit ||= !choice.fits;
      slots.push({ day, meal, recipeId: choice.recipe.id, portion: choice.portion, locked: false, isLeftover: false });
    }
  }

  const notes: string[] = [];
  if (candidates.length === 0) notes.push("No recipes in the library suit your diet and allergies yet.");
  if (relaxed) notes.push("Some recipes repeat more than usual because only a few recipes suit you yet.");
  if (poorFit) notes.push("Some meals are more than 10% away from their calorie target because no better-fitting recipe suits you yet.");
  for (const meal of MEALS) {
    if (candidates.length > 0 && !candidates.some((r) => r.mealTypes.includes(meal))) {
      notes.push(`No ${meal} recipes suit you yet.`);
    }
  }
  slots.sort((a, b) => a.day - b.day || MEALS.indexOf(a.meal) - MEALS.indexOf(b.meal));
  return { slots, gaps, notes };
}

// Replaces one meal with the next-best different recipe, keeping the rest of the week.
export function swapMeal(
  recipes: readonly PlannerRecipe[],
  profile: PlannerProfile,
  targets: NutritionPlan,
  slots: readonly PlanSlot[],
  day: number,
  meal: MealType,
  seed: number,
): PlanSlot[] | null {
  const current = slots.find((s) => s.day === day && s.meal === meal);
  const others = slots.filter((s) => s !== current);
  const ctx: PickContext = {
    candidates: eligibleRecipes(recipes, profile),
    targets,
    macroTarget: macroShares(targets.macros),
    random: seededRandom(seed),
  };
  const choice = pick(ctx, day, meal, others, current?.recipeId);
  if (!choice) return null;
  const replacement: PlanSlot = { day, meal, recipeId: choice.recipe.id, portion: choice.portion, locked: false, isLeftover: false };
  return [...others, replacement].sort((a, b) => a.day - b.day || MEALS.indexOf(a.meal) - MEALS.indexOf(b.meal));
}

// ------------------------------------------------------------------ totals

export function dayTotals(slots: readonly PlanSlot[], day: number, recipesById: ReadonlyMap<number, PlannerRecipe>): Nutrients {
  const total: Nutrients = { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 };
  for (const s of slots) {
    if (s.day !== day) continue;
    const r = recipesById.get(s.recipeId);
    if (!r) continue;
    total.kcal += r.perServing.kcal * s.portion;
    total.proteinG += r.perServing.proteinG * s.portion;
    total.carbsG += r.perServing.carbsG * s.portion;
    total.fatG += r.perServing.fatG * s.portion;
    total.fiberG += r.perServing.fiberG * s.portion;
  }
  const round = (n: number) => Math.round(n * 10) / 10;
  return { kcal: round(total.kcal), proteinG: round(total.proteinG), carbsG: round(total.carbsG), fatG: round(total.fatG), fiberG: round(total.fiberG) };
}

// Monday of the week containing `date`, as YYYY-MM-DD in the given timezone.
export function weekStart(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" })
    .formatToParts(date)
    .reduce<Record<string, string>>((acc, p) => ({ ...acc, [p.type]: p.value }), {});
  const local = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)));
  const weekdayIndex = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(parts.weekday);
  local.setUTCDate(local.getUTCDate() - weekdayIndex);
  return local.toISOString().slice(0, 10);
}
