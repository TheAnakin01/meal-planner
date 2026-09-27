// Offline outbox for shopping-list ticks (CLAUDE.md §19). When a tick can't reach the server
// (no signal in the shop), it's kept here and sent when the phone is back online.
// Storage is injected so this is unit-testable; the app passes window.localStorage.

export interface TickEntry {
  week: string; // YYYY-MM-DD (Monday)
  ingredientId: number;
  checked: boolean;
  scope?: "me" | "household"; // which list (missing = "me", for entries saved before households existed)
}

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const OUTBOX_KEY = "meal-planner-outbox-v1";

function isEntry(value: unknown): value is TickEntry {
  const v = value as TickEntry;
  return (
    typeof v === "object" &&
    v !== null &&
    typeof v.week === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(v.week) &&
    Number.isInteger(v.ingredientId) &&
    typeof v.checked === "boolean" &&
    (v.scope === undefined || v.scope === "me" || v.scope === "household")
  );
}

export function readOutbox(storage: KeyValueStorage | null): TickEntry[] {
  if (!storage) return [];
  try {
    const parsed: unknown = JSON.parse(storage.getItem(OUTBOX_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter(isEntry) : [];
  } catch {
    return [];
  }
}

function writeOutbox(storage: KeyValueStorage | null, entries: TickEntry[]) {
  if (!storage) return;
  try {
    if (entries.length === 0) storage.removeItem(OUTBOX_KEY);
    else storage.setItem(OUTBOX_KEY, JSON.stringify(entries));
  } catch {
    // Storage full or blocked (private mode): the tick just won't survive a reload.
  }
}

const sameItem = (a: TickEntry, b: TickEntry) =>
  a.week === b.week && a.ingredientId === b.ingredientId && (a.scope ?? "me") === (b.scope ?? "me");

// Adds a tick; a later tick for the same item replaces the earlier one.
export function enqueueTick(storage: KeyValueStorage | null, entry: TickEntry) {
  const others = readOutbox(storage).filter((e) => !sameItem(e, entry));
  writeOutbox(storage, [...others, entry]);
}

// Ticked state for a week with queued (not yet sent) ticks applied on top of the server's.
export function applyPending(
  serverChecked: readonly number[],
  pending: readonly TickEntry[],
  week: string,
  scope: "me" | "household" = "me",
): Set<number> {
  const set = new Set(serverChecked);
  for (const e of pending) {
    if (e.week !== week || (e.scope ?? "me") !== scope) continue;
    if (e.checked) set.add(e.ingredientId);
    else set.delete(e.ingredientId);
  }
  return set;
}

// Sends queued ticks one by one; keeps the ones that still fail. Returns how many were sent.
export async function flushOutbox(
  storage: KeyValueStorage | null,
  send: (entry: TickEntry) => Promise<boolean>,
): Promise<number> {
  const entries = readOutbox(storage);
  const failed: TickEntry[] = [];
  let sent = 0;
  for (const entry of entries) {
    let ok = false;
    try {
      ok = await send(entry);
    } catch {
      ok = false;
    }
    if (ok) sent++;
    else failed.push(entry);
  }
  // Keep anything queued while we were sending.
  const queuedMeanwhile = readOutbox(storage).filter(
    (e) => !entries.some((x) => sameItem(x, e) && x.checked === e.checked),
  );
  writeOutbox(storage, [...failed, ...queuedMeanwhile]);
  return sent;
}

export function clearOutbox(storage: KeyValueStorage | null) {
  writeOutbox(storage, []);
}

// localStorage, or null when unavailable (private mode, blocked site data).
export function browserStorage(): KeyValueStorage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}
