"use client";

import { useEffect, useState, useTransition } from "react";
import {
  removeSubscriptionAction,
  saveReminderSettingsAction,
  saveSubscriptionAction,
  sendTestReminderAction,
} from "@/app/profile/reminder-actions";
import { type ReminderSettings as Settings, urlBase64ToUint8Array } from "@/lib/reminders";

type Support = "checking" | "ok" | "unsupported" | "needs-install" | "blocked";

export default function ReminderSettings({ initial }: { initial: Settings }) {
  const [pending, startTransition] = useTransition();
  const [support, setSupport] = useState<Support>("checking");
  const [settings, setSettings] = useState(initial);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    // Only knowable in the browser. iPhones need the app installed to the home screen first.
    const standalone = window.matchMedia("(display-mode: standalone)").matches;
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    let next: Support = "ok";
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      next = isIos && !standalone ? "needs-install" : "unsupported";
    } else if (Notification.permission === "denied") {
      next = "blocked";
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupport(next);
  }, []);

  function run(task: () => Promise<{ ok: true } | { ok: false; error: string }>, success: string) {
    setMessage(null);
    startTransition(async () => {
      try {
        const r = await task();
        setMessage(r.ok ? { tone: "ok", text: success } : { tone: "error", text: r.error });
      } catch {
        setMessage({ tone: "error", text: navigator.onLine ? "Something went wrong. Please try again." : "You're offline — this needs internet." });
      }
    });
  }

  async function turnOn(): Promise<{ ok: true } | { ok: false; error: string }> {
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!publicKey) return { ok: false, error: "Reminders aren't set up yet (missing key)." };
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setSupport(permission === "denied" ? "blocked" : "ok");
      return { ok: false, error: "Notifications weren't allowed." };
    }
    const registration = await navigator.serviceWorker.ready;
    const subscription =
      (await registration.pushManager.getSubscription()) ??
      (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) }));
    const saved = await saveSubscriptionAction(subscription.toJSON());
    if (!saved.ok) return saved;
    const next = { ...settings, enabled: true };
    setSettings(next);
    return saveReminderSettingsAction(next);
  }

  async function turnOff(): Promise<{ ok: true } | { ok: false; error: string }> {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await removeSubscriptionAction(subscription.endpoint);
      await subscription.unsubscribe();
    }
    const next = { ...settings, enabled: false };
    setSettings(next);
    return saveReminderSettingsAction(next);
  }

  const timeInput = (key: "breakfast" | "lunch" | "dinner", label: string) => (
    <label className="block text-sm font-medium">
      {label}
      <input
        type="time"
        value={settings[key]}
        max="23:30"
        onChange={(e) => setSettings({ ...settings, [key]: e.target.value })}
        className="mt-1 block w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-base dark:border-zinc-700"
      />
    </label>
  );

  return (
    <section aria-labelledby="reminders" className="space-y-4 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <div>
        <h2 id="reminders" className="text-lg font-bold">
          Meal reminders
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">A notification at meal times with what&apos;s on your plan.</p>
      </div>

      {support === "needs-install" && (
        <p className="text-sm">On iPhone, first add Meal Planner to your home screen (Share → Add to Home Screen), then open it from there.</p>
      )}
      {support === "unsupported" && <p className="text-sm">This browser can&apos;t show reminders. Try Chrome on Android, or the installed app.</p>}
      {support === "blocked" && (
        <p className="text-sm">
          Notifications are blocked for this site. Allow them in your phone&apos;s settings (Apps → Meal Planner / Chrome → Notifications), then
          reload this page.
        </p>
      )}

      {support === "ok" && (
        <>
          <div className="grid grid-cols-3 gap-3">
            {timeInput("breakfast", "Breakfast")}
            {timeInput("lunch", "Lunch")}
            {timeInput("dinner", "Dinner")}
          </div>
          <div className="flex flex-wrap gap-2">
            {settings.enabled ? (
              <>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => saveReminderSettingsAction(settings), "Reminder times saved.")}
                  className="rounded-xl bg-emerald-700 px-4 py-2 font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
                >
                  Save times
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => sendTestReminderAction(), "Test sent — check your notifications.")}
                  className="rounded-xl border border-zinc-300 px-4 py-2 font-semibold hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-800"
                >
                  Send a test
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(turnOff, "Reminders turned off on this phone.")}
                  className="rounded-xl border border-zinc-300 px-4 py-2 font-semibold hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-800"
                >
                  Turn off
                </button>
              </>
            ) : (
              <button
                type="button"
                disabled={pending}
                onClick={() => run(turnOn, "Reminders are on for this phone.")}
                className="rounded-xl bg-emerald-700 px-4 py-2 font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
              >
                Turn on reminders
              </button>
            )}
          </div>
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            Reminders may arrive up to 15 minutes after the time you choose. Times use your phone&apos;s timezone.
          </p>
        </>
      )}

      {message && (
        <p role={message.tone === "error" ? "alert" : "status"} className={`text-sm ${message.tone === "error" ? "text-red-700 dark:text-red-400" : "text-emerald-800 dark:text-emerald-300"}`}>
          {message.text}
        </p>
      )}
    </section>
  );
}
