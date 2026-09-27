// Household sharing (CLAUDE.md §13 add-on 14): invite codes and input rules. Pure, unit tested.

import { z } from "zod";

// No I, O, 0 or 1 — easy to read aloud and type from a WhatsApp message.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const INVITE_CODE_LENGTH = 8;

// `randomValues` fills an array with random numbers (crypto.getRandomValues in the app).
export function generateInviteCode(randomValues: (array: Uint32Array) => Uint32Array): string {
  const values = randomValues(new Uint32Array(INVITE_CODE_LENGTH));
  return [...values].map((v) => CODE_ALPHABET[v % CODE_ALPHABET.length]).join("");
}

// "abcd-efgh " → "ABCDEFGH"
export function normalizeInviteCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export const inviteCodeSchema = z
  .string()
  .transform(normalizeInviteCode)
  .refine((c) => /^[A-Z2-9]{8}$/.test(c), "Invite codes are 8 letters and numbers.");

export const householdNameSchema = z.string().trim().min(1, "Give your household a name.").max(60, "Keep it under 60 characters.");

export const displayNameSchema = z
  .string()
  .trim()
  .min(1, "Enter the name others will see.")
  .max(40, "Keep it under 40 characters.")
  .refine((n) => !/@/.test(n), "Please don't use an email address.");

export function inviteMessage(code: string, householdName: string, appUrl: string): string {
  return `Join our household "${householdName}" on Meal Planner to share one shopping list. Open ${appUrl}/household and enter code ${code}.`;
}
