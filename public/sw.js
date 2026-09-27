// Meal Planner service worker (CLAUDE.md §19): lets the installed app open offline.
//
// What is saved on the phone:
//   - the app's own files (/_next/static, icons, manifest)                      → cache-first
//   - YOUR pages once visited: Today, Week, Shopping list, recipes, profile      → network-first
// Never saved: other websites (Spoonacular images, Supabase, stores), /discover (Spoonacular data may
// not be stored), admin pages, form submissions. Signing out deletes the saved pages.
/* global self, caches, URL, Response */

const VERSION = "v2";
const STATIC_CACHE = `static-${VERSION}`;
const PAGE_CACHE = `pages-${VERSION}`;
const OFFLINE_URL = "/offline";

// App files only. The offline page is kept with the personal pages (its header can show the user's
// email), so signing out removes it too; it's re-saved on the next online visit.
const PRECACHE = ["/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];
const OFFLINE_PAGES = [/^\/dashboard$/, /^\/week$/, /^\/shopping$/, /^\/recipes\/\d+$/, /^\/profile$/];

self.addEventListener("install", (event) => {
  event.waitUntil(Promise.all([caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE)), saveOfflinePage()]));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== STATIC_CACHE && k !== PAGE_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// In-app navigation doesn't load whole pages, so the app tells us which pages to save:
// { type: "cache-pages", paths: [...] }. Only our own savable pages are fetched, at most once a minute each.
const lastSaved = new Map();
const SAVE_EVERY_MS = 60_000;

async function savePage(path) {
  if (!OFFLINE_PAGES.some((pattern) => pattern.test(path))) return;
  const now = Date.now();
  if (now - (lastSaved.get(path) ?? 0) < SAVE_EVERY_MS) return;
  lastSaved.set(path, now);
  try {
    const response = await fetch(path, { credentials: "same-origin" });
    if (response.ok && !response.redirected && response.type === "basic") {
      const cache = await caches.open(PAGE_CACHE);
      await cache.put(path, response);
    }
  } catch {
    lastSaved.delete(path); // offline: try again next time
  }
}

self.addEventListener("message", (event) => {
  // The app asks us to forget saved pages when the user signs out.
  if (event.data === "clear-pages") {
    lastSaved.clear();
    event.waitUntil(caches.delete(PAGE_CACHE));
    return;
  }
  const paths = event.data && event.data.type === "cache-pages" && Array.isArray(event.data.paths) ? event.data.paths : [];
  const unique = [...new Set(paths.filter((p) => typeof p === "string"))].slice(0, 40);
  event.waitUntil(Promise.all([...unique.map(savePage), saveOfflinePage()]));
});

async function saveOfflinePage() {
  try {
    const cache = await caches.open(PAGE_CACHE);
    if (await cache.match(OFFLINE_URL)) return;
    const response = await fetch(OFFLINE_URL);
    if (response.ok) await cache.put(OFFLINE_URL, response);
  } catch {
    // Offline right now: try again after the next successful page load.
  }
}

function isStaticAsset(url) {
  return url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") || url.pathname === "/icon.png";
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(STATIC_CACHE);
    cache.put(request, response.clone());
  }
  return response;
}

async function pageNetworkFirst(request, url) {
  try {
    const response = await fetch(request);
    // Don't save redirects (e.g. to /login) or errors.
    if (response.ok && !response.redirected && response.type === "basic") {
      const cache = await caches.open(PAGE_CACHE);
      cache.put(url.pathname, response.clone()); // one copy per page, ignoring ?portion=…
      saveOfflinePage(); // put it back if sign-out removed it
    }
    return response;
  } catch {
    const cached = await caches.match(url.pathname, { cacheName: PAGE_CACHE });
    return cached || (await caches.match(OFFLINE_URL)) || new Response("Offline", { status: 503 });
  }
}

async function networkOrOfflinePage(request) {
  try {
    return await fetch(request);
  } catch {
    return (await caches.match(OFFLINE_URL)) || new Response("Offline", { status: 503 });
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return; // form posts / server actions: always live
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // never touch other websites

  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request));
    return;
  }
  if (request.mode === "navigate") {
    const savable = OFFLINE_PAGES.some((pattern) => pattern.test(url.pathname));
    event.respondWith(savable ? pageNetworkFirst(request, url) : networkOrOfflinePage(request));
  }
  // Everything else (page data for in-app navigation, etc.) goes to the network as normal.
});
