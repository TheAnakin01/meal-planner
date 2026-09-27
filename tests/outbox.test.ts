import { describe, expect, it } from "vitest";
import { type KeyValueStorage, OUTBOX_KEY, applyPending, clearOutbox, enqueueTick, flushOutbox, readOutbox } from "@/lib/outbox";

function memoryStorage(): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

const W = "2026-09-28";

describe("outbox", () => {
  it("queues ticks and keeps only the latest per item", () => {
    const s = memoryStorage();
    enqueueTick(s, { week: W, ingredientId: 1, checked: true });
    enqueueTick(s, { week: W, ingredientId: 2, checked: true });
    enqueueTick(s, { week: W, ingredientId: 1, checked: false });
    expect(readOutbox(s)).toEqual([
      { week: W, ingredientId: 2, checked: true },
      { week: W, ingredientId: 1, checked: false },
    ]);
  });

  it("applies queued ticks on top of the server's state, for the right week only", () => {
    const pending = [
      { week: W, ingredientId: 1, checked: true },
      { week: W, ingredientId: 2, checked: false },
      { week: "2026-10-05", ingredientId: 3, checked: true },
    ];
    expect([...applyPending([2, 4], pending, W)].sort()).toEqual([1, 4]);
  });

  it("flushes successful ticks and keeps failed ones", async () => {
    const s = memoryStorage();
    enqueueTick(s, { week: W, ingredientId: 1, checked: true });
    enqueueTick(s, { week: W, ingredientId: 2, checked: true });
    const sent = await flushOutbox(s, async (e) => {
      if (e.ingredientId === 2) throw new Error("offline");
      return true;
    });
    expect(sent).toBe(1);
    expect(readOutbox(s)).toEqual([{ week: W, ingredientId: 2, checked: true }]);
  });

  it("removes the storage key once everything is sent", async () => {
    const s = memoryStorage();
    enqueueTick(s, { week: W, ingredientId: 1, checked: true });
    await flushOutbox(s, async () => true);
    expect(s.data.has(OUTBOX_KEY)).toBe(false);
  });

  it("ignores corrupted or tampered storage", () => {
    const s = memoryStorage();
    s.setItem(OUTBOX_KEY, "not json");
    expect(readOutbox(s)).toEqual([]);
    s.setItem(OUTBOX_KEY, JSON.stringify([{ week: "bad", ingredientId: 1, checked: true }, { week: W, ingredientId: 2, checked: "yes" }]));
    expect(readOutbox(s)).toEqual([]);
  });

  it("works without storage (private mode) and can be cleared", () => {
    expect(readOutbox(null)).toEqual([]);
    enqueueTick(null, { week: W, ingredientId: 1, checked: true });
    const s = memoryStorage();
    enqueueTick(s, { week: W, ingredientId: 1, checked: true });
    clearOutbox(s);
    expect(readOutbox(s)).toEqual([]);
  });
});
