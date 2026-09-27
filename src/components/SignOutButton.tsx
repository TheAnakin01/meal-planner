"use client";

import { signOut } from "@/app/login/actions";
import { browserStorage, clearOutbox } from "@/lib/outbox";

// Before signing out, forget everything saved on this phone for offline use,
// so the next person using the device can't see this user's plan.
async function forgetOfflineData() {
  clearOutbox(browserStorage());
  try {
    navigator.serviceWorker?.controller?.postMessage("clear-pages");
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith("pages-")).map((k) => caches.delete(k)));
  } catch {
    // No service worker / cache storage: nothing saved.
  }
}

export default function SignOutButton({ className }: { className?: string }) {
  return (
    <form
      action={async () => {
        await forgetOfflineData();
        await signOut();
      }}
    >
      <button
        type="submit"
        className={
          className ??
          "rounded-lg border border-zinc-300 px-2 py-2 text-sm font-medium hover:bg-zinc-100 sm:px-3 dark:border-zinc-700 dark:hover:bg-zinc-800"
        }
      >
        Sign out
      </button>
    </form>
  );
}
