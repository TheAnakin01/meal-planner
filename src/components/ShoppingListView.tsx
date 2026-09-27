"use client";

import { type FormEvent, useOptimistic, useState, useTransition } from "react";
import {
  addCustomItemAction,
  deleteCustomItemAction,
  setCheckedAction,
  setCustomCheckedAction,
  setPantryAction,
} from "@/app/shopping/actions";
import type { CustomItem } from "@/lib/shopping-server";
import { type ShoppingItem, type ShoppingList, formatAmount, formatPacks } from "@/lib/shopping";

interface Props {
  list: ShoppingList;
  checkedIds: number[];
  custom: CustomItem[];
}

const linkButton = "text-xs font-semibold text-emerald-700 hover:underline disabled:opacity-50 dark:text-emerald-400";

export default function ShoppingListView({ list, checkedIds, custom }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [newItem, setNewItem] = useState("");
  // Ticks update instantly; the server catches up.
  const [checked, toggleChecked] = useOptimistic(new Set(checkedIds), (set: Set<number>, id: number) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  function run(task: () => Promise<{ ok: true } | { ok: false; error: string }>, optimistic?: () => void) {
    setError("");
    startTransition(async () => {
      optimistic?.();
      const r = await task();
      if (!r.ok) setError(r.error);
    });
  }

  function add(event: FormEvent) {
    event.preventDefault();
    const label = newItem;
    run(async () => {
      const r = await addCustomItemAction(label);
      if (r.ok) setNewItem("");
      return r;
    });
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
          onChange={() =>
            run(
              () => setCheckedAction(item.ingredientId, !isChecked),
              () => toggleChecked(item.ingredientId),
            )
          }
          className="mt-1 h-5 w-5 shrink-0 accent-emerald-700"
        />
        <div className="min-w-0 flex-1">
          <label htmlFor={`item-${item.ingredientId}`} className={`font-medium ${isChecked ? "text-zinc-600 line-through dark:text-zinc-400" : ""}`}>
            {item.name}
          </label>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Need {formatAmount(item.amount, item.unit)} · {formatPacks(item)}
          </p>
        </div>
        <button type="button" disabled={pending} onClick={() => run(() => setPantryAction(item.ingredientId, true))} className={linkButton}>
          Have it<span className="sr-only"> ({item.name}, move to pantry)</span>
        </button>
      </li>
    );
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-zinc-600 dark:text-zinc-400" role="status">
        {total === 0 ? "Nothing to buy yet." : `${done} of ${total} ticked`}
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
                  onChange={() => run(() => setCustomCheckedAction(c.id, !c.checked))}
                  className="h-5 w-5 shrink-0 accent-emerald-700"
                />
                <label htmlFor={`custom-${c.id}`} className={`flex-1 ${c.checked ? "text-zinc-600 line-through dark:text-zinc-400" : ""}`}>
                  {c.label}
                </label>
                <button type="button" disabled={pending} onClick={() => run(() => deleteCustomItemAction(c.id))} className={linkButton}>
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
