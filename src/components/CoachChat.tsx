"use client";

import { type FormEvent, useEffect, useRef, useState, useTransition } from "react";
import { askCoachAction, clearCoachHistoryAction, resolveCoachActionAction, setCoachEnabledAction } from "@/app/coach/actions";
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

const primaryButton = "btn btn-primary";
const secondaryButton = "btn btn-secondary py-2";

export default function CoachChat({ enabled, messages, remaining: initialRemaining }: Props) {
  const [pending, startTransition] = useTransition();
  // The chat keeps its own copy: new messages come back from the server action directly,
  // without reloading the page (which used to fail after the slow AI call).
  const [items, setItems] = useState(messages);
  const [remaining, setRemaining] = useState(initialRemaining);
  const [error, setError] = useState("");
  const [question, setQuestion] = useState("");
  const [asked, setAsked] = useState<string | null>(null); // shown while waiting for the reply
  const [agreed, setAgreed] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => endRef.current?.scrollIntoView({ block: "end" }), [items.length, asked]);

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
    run(async () => {
      const r = await askCoachAction(q);
      setItems((current) => [...current, ...r.added]);
      if (r.added.some((m) => m.role === "user")) setRemaining((n) => Math.max(0, n - 1));
      return r;
    });
  }

  function resolve(id: number, confirm: boolean) {
    run(async () => {
      const r = await resolveCoachActionAction(id, confirm);
      if (r.ok) {
        setItems((current) => current.map((m) => (m.id === id ? { ...m, actionStatus: r.status, actionResult: r.result } : m)));
      }
      return r;
    });
  }

  if (!enabled) {
    return (
      <section aria-labelledby="coach-notice" className="card space-y-4">
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
        {items.length === 0 && !asked && (
          <div className="card border-dashed text-sm">
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
        {items.map((m) =>
          m.action ? (
            <ActionCard key={m.id} message={m} pending={pending} onResolve={(confirm) => resolve(m.id, confirm)} />
          ) : (
            <Bubble key={m.id} role={m.role} text={m.content} />
          ),
        )}
        {asked && (
          <>
            <Bubble role="user" text={asked} />
            <div role="status" className="flex items-center gap-3 text-sm muted motion-safe:animate-fade-up">
              <span className="flex gap-1 rounded-2xl rounded-bl-md border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900" aria-hidden="true">
                <span className="h-2 w-2 rounded-full bg-zinc-400 motion-safe:animate-bounce" />
                <span className="h-2 w-2 rounded-full bg-zinc-400 motion-safe:animate-bounce [animation-delay:150ms]" />
                <span className="h-2 w-2 rounded-full bg-zinc-400 motion-safe:animate-bounce [animation-delay:300ms]" />
              </span>
              Coach is thinking… (can take up to a minute)
            </div>
          </>
        )}
        <div ref={endRef} />
      </div>

      {error && (
        <p role="alert" className="rounded-2xl bg-red-50 p-3 text-sm text-red-700 motion-safe:animate-fade-up dark:bg-red-950 dark:text-red-300">
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
          className="input"
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="chip">{remaining} questions left today</span>
          <button type="submit" disabled={pending || question.trim() === "" || remaining <= 0} className={primaryButton}>
            Ask
          </button>
        </div>
      </form>

      <div className="flex flex-wrap gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
        <button
          type="button"
          disabled={pending || items.length === 0}
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

function ActionCard({
  message,
  pending,
  onResolve,
}: {
  message: CoachMessage;
  pending: boolean;
  onResolve: (confirm: boolean) => void;
}) {
  return (
    <div className="max-w-[85%] rounded-3xl rounded-bl-md border border-emerald-600/40 bg-gradient-to-br from-emerald-50 to-white px-4 py-3 text-sm text-zinc-900 shadow-sm motion-safe:animate-fade-up dark:from-emerald-950 dark:to-zinc-900 dark:text-zinc-100">
      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-300">Coach suggests</p>
      <p className="mt-1">{message.content}</p>
      {message.actionStatus === "proposed" ? (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => onResolve(true)}
            className="btn btn-primary px-4 py-1.5"
          >
            Confirm
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => onResolve(false)}
            className="btn btn-secondary px-4 py-1.5"
          >
            Cancel
          </button>
        </div>
      ) : (
        <p className="mt-2 font-medium">
          {message.actionStatus === "done" ? `✓ ${message.actionResult ?? "Done."}` : "Cancelled."}
        </p>
      )}
    </div>
  );
}

function Bubble({ role, text }: { role: "user" | "model"; text: string }) {
  const mine = role === "user";
  return (
    <div className={`flex motion-safe:animate-fade-up ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] whitespace-pre-wrap rounded-3xl px-4 py-2.5 text-sm shadow-sm ${
          mine
            ? "rounded-br-md bg-emerald-700 text-white"
            : "rounded-bl-md border border-zinc-200 bg-white text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
        }`}
      >
        <span className="sr-only">{mine ? "You: " : "Coach: "}</span>
        {text}
      </div>
    </div>
  );
}
