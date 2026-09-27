// Indian online grocery stores we can link to (CLAUDE.md §17). We only open their search page;
// we never place orders, handle payments or add affiliate tags.
// If a store changes its search URL, fix it here.

export const STORES = [
  { id: "bigbasket", name: "BigBasket", searchUrl: (q: string) => `https://www.bigbasket.com/ps/?q=${q}` },
  { id: "blinkit", name: "Blinkit", searchUrl: (q: string) => `https://blinkit.com/s/?q=${q}` },
  { id: "zepto", name: "Zepto", searchUrl: (q: string) => `https://www.zeptonow.com/search?query=${q}` },
  {
    id: "instamart",
    name: "Swiggy Instamart",
    searchUrl: (q: string) => `https://www.swiggy.com/instamart/search?query=${q}`,
  },
  { id: "amazon", name: "Amazon.in", searchUrl: (q: string) => `https://www.amazon.in/s?k=${q}` },
  { id: "jiomart", name: "JioMart", searchUrl: (q: string) => `https://www.jiomart.com/search/${q}` },
] as const;

export type StoreId = (typeof STORES)[number]["id"];

export const STORE_IDS = STORES.map((s) => s.id) as [StoreId, ...StoreId[]];

export const DEFAULT_STORE: StoreId = "bigbasket";

export function storeName(id: StoreId): string {
  return STORES.find((s) => s.id === id)?.name ?? id;
}

// Search link for an item on the given store. The search term is URL-encoded.
export function storeSearchUrl(id: StoreId, term: string): string {
  const store = STORES.find((s) => s.id === id) ?? STORES[0];
  return store.searchUrl(encodeURIComponent(term.trim()));
}
