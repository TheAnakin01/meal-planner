import type { Metadata } from "next";
import AuthForm from "@/components/AuthForm";
import { LeafIcon } from "@/components/ui/icons";
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
    <main className="mx-auto w-full max-w-md flex-1 px-4 pt-10 pb-12">
      <div className="mb-8 text-center">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-lg shadow-emerald-900/20 motion-safe:animate-float">
          <LeafIcon size={32} />
        </span>
        <h1 className="mt-5 text-3xl font-bold tracking-tight">Welcome</h1>
        <p className="mt-2 muted">Sign in to save your profile and see your meal plan.</p>
      </div>

      {notice && (
        <p
          role={notice.tone === "error" ? "alert" : "status"}
          className={`mb-6 rounded-2xl p-3 text-sm ${
            notice.tone === "error"
              ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
              : "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
          }`}
        >
          {notice.text}
        </p>
      )}

      <div className="card p-6">
        <AuthForm next={next} />
      </div>
    </main>
  );
}
