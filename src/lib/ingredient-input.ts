// Validation for adding/editing library ingredients (admin only). Matches the checks in
// supabase/migrations/0004_recipe_library.sql so bad data is caught before the database.

import { z } from "zod";
import { ALLERGEN_IDS } from "@/lib/allergens";
import { AISLES, type IngredientRow } from "@/lib/library";

const AISLE_IDS = AISLES.map((a) => a.id) as [(typeof AISLES)[number]["id"], ...(typeof AISLES)[number]["id"][]];

const nameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Please enter a name.")
  .max(80, "Keep names to 80 characters.")
  .regex(/^[a-z0-9][a-z0-9 ,'()/-]*$/, "Use letters, numbers, spaces and simple punctuation only.");

const grams = (max: number, label: string) =>
  z.number({ error: `Please enter ${label}.` }).min(0, `${label} can't be negative.`).max(max, `${label} looks too high.`);

export const ingredientInputSchema = z
  .object({
    name: nameSchema,
    aliases: z.array(nameSchema).max(10, "At most 10 other names."),
    fdcId: z.number().int().positive().nullable(),
    per100g: z.object({
      kcal: grams(900, "Calories"),
      proteinG: grams(100, "Protein"),
      carbsG: grams(100, "Carbs"),
      fatG: grams(100, "Fat"),
      fiberG: grams(100, "Fibre"),
    }),
    allergenTags: z.array(z.enum(ALLERGEN_IDS)),
    containsMeat: z.boolean(),
    containsFish: z.boolean(),
    containsEgg: z.boolean(),
    containsDairy: z.boolean(),
    containsHoney: z.boolean(),
    jainAvoid: z.boolean(),
    aisle: z.enum(AISLE_IDS),
    purchaseUnit: z.enum(["g", "ml", "piece"]),
    packSize: z.number().positive("Pack size must be more than 0.").max(100000),
    gramsPerPiece: z.number().positive().max(5000).nullable(),
    gramsPerMl: z.number().min(0.1).max(3),
    searchTerm: z.string().trim().min(1, "Please enter a shop search word.").max(80),
  })
  .refine((i) => i.per100g.proteinG + i.per100g.carbsG + i.per100g.fatG <= 100.5, {
    message: "Protein + carbs + fat can't be more than 100 g per 100 g.",
    path: ["per100g"],
  })
  .refine((i) => i.purchaseUnit !== "piece" || i.gramsPerPiece !== null, {
    message: "Please say how much one piece weighs.",
    path: ["gramsPerPiece"],
  });

export type IngredientInput = z.infer<typeof ingredientInputSchema>;

export function ingredientInputToRow(i: IngredientInput): Omit<IngredientRow, "id"> {
  return {
    name: i.name,
    aliases: [...new Set(i.aliases.filter((a) => a !== i.name))],
    fdc_id: i.fdcId,
    kcal_per_100g: i.per100g.kcal,
    protein_per_100g: i.per100g.proteinG,
    carbs_per_100g: i.per100g.carbsG,
    fat_per_100g: i.per100g.fatG,
    fiber_per_100g: i.per100g.fiberG,
    allergen_tags: [...new Set(i.allergenTags)],
    contains_meat: i.containsMeat,
    contains_fish: i.containsFish,
    contains_egg: i.containsEgg,
    contains_dairy: i.containsDairy,
    contains_honey: i.containsHoney,
    jain_avoid: i.jainAvoid,
    aisle: i.aisle,
    purchase_unit: i.purchaseUnit,
    pack_size: i.packSize,
    grams_per_piece: i.purchaseUnit === "piece" ? i.gramsPerPiece : null,
    grams_per_ml: i.purchaseUnit === "ml" ? i.gramsPerMl : 1,
    search_term: i.searchTerm,
  };
}
