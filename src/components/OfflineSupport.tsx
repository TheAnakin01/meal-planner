"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

// Pages worth having offline even if never opened directly.
const CORE_PAGES = ["/dashboard", "/week", "/shopping"];

// Asks the service worker to save the current page, the core pages and recipes linked from here,
// because moving around with in-app links never loads whole pages the worker could save.
function savePagesForOffline(pathname: string) {
  if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator) || !navigator.onLine) return;
  const recipeLinks = [...document.querySelectorAll<HTMLAnchorElement>('a[href^="/recipes/"]')].map((a) => new URL(a.href).pathname);
  const paths = [pathname, ...CORE_PAGES, ...recipeLinks];
  navigator.serviceWorker.ready
    .then((registration) => registration.active?.postMessage({ type: "cache-pages", paths }))
    .catch(() => {});
}

// Registers the service worker (production only — it would fight with hot reloading in development)
// and shows a banner while the phone has no internet.
export default function OfflineSupport() {
  const [offline, setOffline] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    // Wait a moment so the page (and its recipe links) has rendered and the network is free.
    const timer = setTimeout(() => savePagesForOffline(pathname), 1500);
    return () => clearTimeout(timer);
  }, [pathname]);

  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        // Not fatal: the app just won't work offline.
      });
    }

    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (!offline) return null;
  return (
    <p role="status" className="bg-amber-100 px-4 py-2 text-center text-sm text-amber-950 dark:bg-amber-900 dark:text-amber-50">
      You&apos;re offline — showing your saved copy. Shopping ticks will sync when you&apos;re back online.
    </p>
  );
}
