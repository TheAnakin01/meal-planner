import type { Metadata } from "next";
import AuthForm from "@/components/AuthForm";
import { safeNextPath } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Sign in · Meal Planner",
};

// Messages shown after returning from an email link (set by /auth/callback).
const NOTICES: Record<string, { text: string; tone: "ok" | "error" }> = {
  confirmed: { text: "Your email is confirmed. Please sign in.", tone: "ok" },
  link: {
    text: "That link is invalid or has expired. Try signing in, or create your account again to get a new link.",
    tone: "error",
  },
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = safeNextPath(typeof params.next === "string" ? params.next : null);
  const noticeKey = typeof params.notice === "string" ? params.notice : "";
  const notice = NOTICES[noticeKey];

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-8 sm:py-12">
      <h1 className="text-3xl font-bold">Welcome</h1>
      <p className="mt-2 mb-8 text-zinc-600 dark:text-zinc-400">
        Sign in to save your profile and see your meal plan.
      </p>

      {notice && (
        <p
          role={notice.tone === "error" ? "alert" : "status"}
          className={`mb-6 rounded-lg p-3 text-sm ${
            notice.tone === "error"
              ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
              : "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
          }`}
        >
          {notice.text}
        </p>
      )}

      <AuthForm next={next} />
    </main>
  );
}
