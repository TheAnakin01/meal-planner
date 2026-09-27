import { describe, expect, it } from "vitest";
import { describeAction, parseFunctionCalls, shoppingItemWarning } from "@/lib/coach-actions";

describe("parseFunctionCalls", () => {
  it("turns Gemini function calls into validated actions", () => {
    expect(
      parseFunctionCalls([
        { name: "swap_meal", args: { day: "Tuesday", meal: "dinner" } },
        { name: "add_to_shopping_list", args: { item: " bananas (6) " } },
      ]),
    ).toEqual([
      { type: "swap_meal", day: 1, meal: "dinner" },
      { type: "add_to_shopping_list", item: "bananas (6)" },
    ]);
  });

  it("accepts different capitalisation", () => {
    expect(parseFunctionCalls([{ name: "swap_meal", args: { day: "sunday", meal: "Lunch" } }])).toEqual([
      { type: "swap_meal", day: 6, meal: "lunch" },
    ]);
  });

  it("drops unknown functions and bad arguments", () => {
    expect(
      parseFunctionCalls([
        { name: "delete_account", args: {} },
        { name: "swap_meal", args: { day: "Funday", meal: "dinner" } },
        { name: "swap_meal", args: { day: "Monday", meal: "snack" } },
        { name: "add_to_shopping_list", args: { item: "" } },
        { name: "add_to_shopping_list", args: { item: "x".repeat(81) } },
        { name: "add_to_shopping_list" },
      ]),
    ).toEqual([]);
  });

  it("allows at most 3 actions per reply", () => {
    const calls = Array.from({ length: 5 }, (_, i) => ({ name: "add_to_shopping_list", args: { item: `item ${i}` } }));
    expect(parseFunctionCalls(calls)).toHaveLength(3);
  });
});

describe("describeAction", () => {
  it("describes actions in plain words", () => {
    expect(describeAction({ type: "swap_meal", day: 1, meal: "dinner" })).toBe("Swap Tuesday's dinner for another recipe that suits you");
    expect(describeAction({ type: "add_to_shopping_list", item: "bananas" })).toBe('Add "bananas" to your shopping list');
  });
});

describe("shoppingItemWarning", () => {
  it("warns when an item matches the user's allergies", () => {
    expect(shoppingItemWarning("peanut butter", ["peanut-free"], [])).toBe("Contains Peanuts — on your allergy list.");
    expect(shoppingItemWarning("kiwis", [], ["kiwi"])).toBe("Contains kiwi — on your allergy list.");
  });

  it("is quiet for safe items", () => {
    expect(shoppingItemWarning("bananas", ["peanut-free"], ["kiwi"])).toBeNull();
  });
});
