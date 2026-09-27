// Profile form validation. Values are always metric here; the form converts imperial first.
// Ranges match the database checks in CLAUDE.md §6.

import { z } from "zod";
import { ALLERGEN_IDS } from "@/lib/allergens";

export const profileSchema = z.object({
  age: z
    .number({ error: "Please enter your age." })
    .int("Please enter your age in whole years.")
    .min(16, "This app is for people aged 16 to 100.")
    .max(100, "This app is for people aged 16 to 100."),
  weightKg: z
    .number({ error: "Please enter your weight." })
    .min(30, "Please enter a weight between 30 and 300 kg (66–661 lb).")
    .max(300, "Please enter a weight between 30 and 300 kg (66–661 lb)."),
  heightCm: z
    .number({ error: "Please enter your height." })
    .min(120, "Please enter a height between 120 and 230 cm (3'11\"–7'6\").")
    .max(230, "Please enter a height between 120 and 230 cm (3'11\"–7'6\")."),
  gender: z.enum(["male", "female", "other"], { error: "Please choose an option." }),
  activityLevel: z.enum(["sedentary", "light", "moderate", "active", "very_active"], {
    error: "Please choose your activity level.",
  }),
  goal: z.enum(["lose", "maintain", "gain"], { error: "Please choose a goal." }),
  allergies: z.array(z.enum(ALLERGEN_IDS)),
  otherAllergies: z
    .array(
      z
        .string()
        .max(40, "Each allergy should be 40 characters or fewer.")
        .regex(/^[a-z][a-z '-]*$/, "Use letters only, separated by commas (e.g. kiwi, strawberry)."),
    )
    .max(20, "Please list at most 20 other allergies."),
});

export type ProfileInput = z.infer<typeof profileSchema>;
export type ProfileField = keyof ProfileInput;
