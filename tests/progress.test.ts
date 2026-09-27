import { describe, expect, it } from "vitest";
import {
  averageIntake,
  dailyIntake,
  daysOnTarget,
  lastNDates,
  loggingStreak,
  niceTicks,
  shouldSuggestProfileUpdate,
  weightSummary,
} from "@/lib/progress";

describe("lastNDates", () => {
  it("lists the last n days, oldest first", () => {
    expect(lastNDates("2026-10-02", 4)).toEqual(["2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02"]);
  });
});

describe("dailyIntake", () => {
  it("adds up each day and marks empty days as not logged", () => {
    const rows = [
      { eaten_on: "2026-09-30", calories: 500, protein_g: 20 },
      { eaten_on: "2026-09-30", calories: 700.4, protein_g: 30.2 },
      { eaten_on: "2026-10-02", calories: 1800, protein_g: 80 },
    ];
    expect(dailyIntake(rows, ["2026-09-30", "2026-10-01", "2026-10-02"])).toEqual([
      { date: "2026-09-30", kcal: 1200, proteinG: 50, logged: true },
      { date: "2026-10-01", kcal: 0, proteinG: 0, logged: false },
      { date: "2026-10-02", kcal: 1800, proteinG: 80, logged: true },
    ]);
  });
});

describe("loggingStreak", () => {
  const logged = new Set(["2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01"]);
  it("counts days in a row ending today", () => {
    expect(loggingStreak(logged, "2026-10-01")).toBe(4);
  });
  it("still counts yesterday's streak if today isn't logged yet", () => {
    expect(loggingStreak(logged, "2026-10-02")).toBe(4);
  });
  it("is 0 after a missed day", () => {
    expect(loggingStreak(logged, "2026-10-03")).toBe(0);
    expect(loggingStreak(new Set(), "2026-10-03")).toBe(0);
  });
});

describe("daysOnTarget and averageIntake", () => {
  const days = [
    { date: "a", kcal: 2000, proteinG: 90, logged: true },
    { date: "b", kcal: 2400, proteinG: 70, logged: true },
    { date: "c", kcal: 0, proteinG: 0, logged: false },
    { date: "d", kcal: 1880, proteinG: 100, logged: true },
  ];
  it("counts logged days within ±10% of target", () => {
    expect(daysOnTarget(days, 2050)).toBe(2); // 2000 and 1880; 2400 is 17% over
  });
  it("averages logged days only", () => {
    expect(averageIntake(days)).toEqual({ kcal: 2093, proteinG: 87 });
    expect(averageIntake([])).toBeNull();
  });
});

describe("weightSummary", () => {
  it("compares the latest weigh-in with the one ~30 days earlier", () => {
    const s = weightSummary([
      { date: "2026-10-01", kg: 71.2 },
      { date: "2026-08-25", kg: 73.5 },
      { date: "2026-09-01", kg: 73.0 },
      { date: "2026-09-15", kg: 72.1 },
    ]);
    expect(s).toEqual({ latest: { date: "2026-10-01", kg: 71.2 }, change30: -1.8 });
  });
  it("uses the first weigh-in when there's less than 30 days of history", () => {
    expect(weightSummary([{ date: "2026-09-20", kg: 70 }, { date: "2026-10-01", kg: 70.6 }])?.change30).toBe(0.6);
  });
  it("handles one or no weigh-ins", () => {
    expect(weightSummary([{ date: "2026-10-01", kg: 70 }])?.change30).toBeNull();
    expect(weightSummary([])).toBeNull();
  });
});

describe("niceTicks", () => {
  it("picks clean round numbers", () => {
    expect(niceTicks(0, 2460)).toEqual([0, 1000, 2000, 3000]);
    expect(niceTicks(70.4, 73.1)).toEqual([70, 71, 72, 73, 74]);
    expect(niceTicks(70, 70)).toEqual([69, 69.5, 70, 70.5, 71]);
  });
});

describe("shouldSuggestProfileUpdate", () => {
  it("suggests an update when the latest weight is 1 kg or more away", () => {
    expect(shouldSuggestProfileUpdate(72, 70.9)).toBe(true);
    expect(shouldSuggestProfileUpdate(72, 71.5)).toBe(false);
    expect(shouldSuggestProfileUpdate(72, null)).toBe(false);
  });
});
