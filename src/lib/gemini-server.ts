// Calls the Google Gemini API (free tier). Server-only: the key must never reach the browser.
// See CLAUDE.md §14 and §18. Free-tier content may be used by Google to improve its products, so
// callers must send only what's needed — never user names, emails or ids.

import "server-only";

// Tried in order. Free-tier requests are deprioritised when Google is busy (HTTP 503), so fall back to
// an older model rather than failing. Checked 2026-09-27: 3.8 Flash was often "high demand", 3.5 Flash
// answered (~25 s), 2.5 Flash is retired for new users. Update this list when models change.
export const GEMINI_MODELS = ["gemini-3.8-flash", "gemini-3.5-flash", "gemini-3.7-flash", "gemini-3.5-flash-lite"];

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export type GeminiError =
  | "not_configured" // no key
  | "unauthorized" // key rejected
  | "rate_limited" // free-tier per-minute/per-day limit reached (429)
  | "busy" // every model overloaded (503)
  | "blocked" // safety filters stopped the answer
  | "rejected" // Gemini said our request was invalid (400)
  | "bad_output" // answer was empty or not the JSON we asked for
  | "unavailable"; // network problem

export interface ChatTurn {
  role: "user" | "model";
  text: string;
}

type TextResult = { ok: true; text: string; model: string } | { ok: false; error: GeminiError };

// One generateContent call with model fallback. Returns the answer's text.
async function callGemini(systemInstruction: string, turns: ChatTurn[], generationConfig: object): Promise<TextResult> {
  const apiKey = process.env.GEMINI_API_KEY?.trim().replace(/^["']|["']$/g, "");
  if (!apiKey) return { ok: false, error: "not_configured" };

  let lastError: GeminiError = "busy";
  for (const model of GEMINI_MODELS) {
    let response: Response;
    try {
      response = await fetch(`${API_BASE}/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemInstruction }] },
          contents: turns.map((t) => ({ role: t.role, parts: [{ text: t.text }] })),
          generationConfig,
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(90_000),
      });
    } catch {
      lastError = "unavailable";
      continue;
    }

    if (response.status === 503 || response.status === 404 || response.status === 500) {
      // Overloaded, retired or temporarily broken: try the next model.
      lastError = "busy";
      continue;
    }
    if (response.status === 429) return { ok: false, error: "rate_limited" };
    if (response.status === 401 || response.status === 403) return { ok: false, error: "unauthorized" };
    if (response.status === 400) {
      // An invalid key also comes back as 400 ("API key not valid"); anything else is our request's fault.
      const detail = await response.text().catch(() => "");
      console.error(`Gemini ${model} rejected the request: HTTP 400`);
      return { ok: false, error: /api key/i.test(detail) ? "unauthorized" : "rejected" };
    }
    if (!response.ok) {
      lastError = "unavailable";
      continue;
    }

    const body = (await response.json().catch(() => null)) as {
      candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[];
      promptFeedback?: { blockReason?: string };
    } | null;
    if (!body) return { ok: false, error: "bad_output" };
    if (body.promptFeedback?.blockReason || body.candidates?.[0]?.finishReason === "SAFETY") {
      return { ok: false, error: "blocked" };
    }
    const text = (body.candidates?.[0]?.content?.parts ?? [])
      .filter((p) => !p.thought)
      .map((p) => p.text ?? "")
      .join("")
      .trim();
    if (!text) return { ok: false, error: "bad_output" };
    return { ok: true, text, model };
  }
  return { ok: false, error: lastError };
}

export type GeminiResult = { ok: true; json: unknown; model: string } | { ok: false; error: GeminiError };

interface JsonRequest {
  systemInstruction: string;
  prompt: string;
  jsonSchema: object;
}

// Asks Gemini for JSON matching `jsonSchema`. The caller must still validate the result (e.g. with zod).
export async function generateJson({ systemInstruction, prompt, jsonSchema }: JsonRequest): Promise<GeminiResult> {
  const result = await callGemini(systemInstruction, [{ role: "user", text: prompt }], {
    responseMimeType: "application/json",
    responseJsonSchema: jsonSchema,
  });
  if (!result.ok) return result;
  try {
    return { ok: true, json: JSON.parse(result.text), model: result.model };
  } catch {
    return { ok: false, error: "bad_output" };
  }
}

// A plain-text chat reply given the conversation so far (last turn must be the user's).
export async function generateChatReply(systemInstruction: string, turns: ChatTurn[]): Promise<TextResult> {
  return callGemini(systemInstruction, turns, { temperature: 0.6 });
}
