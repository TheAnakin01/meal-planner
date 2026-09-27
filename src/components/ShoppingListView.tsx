"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useCallback, useEffect, useState, useTransition } from "react";
import {
  addCustomItemAction,
  deleteCustomItemAction,
  setCheckedAction,
  setCustomCheckedAction,
  setPantryAction,
  setPreferredStoreAction,
} from "@/app/shopping/actions";
import { applyPending, browserStorage, enqueueTick, flushOutbox, readOutbox } from "@/lib/outbox";
import { createClient } from "@/lib/supabase/client";
import type { CustomItem } from "@/lib/shopping-server";
import {
  type ShoppingItem,
  type ShoppingList,
  buildShareText,
  formatAmount,
  formatPacks,
  whatsappShareUrl,
} from "@/lib/shopping";
import { STORES, type StoreId, storeName, storeSearchUrl } from "@/lib/stores";

interface Props {
  list: ShoppingList;
  checkedIds: number[];
  custom: CustomItem[];
  preferredStore: StoreId;
  shareTitle: string;
  week: string; // YYYY-MM-DD Monday, for ticks made offline
  scope: "me" | "household";
  householdId: number | null; // for live updates of the shared list
}

const linkButton = "text-xs font-semibold text-emerald-700 hover:underline disabled:opacity-50 dark:text-emerald-400";

const OFFLINE_MESSAGE = "You're offline — this needs internet. Ticking items still works.";

export default function ShoppingListView({ list, checkedIds, custom, preferredStore, shareTitle, week, scope, householdId }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [store, setStore] = useState<StoreId>(preferredStore);
  const [copied, setCopied] = useState(false);
  const [newItem, setNewItem] = useState("");
  // Ticks show instantly. Without signal they wait in the outbox (on this phone) and sync later.
  const [checked, setChecked] = useState(() => new Set(checkedIds));
  const [waiting, setWaiting] = useState(0);

  const flush = useCallback(async () => {
    const storage = browserStorage();
    if (readOutbox(storage).length === 0 || !navigator.onLine) return;
    const sent = await flushOutbox(storage, async (e) => (await setCheckedAction(e.ingredientId, e.checked, e.week, e.scope ?? "me")).ok);
    setWaiting(readOutbox(storage).length);
    if (sent > 0) router.refresh();
  }, [router]);

  useEffect(() => {
    // Show ticks made offline (saved on this phone) on top of the server's list, then try to send them.
    const pending = readOutbox(browserStorage());
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing with phone storage after mount
    setChecked(applyPending(checkedIds, pending, week, scope));
    setWaiting(pending.length);
    void flush();
    window.addEventListener("online", flush);
    return () => window.removeEventListener("online", flush);
  }, [checkedIds, week, scope, flush]);

  // Shared list: when anyone in the household ticks or adds something, reload (Supabase Realtime).
  useEffect(() => {
    if (scope !== "household" || householdId === null) return;
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const channel = supabase
      .channel(`household-list-${householdId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "household_list_items", filter: `household_id=eq.${householdId}` },
        () => {
          if (timer) clearTimeout(timer);
          timer = setTimeout(() => router.refresh(), 400); // one refresh for a burst of changes
        },
      )
      .subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [scope, householdId, router]);

  async function toggle(id: number) {
    const next = !checked.has(id);
    setError("");
    setChecked((current) => {
      const updated = new Set(current);
      if (next) updated.add(id);
      else updated.delete(id);
      return updated;
    });
    const queue = () => {
      enqueueTick(browserStorage(), { week, ingredientId: id, checked: next, scope });
      setWaiting(readOutbox(browserStorage()).length);
    };
    if (!navigator.onLine) return queue();
    try {
      const r = await setCheckedAction(id, next, week, scope);
      if (!r.ok) {
        setError(r.error);
        setChecked((current) => {
          const reverted = new Set(current);
          if (next) reverted.delete(id);
          else reverted.add(id);
          return reverted;
        });
      }
    } catch {
      queue(); // lost signal mid-way: keep the tick and send it later
    }
  }

  function run(task: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    setError("");
    if (!navigator.onLine) {
      setError(OFFLINE_MESSAGE);
      return;
    }
    startTransition(async () => {
      try {
        const r = await task();
        if (!r.ok) setError(r.error);
      } catch {
        setError(navigator.onLine ? "Something went wrong. Please try again." : OFFLINE_MESSAGE);
      }
    });
  }

  function add(event: FormEvent) {
    event.preventDefault();
    const label = newItem;
    run(async () => {
      const r = await addCustomItemAction(label, scope);
      if (r.ok) setNewItem("");
      return r;
    });
  }

  const shareText = buildShareText(list, checked, custom, shareTitle);

  async function copyList() {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError("Couldn't copy. Please use the WhatsApp button instead.");
    }
  }

  function changeStore(next: StoreId) {
    setStore(next);
    run(() => setPreferredStoreAction(next));
  }

  const allItems = list.aisles.flatMap((a) => a.items);
  const total = allItems.length + custom.length;
  const done = allItems.filter((i) => checked.has(i.ingredientId)).length + custom.filter((c) => c.checked).length;

  const itemRow = (item: ShoppingItem) => {
    const isChecked = checked.has(item.ingredientId);
    return (
      <li key={item.ingredientId} className="flex items-start gap-3 py-2">
        <input
          type="checkbox"
          id={`item-${item.ingredientId}`}
          checked={isChecked}
          onChange={() => void toggle(item.ingredientId)}
          className="mt-1 h-5 w-5 shrink-0 accent-emerald-700"
        />
        <div className="min-w-0 flex-1">
          <label htmlFor={`item-${item.ingredientId}`} className={`font-medium ${isChecked ? "text-zinc-600 line-through dark:text-zinc-400" : ""}`}>
            {item.name}
          </label>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Need {formatAmount(item.amount, item.unit)} · {formatPacks(item)}
          </p>
          {!isChecked && (
            <a
              href={storeSearchUrl(store, item.searchTerm)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
            >
              Buy on {storeName(store)}
              <span className="sr-only"> – {item.name} (opens in a new tab)</span> ↗
            </a>
          )}
        </div>
        <button type="button" disabled={pending} onClick={() => run(() => setPantryAction(item.ingredientId, true))} className={linkButton}>
          Have it<span className="sr-only"> ({item.name}, move to pantry)</span>
        </button>
      </li>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className="text-sm font-medium">
          Buy from
          <select
            value={store}
            onChange={(e) => changeStore(e.target.value as StoreId)}
            className="mt-1 block rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-base dark:border-zinc-700"
          >
            {STORES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        {total > 0 && (
          <div className="flex gap-2">
            <a
              href={whatsappShareUrl(shareText)}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
            >
              Share on WhatsApp<span className="sr-only"> (opens in a new tab)</span>
            </a>
            <button
              type="button"
              onClick={copyList}
              className="rounded-xl border border-zinc-300 px-4 py-2 text-sm font-semibold hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              {copied ? "Copied!" : "Copy list"}
            </button>
          </div>
        )}
      </div>

      <p className="text-sm text-zinc-600 dark:text-zinc-400" role="status">
        {total === 0 ? "Nothing to buy yet." : `${done} of ${total} ticked`}
        {waiting > 0 && ` · ${waiting} tick${waiting === 1 ? "" : "s"} waiting to sync`}
      </p>
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      {list.aisles.map((aisle) => (
        <section key={aisle.aisle} aria-labelledby={`aisle-${aisle.aisle}`}>
          <h2 id={`aisle-${aisle.aisle}`} className="font-bold">
            {aisle.label}
          </h2>
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">{aisle.items.map(itemRow)}</ul>
        </section>
      ))}

      <section aria-labelledby="extras">
        <h2 id="extras" className="font-bold">
          Extra items
        </h2>
        {custom.length > 0 && (
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {custom.map((c) => (
              <li key={c.id} className="flex items-center gap-3 py-2">
                <input
                  type="checkbox"
                  id={`custom-${c.id}`}
                  checked={c.checked}
                  disabled={pending}
                  onChange={() => run(() => setCustomCheckedAction(c.id, !c.checked, scope))}
                  className="h-5 w-5 shrink-0 accent-emerald-700"
                />
                <label htmlFor={`custom-${c.id}`} className={`flex-1 ${c.checked ? "text-zinc-600 line-through dark:text-zinc-400" : ""}`}>
                  {c.label}
                </label>
                <button type="button" disabled={pending} onClick={() => run(() => deleteCustomItemAction(c.id, scope))} className={linkButton}>
                  Remove<span className="sr-only"> {c.label}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={add} className="mt-2 flex gap-2">
          <label htmlFor="new-item" className="sr-only">
            Add an extra item
          </label>
          <input
            id="new-item"
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            maxLength={80}
            placeholder="e.g. dish soap, bananas"
            className="block w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-base focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/30 dark:border-zinc-700"
          />
          <button
            type="submit"
            disabled={pending || newItem.trim() === ""}
            className="shrink-0 rounded-xl bg-emerald-700 px-4 py-2 font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
          >
            Add
          </button>
        </form>
      </section>

      {list.pantry.length > 0 && (
        <section aria-labelledby="pantry" className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <h2 id="pantry" className="font-bold">
            Already at home (pantry)
          </h2>
          <p className="text-xs text-zinc-600 dark:text-zinc-400">Left off every week&apos;s list until you remove them.</p>
          <ul className="mt-2 divide-y divide-zinc-200 dark:divide-zinc-800">
            {list.pantry.map((p) => (
              <li key={p.ingredientId} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span>
                  {p.name} <span className="text-zinc-600 dark:text-zinc-400">· this week needs {formatAmount(p.amount, p.unit)}</span>
                </span>
                <button type="button" disabled={pending} onClick={() => run(() => setPantryAction(p.ingredientId, false))} className={linkButton}>
                  Put back on list<span className="sr-only"> ({p.name})</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
