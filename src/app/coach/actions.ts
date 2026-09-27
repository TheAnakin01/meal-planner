"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  COACH_LIMITS,
  type WeekMealSummary,
  allergyWarning,
  buildCoachContext,
  calorieFloorFor,
  coachSystemInstruction,
  trimReply,
} from "@/lib/coach";
import { COACH_TOOLS, DAY_NAMES, coachActionSchema, describeAction, parseFunctionCalls, shoppingItemWarning } from "@/lib/coach-actions";
import { type CoachMessage, coachAllowance, coachContext, getCoachHistory, isCoachEnabled, pruneOldMessages } from "@/lib/coach-server";
import { addCustomItemAction } from "@/app/shopping/actions";
import { swapMealAction } from "@/app/week/actions";
import { type GeminiError, generateChatReply } from "@/lib/gemini-server";
import { MEALS, dayIndex } from "@/lib/planner";
import { getOrCreateWeekPlan } from "@/lib/plan-server";
import { getCurrentProfile } from "@/lib/profile-server";

type Result = { ok: true } | { ok: false; error: string };

const GEMINI_MESSAGES: Record<GeminiError, string> = {
  not_configured: "The coach isn't set up yet.",
  unauthorized: "The coach isn't available right now (the site owner needs to check the AI key).",
  rate_limited: "The free AI service is busy for now. Please try again in a minute.",
  busy: "The free AI service is busy right now. Please try again in a minute.",
  blocked: "The coach couldn't answer that. Try asking in a different way.",
  rejected: "The coach couldn't answer that. Please try again.",
  bad_output: "The coach didn't give an answer. Please try again.",
  unavailable: "Couldn't reach the coach. Please try again.",
};

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function done(): Result {
  revalidatePath("/coach");
  return { ok: true };
}

export async function setCoachEnabledAction(enabled: unknown, deleteHistory: unknown = false): Promise<Result> {
  const on = z.boolean().safeParse(enabled);
  const wipe = z.boolean().safeParse(deleteHistory);
  if (!on.success || !wipe.success) return { ok: false, error: "Invalid setting." };
  const { supabase, userId } = await coachContext();
  if (!userId) return { ok: false, error: "Please sign in again." };

  const { error } = await supabase.from("profiles").update({ coach_enabled: on.data }).eq("id", userId);
  if (error) return { ok: false, error: "Couldn't save the setting." };
  if (wipe.data) await supabase.from("coach_messages").delete().eq("user_id", userId);
  return done();
}

export async function clearCoachHistoryAction(): Promise<Result> {
  const { supabase, userId } = await coachContext();
  if (!userId) return { ok: false, error: "Please sign in again." };
  const { error } = await supabase.from("coach_messages").delete().eq("user_id", userId);
  if (error) return { ok: false, error: "Couldn't delete the chat. Please try again." };
  return done();
}

export async function askCoachAction(question: unknown): Promise<Result> {
  const parsed = z
    .string()
    .trim()
    .min(1, "Type a question first.")
    .max(COACH_LIMITS.maxQuestionChars, `Please keep questions under ${COACH_LIMITS.maxQuestionChars} characters.`)
    .safeParse(question);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Please fill in your details first." };
  if (!(await isCoachEnabled())) return { ok: false, error: "Turn the coach on first." };

  const allowance = await coachAllowance();
  if (allowance.remaining <= 0) {
    return { ok: false, error: `You've asked ${COACH_LIMITS.perUserPer24h} questions in the last 24 hours. Please try again later.` };
  }
  if (allowance.everyoneLimitReached) {
    return { ok: false, error: "The coach has reached today's free limit for everyone. Please try again tomorrow." };
  }

  await pruneOldMessages();
  const [plan, history] = await Promise.all([getOrCreateWeekPlan(profile), getCoachHistory(COACH_LIMITS.historyTurnsSent)]);

  const titles = new Map(plan.recipes.map((r) => [r.id, r.title]));
  const week: WeekMealSummary[] = plan.slots
    .filter((s) => titles.has(s.recipeId))
    .sort((a, b) => a.day - b.day || MEALS.indexOf(a.meal) - MEALS.indexOf(b.meal))
    .map((s) => ({ dayLabel: DAY_LABELS[s.day], meal: s.meal, title: titles.get(s.recipeId)! }));
  const todayLabel = DAY_LABELS[dayIndex(new Date(), profile.timezone)];

  const system = coachSystemInstruction(
    buildCoachContext(profile, plan.targets, week, todayLabel),
    profile.dietType,
    calorieFloorFor(profile.gender),
  );
  const turns = [...history.map((m) => ({ role: m.role, text: historyText(m) })), { role: "user" as const, text: parsed.data }];

  const { supabase, userId } = await coachContext();
  if (!userId) return { ok: false, error: "Please sign in again." };

  // Save the question first so it counts towards the limits even if the AI call fails.
  const { error: saveError } = await supabase.from("coach_messages").insert({ user_id: userId, role: "user", content: parsed.data });
  if (saveError) return { ok: false, error: "Couldn't send your question. Please try again." };

  const reply = await generateChatReply(system, turns, COACH_TOOLS);
  if (!reply.ok) {
    revalidatePath("/coach");
    return { ok: false, error: GEMINI_MESSAGES[reply.error] };
  }

  const actions = parseFunctionCalls(reply.functionCalls);
  if (reply.text) {
    const warning = allergyWarning(reply.text, profile.allergies, profile.otherAllergies);
    const content = trimReply(warning ? `${reply.text}\n\n${warning}` : reply.text);
    await supabase.from("coach_messages").insert({ user_id: userId, role: "model", content });
  }
  // Each proposed action becomes its own card with Confirm / Cancel. Nothing changes until the user confirms.
  for (const action of actions) {
    const warning = action.type === "add_to_shopping_list" ? shoppingItemWarning(action.item, profile.allergies, profile.otherAllergies) : null;
    await supabase.from("coach_messages").insert({
      user_id: userId,
      role: "model",
      content: warning ? `${describeAction(action)}. ⚠️ ${warning}` : `${describeAction(action)}?`,
      action,
      action_status: "proposed",
    });
  }
  if (!reply.text && actions.length === 0) return { ok: false, error: GEMINI_MESSAGES.bad_output };
  return done();
}

// What the model sees for earlier messages, including what happened to proposed actions.
function historyText(m: CoachMessage): string {
  if (!m.action || !m.actionStatus) return m.content;
  const outcome = m.actionStatus === "proposed" ? "waiting for the user" : m.actionStatus;
  return `[Proposed action: ${describeAction(m.action)} — ${outcome}${m.actionResult ? `: ${m.actionResult}` : ""}]`;
}

// The user confirms or cancels an action the coach proposed. Runs the app's normal, safety-checked code.
export async function resolveCoachActionAction(messageId: unknown, confirm: unknown): Promise<Result> {
  const id = z.number().int().positive().safeParse(messageId);
  const yes = z.boolean().safeParse(confirm);
  if (!id.success || !yes.success) return { ok: false, error: "Invalid action." };
  const { supabase, userId } = await coachContext();
  if (!userId) return { ok: false, error: "Please sign in again." };

  const { data: message } = await supabase
    .from("coach_messages")
    .select("action, action_status")
    .eq("id", id.data)
    .eq("user_id", userId)
    .maybeSingle<{ action: unknown; action_status: string | null }>();
  const action = coachActionSchema.safeParse(message?.action);
  if (!message || !action.success) return { ok: false, error: "That action no longer exists." };
  if (message.action_status !== "proposed") return { ok: false, error: "That action was already handled." };

  const finish = async (status: "done" | "cancelled", result: string | null) => {
    await supabase.from("coach_messages").update({ action_status: status, action_result: result }).eq("id", id.data).eq("user_id", userId);
    return done();
  };
  if (!yes.data) return finish("cancelled", null);

  if (action.data.type === "add_to_shopping_list") {
    const r = await addCustomItemAction(action.data.item);
    if (!r.ok) return r;
    return finish("done", "Added to your shopping list.");
  }

  const { day, meal } = action.data;
  const r = await swapMealAction(day, meal);
  if (!r.ok) return r;
  const profile = await getCurrentProfile();
  let result = `Done — ${DAY_NAMES[day]}'s ${meal} was swapped.`;
  if (profile) {
    const plan = await getOrCreateWeekPlan(profile);
    const slot = plan.slots.find((s) => s.day === day && s.meal === meal);
    const title = slot && plan.recipes.find((rec) => rec.id === slot.recipeId)?.title;
    if (title) result = `Done — ${DAY_NAMES[day]}'s ${meal} is now ${title}.`.slice(0, 300);
  }
  return finish("done", result);
}
