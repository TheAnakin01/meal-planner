// Calorie and macro calculations. See CLAUDE.md §5.1 and §5.2.
// Pure functions only (no network, no database) so they are easy to test.

export type Gender = "male" | "female" | "other";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";
export type Goal = "lose" | "maintain" | "gain";
export type MealType = "breakfast" | "lunch" | "dinner";

export interface BodyProfile {
  age: number;
  weightKg: number;
  heightCm: number;
  gender: Gender;
  activityLevel: ActivityLevel;
  goal: Goal;
}

export interface Macros {
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface MealTarget {
  calories: number;
  min: number;
  max: number;
}

export interface NutritionPlan {
  bmr: number;
  tdee: number;
  calories: number;
  macros: Macros;
  meals: Record<MealType, MealTarget>;
}

export const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export const GOAL_ADJUSTMENTS: Record<Goal, number> = {
  lose: -500,
  maintain: 0,
  gain: 300,
};

export const MIN_CALORIES: Record<Gender, number> = {
  male: 1500,
  female: 1200,
  other: 1200,
};

// Protein in grams per kg of body weight, by goal.
export const PROTEIN_G_PER_KG: Record<Goal, number> = {
  lose: 2.0,
  maintain: 1.6,
  gain: 1.8,
};

export const MEAL_SPLIT: Record<MealType, number> = {
  breakfast: 0.25,
  lunch: 0.35,
  dinner: 0.4,
};

const KCAL_PER_G = { protein: 4, carbs: 4, fat: 9 } as const;
const PROTEIN_MAX_SHARE = 0.35;
const FAT_SHARE = 0.25;
const MEAL_TOLERANCE = 0.15;

// Mifflin–St Jeor. "other" uses the average of the male (+5) and female (−161) constants.
const GENDER_CONSTANT: Record<Gender, number> = {
  male: 5,
  female: -161,
  other: -78,
};

export function calculateBmr({ age, weightKg, heightCm, gender }: BodyProfile): number {
  return 10 * weightKg + 6.25 * heightCm - 5 * age + GENDER_CONSTANT[gender];
}

export function calculateTdee(profile: BodyProfile): number {
  return calculateBmr(profile) * ACTIVITY_MULTIPLIERS[profile.activityLevel];
}

export function calculateDailyCalories(profile: BodyProfile): number {
  const target = calculateTdee(profile) + GOAL_ADJUSTMENTS[profile.goal];
  const rounded = Math.round(target / 10) * 10;
  return Math.max(rounded, MIN_CALORIES[profile.gender]);
}

export function calculateMacros(calories: number, weightKg: number, goal: Goal): Macros {
  const proteinByWeight = PROTEIN_G_PER_KG[goal] * weightKg;
  const proteinCap = (calories * PROTEIN_MAX_SHARE) / KCAL_PER_G.protein;
  const protein = Math.min(proteinByWeight, proteinCap);
  const fat = (calories * FAT_SHARE) / KCAL_PER_G.fat;
  const carbs = (calories - protein * KCAL_PER_G.protein - fat * KCAL_PER_G.fat) / KCAL_PER_G.carbs;

  return {
    proteinG: Math.round(protein),
    carbsG: Math.round(carbs),
    fatG: Math.round(fat),
  };
}

export function calculateMealTargets(calories: number): Record<MealType, MealTarget> {
  const target = (share: number): MealTarget => {
    const mealCalories = Math.round(calories * share);
    return {
      calories: mealCalories,
      min: Math.round(mealCalories * (1 - MEAL_TOLERANCE)),
      max: Math.round(mealCalories * (1 + MEAL_TOLERANCE)),
    };
  };

  return {
    breakfast: target(MEAL_SPLIT.breakfast),
    lunch: target(MEAL_SPLIT.lunch),
    dinner: target(MEAL_SPLIT.dinner),
  };
}

export function calculateNutritionPlan(profile: BodyProfile): NutritionPlan {
  const calories = calculateDailyCalories(profile);
  return {
    bmr: Math.round(calculateBmr(profile)),
    tdee: Math.round(calculateTdee(profile)),
    calories,
    macros: calculateMacros(calories, profile.weightKg, profile.goal),
    meals: calculateMealTargets(calories),
  };
}

// Unit conversions for the imperial option in the profile form.
export function poundsToKg(lb: number): number {
  return Math.round(lb * 0.45359237 * 10) / 10;
}

export function feetInchesToCm(feet: number, inches: number): number {
  return Math.round((feet * 12 + inches) * 2.54 * 10) / 10;
}
