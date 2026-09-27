// Tests public/sw.js by running it in a sandbox with fake browser APIs (no real browser needed).
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { beforeEach, describe, expect, it } from "vitest";

const ORIGIN = "https://meal-planner.example";

interface FakeResponse {
  ok: boolean;
  status: number;
  redirected: boolean;
  type: string;
  body: string;
  clone(): FakeResponse;
}
const response = (body: string, extra: Partial<FakeResponse> = {}): FakeResponse => {
  const r: FakeResponse = { ok: true, status: 200, redirected: false, type: "basic", body, clone: () => ({ ...r }), ...extra };
  return r;
};
const keyOf = (req: string | { url: string }) => new URL(typeof req === "string" ? req : req.url, ORIGIN).href;

class FakeCache {
  store = new Map<string, FakeResponse>();
  constructor(private readonly fetcher: (req: string) => Promise<FakeResponse>) {}
  async match(req: string | { url: string }) {
    return this.store.get(keyOf(req));
  }
  async put(req: string | { url: string }, res: FakeResponse) {
    this.store.set(keyOf(req), res);
  }
  async addAll(urls: string[]) {
    for (const u of urls) this.store.set(keyOf(u), await this.fetcher(u));
  }
}

function setup() {
  let online = true;
  const server = new Map<string, FakeResponse>();
  const fetched: string[] = [];
  const fetcher = async (req: string | { url: string }) => {
    const url = keyOf(req);
    fetched.push(new URL(url).pathname);
    if (!online) throw new TypeError("Failed to fetch");
    return server.get(url) ?? response("not found", { ok: false, status: 404 });
  };
  const cacheMap = new Map<string, FakeCache>();
  const caches = {
    async open(name: string) {
      if (!cacheMap.has(name)) cacheMap.set(name, new FakeCache(fetcher));
      return cacheMap.get(name)!;
    },
    async match(req: string | { url: string }, opts?: { cacheName?: string }) {
      const names = opts?.cacheName ? [opts.cacheName] : [...cacheMap.keys()];
      for (const n of names) {
        const hit = await cacheMap.get(n)?.match(req);
        if (hit) return hit;
      }
      return undefined;
    },
    async keys() {
      return [...cacheMap.keys()];
    },
    async delete(name: string) {
      return cacheMap.delete(name);
    },
  };
  const handlers: Record<string, (event: unknown) => void> = {};
  const self = {
    location: { origin: ORIGIN },
    addEventListener: (type: string, fn: (event: unknown) => void) => (handlers[type] = fn),
    skipWaiting: () => undefined,
    clients: { claim: async () => undefined },
  };
  runInNewContext(readFileSync("public/sw.js", "utf8"), {
    self,
    caches,
    fetch: fetcher,
    URL,
    Response: class {
      constructor(
        public body: string,
        public init: { status: number },
      ) {}
    },
    console,
  });

  async function dispatch(type: string, data: Record<string, unknown>) {
    let waited: Promise<unknown> | undefined;
    let responded: Promise<FakeResponse> | undefined;
    handlers[type]({ ...data, waitUntil: (p: Promise<unknown>) => (waited = p), respondWith: (p: Promise<FakeResponse>) => (responded = p) });
    await waited;
    return responded ? await responded : undefined; // undefined = browser handles it normally
  }
  const get = (path: string, mode = "navigate") => dispatch("fetch", { request: { method: "GET", url: keyOf(path), mode } });

  return {
    server,
    fetched,
    cacheMap,
    get,
    dispatch,
    setOnline: (value: boolean) => (online = value),
    install: () => dispatch("install", {}),
  };
}

let sw: ReturnType<typeof setup>;
beforeEach(async () => {
  sw = setup();
  for (const p of ["/offline", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png", "/dashboard", "/week", "/discover", "/admin", "/_next/static/app.js"]) {
    sw.server.set(keyOf(p), response(`content of ${p}`));
  }
  await sw.install();
});

describe("service worker", () => {
  it("saves app files on install, and the offline page with the personal pages", () => {
    expect([...sw.cacheMap.get("static-v1")!.store.keys()].map((k) => new URL(k).pathname)).toEqual([
      "/manifest.webmanifest",
      "/icons/icon-192.png",
      "/icons/icon-512.png",
    ]);
    expect(sw.cacheMap.get("pages-v1")!.store.has(keyOf("/offline"))).toBe(true);
  });

  it("serves your saved pages when offline", async () => {
    expect((await sw.get("/week"))?.body).toBe("content of /week"); // online visit saves it
    sw.setOnline(false);
    expect((await sw.get("/week"))?.body).toBe("content of /week");
    expect((await sw.get("/week?portion=1.5"))?.body).toBe("content of /week");
  });

  it("shows the offline page for pages never visited", async () => {
    sw.setOnline(false);
    expect((await sw.get("/shopping"))?.body).toBe("content of /offline");
  });

  it("never saves Discover (Spoonacular data) or admin pages", async () => {
    await sw.get("/discover");
    await sw.get("/admin");
    const pages = [...sw.cacheMap.get("pages-v1")!.store.keys()].map((k) => new URL(k).pathname);
    expect(pages).not.toContain("/discover");
    expect(pages).not.toContain("/admin");
    sw.setOnline(false);
    expect((await sw.get("/discover"))?.body).toBe("content of /offline");
  });

  it("doesn't save redirects (e.g. to the login page) or errors", async () => {
    sw.server.set(keyOf("/dashboard"), response("login page", { redirected: true }));
    await sw.get("/dashboard");
    expect(sw.cacheMap.get("pages-v1")!.store.has(keyOf("/dashboard"))).toBe(false);
  });

  it("leaves other websites, form posts and page data alone", async () => {
    expect(await sw.dispatch("fetch", { request: { method: "GET", url: "https://img.spoonacular.com/x.jpg", mode: "no-cors" } })).toBeUndefined();
    expect(await sw.dispatch("fetch", { request: { method: "POST", url: keyOf("/week"), mode: "cors" } })).toBeUndefined();
    expect(await sw.get("/week?_rsc=abc", "cors")).toBeUndefined();
  });

  it("serves app files from the cache after the first download", async () => {
    await sw.get("/_next/static/app.js", "no-cors");
    sw.setOnline(false);
    expect((await sw.get("/_next/static/app.js", "no-cors"))?.body).toBe("content of /_next/static/app.js");
  });

  it("forgets personal pages (incl. the offline page) when asked at sign-out", async () => {
    await sw.get("/week");
    await sw.dispatch("message", { data: "clear-pages" });
    expect(sw.cacheMap.has("pages-v1")).toBe(false);
    expect(sw.cacheMap.has("static-v1")).toBe(true);
  });
});
