"use client";

import { useEffect, useState } from "react";

// Chrome/Edge/Samsung fire this before showing their own install banner.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "install-prompt-dismissed";

function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

// Offers "Install app" on Android/desktop, and "Add to Home Screen" steps on iPhone/iPad.
// Hidden when already installed or after the user dismisses it.
export default function InstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone || readDismissed()) return;

    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent);
    // Browser-only facts are only knowable after mounting, so state is set here on purpose.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isIos) setShowIosHelp(true);
    setHidden(false);

    const onPrompt = (event: Event) => {
      event.preventDefault(); // show our own button instead of the browser's mini-banner
      setInstallEvent(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setHidden(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Private browsing: just hide it for now.
    }
    setHidden(true);
  }

  async function install() {
    if (!installEvent) return;
    await installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    if (outcome === "accepted") setHidden(true);
    setInstallEvent(null);
  }

  if (hidden || (!installEvent && !showIosHelp)) return null;

  return (
    <aside aria-label="Install the app" className="card border-emerald-200 bg-gradient-to-br from-emerald-50 to-white text-sm motion-safe:animate-fade-up dark:border-emerald-900 dark:from-emerald-950 dark:to-zinc-900">
      <p className="font-semibold">Get Meal Planner on your home screen</p>
      {installEvent ? (
        <p className="mt-1">Opens full-screen like a normal app — no app store needed.</p>
      ) : (
        <p className="mt-1">
          In Safari, tap the <strong>Share</strong> button (square with an arrow), then <strong>Add to Home Screen</strong>.
        </p>
      )}
      <div className="mt-3 flex gap-2">
        {installEvent && (
          <button
            type="button"
            onClick={install}
            className="btn btn-primary"
          >
            Install app
          </button>
        )}
        <button
          type="button"
          onClick={dismiss}
          className="btn btn-secondary"
        >
          Not now
        </button>
      </div>
    </aside>
  );
}
