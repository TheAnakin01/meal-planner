"use server";

import { redirect } from "next/navigation";
import { profileToRow } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { profileSchema } from "@/lib/validation";

export interface SaveProfileResult {
  error: string;
}

// Called by ProfileForm. Validates again on the server: never trust the browser.
export async function saveProfile(input: unknown): Promise<SaveProfileResult> {
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Some details look wrong. Please check the form and try again." };
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) redirect("/login?next=/profile");

  const { error } = await supabase.from("profiles").upsert(profileToRow(userId, parsed.data));
  if (error) {
    console.error("saveProfile failed:", error.message);
    return { error: "We couldn't save your profile. Please try again in a moment." };
  }

  redirect("/dashboard");
}
