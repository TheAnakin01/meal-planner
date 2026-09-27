import { describe, expect, it } from "vitest";
import { diaryTotals, localDate, manualEntrySchema, shiftDate } from "@/lib/diary";

describe("diaryTotals", () => {
  it("adds up the day's entries", () => {
    expect(
      diaryTotals([
        { calories: 305.9, proteinG: 7.3, carbsG: 31.2, fatG: 11 },
        { calories: 480, proteinG: 16, carbsG: 70, fatG: 12.5 },
      ]),
    ).toEqual({ kcal: 785.9, proteinG: 23.3, carbsG: 101.2, fatG: 23.5, fiberG: 0 });
    expect(diaryTotals([])).toEqual({ kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 });
  });
});

describe("dates", () => {
  it("shifts days across months and years", () => {
    expect(shiftDate("2026-09-30", 1)).toBe("2026-10-01");
    expect(shiftDate("2027-01-01", -1)).toBe("2026-12-31");
  });

  it("gives today's date in the user's timezone", () => {
    expect(localDate(new Date("2026-09-27T20:00:00Z"), "Asia/Kolkata")).toBe("2026-09-28");
    expect(localDate(new Date("2026-09-27T20:00:00Z"), "America/New_York")).toBe("2026-09-27");
  });
});

describe("manualEntrySchema", () => {
  const valid = { date: "2026-09-28", meal: "snack", label: "Banana", amount: "1 medium", calories: 105, proteinG: 1.3, carbsG: 27, fatG: 0.4 };
  it("accepts a normal entry", () => {
    expect(manualEntrySchema.safeParse(valid).success).toBe(true);
  });
  it("rejects bad input", () => {
    expect(manualEntrySchema.safeParse({ ...valid, calories: NaN }).success).toBe(false);
    expect(manualEntrySchema.safeParse({ ...valid, label: "  " }).success).toBe(false);
    expect(manualEntrySchema.safeParse({ ...valid, meal: "brunch" }).success).toBe(false);
    expect(manualEntrySchema.safeParse({ ...valid, date: "28/09/2026" }).success).toBe(false);
  });
});
