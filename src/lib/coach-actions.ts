// Actions the AI coach may PROPOSE (CLAUDE.md §18). The user must confirm each one; the server then
// runs the app's normal, safety-checked code (e.g. the planner picks the replacement meal, never the AI).

import { z } from "zod";
import { findAllergenHit, findWordHit } from "@/lib/allergen-safety";
import { type AllergenId, allergenLabel } from "@/lib/allergens";
import type { MealType } from "@/lib/nutrition";

export const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

// Gemini function declarations (OpenAPI-style schema subset).
export const COACH_TOOLS = [
  {
    functionDeclarations: [
      {
        name: "swap_meal",
        description:
          "Propose replacing one meal in the user's plan for this week with another recipe that fits their diet, allergies and calories. The app chooses the new recipe.",
        parameters: {
          type: "object",
          properties: {
            day: { type: "string", enum: [...DAY_NAMES], description: "Day of this week" },
            meal: { type: "string", enum: ["breakfast", "lunch", "dinner"] },
          },
          required: ["day", "meal"],
        },
      },
      {
        name: "add_to_shopping_list",
        description: "Propose adding one item to the user's shopping list for this week.",
        parameters: {
          type: "object",
          properties: { item: { type: "string", description: "Short item name, e.g. 'bananas (6)'" } },
          required: ["item"],
        },
      },
    ],
  },
];

export const coachActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("swap_meal"), day: z.number().int().min(0).max(6), meal: z.enum(["breakfast", "lunch", "dinner"]) }),
  z.object({ type: z.literal("add_to_shopping_list"), item: z.string().trim().min(1).max(80) }),
]);
export type CoachAction = z.infer<typeof coachActionSchema>;

const MAX_ACTIONS_PER_REPLY = 3;

// Turns Gemini's function calls into validated actions; anything unknown or malformed is dropped.
export function parseFunctionCalls(calls: readonly { name?: unknown; args?: unknown }[]): CoachAction[] {
  const actions: CoachAction[] = [];
  for (const call of calls) {
    const args = (call.args ?? {}) as Record<string, unknown>;
    let candidate: unknown = null;
    if (call.name === "swap_meal") {
      const day = DAY_NAMES.findIndex((d) => d.toLowerCase() === String(args.day ?? "").toLowerCase());
      candidate = { type: "swap_meal", day, meal: String(args.meal ?? "").toLowerCase() };
    } else if (call.name === "add_to_shopping_list") {
      candidate = { type: "add_to_shopping_list", item: args.item };
    }
    const parsed = coachActionSchema.safeParse(candidate);
    if (parsed.success) actions.push(parsed.data);
    if (actions.length === MAX_ACTIONS_PER_REPLY) break;
  }
  return actions;
}

const MEAL_WORD: Record<MealType, string> = { breakfast: "breakfast", lunch: "lunch", dinner: "dinner" };

export function describeAction(action: CoachAction): string {
  if (action.type === "swap_meal") return `Swap ${DAY_NAMES[action.day]}'s ${MEAL_WORD[action.meal]} for another recipe that suits you`;
  return `Add "${action.item}" to your shopping list`;
}

// Warns (doesn't block — it may be for someone else at home) when a shopping item matches an allergy.
export function shoppingItemWarning(item: string, allergies: readonly AllergenId[], otherAllergies: readonly string[]): string | null {
  const text = { title: item, ingredients: [] };
  const hits = allergies.filter((id) => findAllergenHit(text, id)).map(allergenLabel);
  const other = findWordHit(text, otherAllergies);
  if (other) hits.push(other);
  return hits.length > 0 ? `Contains ${hits.join(", ")} — on your allergy list.` : null;
}
