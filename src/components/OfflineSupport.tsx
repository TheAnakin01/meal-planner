"use client";

import { useEffect, useState } from "react";

// Registers the service worker (production only — it would fight with hot reloading in development)
// and shows a banner while the phone has no internet.
export default function OfflineSupport() {
  const [offline, setOffline] = useState(false);

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
