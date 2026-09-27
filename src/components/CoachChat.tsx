"use client";

import { type FormEvent, useEffect, useRef, useState, useTransition } from "react";
import { askCoachAction, clearCoachHistoryAction, setCoachEnabledAction } from "@/app/coach/actions";
import type { CoachMessage } from "@/lib/coach-server";

const SUGGESTIONS = [
  "Is today's plan enough protein for me?",
  "What's a quick high-protein breakfast I can eat?",
  "How can I reduce oil in Indian cooking?",
];

interface Props {
  enabled: boolean;
  messages: CoachMessage[];
  remaining: number;
}

const primaryButton =
  "rounded-xl bg-emerald-700 px-4 py-2 font-semibold text-white hover:bg-emerald-800 disabled:opacity-60";
const secondaryButton =
  "rounded-xl border border-zinc-300 px-4 py-2 text-sm font-semibold hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-800";

export default function CoachChat({ enabled, messages, remaining }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [question, setQuestion] = useState("");
  const [asked, setAsked] = useState<string | null>(null); // shown while waiting for the reply
  const [agreed, setAgreed] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => endRef.current?.scrollIntoView({ block: "end" }), [messages.length, asked]);

  function run(task: () => Promise<{ ok: true } | { ok: false; error: string }>, after?: () => void) {
    setError("");
    if (!navigator.onLine) {
      setError("You're offline — the coach needs internet.");
      return;
    }
    startTransition(async () => {
      try {
        const r = await task();
        if (!r.ok) setError(r.error);
        else after?.();
      } catch {
        setError("Something went wrong. Please try again.");
      } finally {
        setAsked(null);
      }
    });
  }

  function ask(text: string) {
    const q = text.trim();
    if (!q) return;
    setAsked(q);
    setQuestion("");
    run(() => askCoachAction(q));
  }

  if (!enabled) {
    return (
      <section aria-labelledby="coach-notice" className="space-y-4 rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
        <h2 id="coach-notice" className="text-xl font-bold">
          Before you start
        </h2>
        <ul className="list-disc space-y-2 pl-5 text-sm">
          <li>
            The coach uses <strong>Google Gemini&apos;s free AI service</strong>. Google may use what you send to improve its
            products.
          </li>
          <li>
            We send only your age range, goal, activity level, calorie targets, diet type, allergies and this week&apos;s meal
            names — <strong>never your name, email, weight or height</strong>.
          </li>
          <li>Don&apos;t type names, phone numbers, addresses or medical records into the chat.</li>
          <li>
            The coach is <strong>not a doctor</strong> and can make mistakes. Always check food labels for allergens.
          </li>
          <li>Chats are kept for 30 days, and you can delete them any time.</li>
        </ul>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 h-5 w-5 accent-emerald-700" />
          I understand and want to use the AI coach.
        </label>
        {error && (
          <p role="alert" className="text-sm text-red-700 dark:text-red-400">
            {error}
          </p>
        )}
        <button type="button" disabled={!agreed || pending} onClick={() => run(() => setCoachEnabledAction(true))} className={primaryButton}>
          Turn on the coach
        </button>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3" aria-live="polite">
        {messages.length === 0 && !asked && (
          <div className="rounded-xl border border-dashed border-zinc-300 p-4 text-sm dark:border-zinc-700">
            <p>Ask about your plan, protein, portions or cooking. Try:</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" onClick={() => ask(s)} disabled={pending} className={secondaryButton}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m) => (
          <Bubble key={m.id} role={m.role} text={m.content} />
        ))}
        {asked && (
          <>
            <Bubble role="user" text={asked} />
            <p role="status" className="text-sm text-zinc-600 dark:text-zinc-400">
              Coach is thinking… (the free service can take up to a minute)
            </p>
          </>
        )}
        <div ref={endRef} />
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          ask(question);
        }}
        className="space-y-2"
      >
        <label htmlFor="coach-question" className="sr-only">
          Your question
        </label>
        <textarea
          id="coach-question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              ask(question);
            }
          }}
          rows={2}
          maxLength={1000}
          placeholder="Ask your coach…"
          className="block w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-base focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/30 dark:border-zinc-700"
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-zinc-600 dark:text-zinc-400">{remaining} questions left today</span>
          <button type="submit" disabled={pending || question.trim() === "" || remaining <= 0} className={primaryButton}>
            Ask
          </button>
        </div>
      </form>

      <div className="flex flex-wrap gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
        <button
          type="button"
          disabled={pending || messages.length === 0}
          onClick={() => window.confirm("Delete your whole chat with the coach?") && run(() => clearCoachHistoryAction())}
          className={secondaryButton}
        >
          Delete chat history
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => window.confirm("Turn off the coach and delete your chat?") && run(() => setCoachEnabledAction(false, true))}
          className={secondaryButton}
        >
          Turn off coach
        </button>
      </div>
    </div>
  );
}

function Bubble({ role, text }: { role: "user" | "model"; text: string }) {
  const mine = role === "user";
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm ${
          mine ? "bg-emerald-700 text-white" : "border border-zinc-200 bg-white text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
        }`}
      >
        <span className="sr-only">{mine ? "You: " : "Coach: "}</span>
        {text}
      </div>
    </div>
  );
}
