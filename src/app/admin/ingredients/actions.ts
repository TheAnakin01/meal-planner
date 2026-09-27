"use server";

import { revalidatePath } from "next/cache";
import { isCurrentUserAdmin } from "@/lib/admin-server";
import { ingredientInputSchema, ingredientInputToRow } from "@/lib/ingredient-input";
import { createClient } from "@/lib/supabase/server";
import type { UsdaFood } from "@/lib/usda";
import { searchUsda } from "@/lib/usda-server";

const USDA_ERRORS = {
  not_configured: "The USDA key isn't set up. Add USDA_FDC_API_KEY to .env.local and Vercel.",
  unauthorized: "USDA didn't accept the key. Check USDA_FDC_API_KEY.",
  rate_limited: "Too many USDA searches this hour. Please try again later.",
  unavailable: "USDA didn't answer properly. Please try again in a moment.",
} as const;

export async function searchUsdaAction(query: string): Promise<{ foods: UsdaFood[] } | { error: string }> {
  if (!(await isCurrentUserAdmin())) return { error: "Only admins can do this." };
  const q = query.trim();
  if (q.length < 2 || q.length > 80) return { error: "Please type 2 to 80 characters." };

  const result = await searchUsda(q);
  return result.ok ? { foods: result.foods } : { error: USDA_ERRORS[result.error] };
}

export async function createIngredientAction(input: unknown): Promise<{ ok: true } | { error: string }> {
  if (!(await isCurrentUserAdmin())) return { error: "Only admins can do this." };

  const parsed = ingredientInputSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.from("ingredients").insert(ingredientInputToRow(parsed.data));
  if (error) {
    if (error.code === "23505") {
      return {
        error: error.message.includes("fdc_id")
          ? "Another ingredient already uses this USDA food. Pick a different match or enter nutrition manually."
          : `An ingredient called "${parsed.data.name}" already exists.`,
      };
    }
    console.error("createIngredientAction failed:", error.message);
    return { error: "Couldn't save the ingredient. Please try again." };
  }

  revalidatePath("/admin/ingredients");
  revalidatePath("/admin");
  return { ok: true };
}
