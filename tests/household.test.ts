import { describe, expect, it } from "vitest";
import { displayNameSchema, generateInviteCode, householdNameSchema, inviteCodeSchema, inviteMessage, normalizeInviteCode } from "@/lib/household";

describe("invite codes", () => {
  it("are 8 characters without look-alikes (I, O, 0, 1)", () => {
    const code = generateInviteCode((a) => a.map((_, i) => i * 7 + 3) as Uint32Array);
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
    const random = generateInviteCode((a) => crypto.getRandomValues(a));
    expect(random).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
  });

  it("accept messy typing", () => {
    expect(normalizeInviteCode(" abcd-efgh ")).toBe("ABCDEFGH");
    expect(inviteCodeSchema.parse("wxyz 2345")).toBe("WXYZ2345");
    expect(inviteCodeSchema.safeParse("ABC").success).toBe(false);
  });
});

describe("names", () => {
  it("validates household and display names", () => {
    expect(householdNameSchema.safeParse("  Sharma family ").success).toBe(true);
    expect(householdNameSchema.safeParse("   ").success).toBe(false);
    expect(displayNameSchema.safeParse("Priya").success).toBe(true);
    expect(displayNameSchema.safeParse("priya@example.com").success).toBe(false); // never show emails
    expect(displayNameSchema.safeParse("x".repeat(41)).success).toBe(false);
  });
});

describe("inviteMessage", () => {
  it("includes the code, name and where to enter it", () => {
    expect(inviteMessage("WXYZ2345", "Sharma family", "https://app.example")).toBe(
      'Join our household "Sharma family" on Meal Planner to share one shopping list. Open https://app.example/household and enter code WXYZ2345.',
    );
  });
});
