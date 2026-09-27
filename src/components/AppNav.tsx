"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ComponentType, useCallback, useEffect, useRef, useState } from "react";
import SignOutButton from "@/components/SignOutButton";
import {
  CartIcon,
  ChartIcon,
  ChatIcon,
  CloseIcon,
  CompassIcon,
  DiaryIcon,
  HeartIcon,
  HouseholdIcon,
  MoreIcon,
  ShieldIcon,
  TodayIcon,
  UserIcon,
  WeekIcon,
} from "@/components/ui/icons";

interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<{ size?: number }>;
}

const MAIN: NavItem[] = [
  { href: "/dashboard", label: "Today", icon: TodayIcon },
  { href: "/week", label: "Week", icon: WeekIcon },
  { href: "/shopping", label: "Shopping", icon: CartIcon },
  { href: "/diary", label: "Diary", icon: DiaryIcon },
];

const MORE: (NavItem & { hint: string })[] = [
  { href: "/progress", label: "Progress", hint: "Charts & streaks", icon: ChartIcon },
  { href: "/coach", label: "AI coach", hint: "Ask anything", icon: ChatIcon },
  { href: "/household", label: "Household", hint: "Share with family", icon: HouseholdIcon },
  { href: "/discover", label: "Discover", hint: "New recipe ideas", icon: CompassIcon },
  { href: "/dashboard/saved", label: "Saved", hint: "Your favourites", icon: HeartIcon },
  { href: "/profile", label: "Profile", hint: "Goals & reminders", icon: UserIcon },
];

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

// "More" menu: a bottom sheet on phones, a panel under the header on bigger screens.
// Uses <dialog> so focus is trapped and Esc closes it.
function MoreSheet({ open, onClose, email, isAdmin }: { open: boolean; onClose: () => void; email: string; isAdmin: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // Close when navigating.
  useEffect(() => {
    onClose();
  }, [pathname, onClose]);

  const items = isAdmin
    ? [...MORE, { href: "/admin", label: "Recipe library", hint: "Admin", icon: ShieldIcon }]
    : MORE;

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose(); // tap on the dimmed backdrop
      }}
      aria-label="More"
      className="m-0 mt-auto w-full max-w-none bg-transparent p-0 backdrop:bg-black/40 backdrop:backdrop-blur-sm sm:m-auto sm:max-w-md"
    >
      <div className="rounded-t-3xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl motion-safe:animate-sheet-up sm:rounded-3xl sm:motion-safe:animate-pop dark:bg-zinc-900">
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-zinc-300 sm:hidden dark:bg-zinc-700" aria-hidden="true" />
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-lg font-bold">More</p>
            {email && <p className="truncate text-sm muted">{email}</p>}
          </div>
          <button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800" aria-label="Close">
            <CloseIcon size={20} />
          </button>
        </div>
        <ul className="stagger grid grid-cols-2 gap-3">
          {items.map(({ href, label, hint, icon: Icon }) => (
            <li key={href}>
              <Link
                href={href}
                aria-current={isActive(pathname, href) ? "page" : undefined}
                className="flex h-full items-center gap-3 rounded-2xl bg-zinc-50 p-3 transition hover:bg-emerald-50 active:scale-95 aria-[current=page]:bg-emerald-50 aria-[current=page]:ring-2 aria-[current=page]:ring-emerald-600 dark:bg-zinc-800 dark:hover:bg-emerald-950 dark:aria-[current=page]:bg-emerald-950"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-emerald-700 shadow-sm dark:bg-zinc-900 dark:text-emerald-400">
                  <Icon size={20} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{label}</span>
                  <span className="block truncate text-xs muted">{hint}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <div className="mt-4">
          <SignOutButton className="btn btn-secondary w-full" />
        </div>
      </div>
    </dialog>
  );
}

// Tabs in the header on tablets/desktop.
export function DesktopNav({ email, isAdmin }: { email: string; isAdmin: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return (
    <nav aria-label="Main" className="hidden items-center gap-1 sm:flex">
      {MAIN.map(({ href, label }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
              active ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900" : "text-zinc-700 hover:bg-zinc-200/60 dark:text-zinc-300 dark:hover:bg-zinc-800"
            }`}
          >
            {label}
          </Link>
        );
      })}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-200/60 dark:text-zinc-300 dark:hover:bg-zinc-800"
        aria-haspopup="dialog"
      >
        More
      </button>
      <MoreSheet open={open} onClose={close} email={email} isAdmin={isAdmin} />
    </nav>
  );
}

// Tab bar fixed to the bottom of the screen on phones, like a native app.
export function BottomNav({ email, isAdmin }: { email: string; isAdmin: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  if (pathname === "/login") return null;
  const moreActive = MORE.some((m) => isActive(pathname, m.href)) || isActive(pathname, "/admin");

  return (
    <>
      <div className="h-24 sm:hidden" aria-hidden="true" />
      <nav
        aria-label="Main"
        className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 rounded-3xl border border-zinc-200/80 bg-white/85 px-2 py-1.5 shadow-xl shadow-zinc-900/10 backdrop-blur-xl sm:hidden dark:border-zinc-800 dark:bg-zinc-900/85"
      >
        <ul className="grid grid-cols-5">
          {[...MAIN, { href: "#more", label: "More", icon: MoreIcon }].map(({ href, label, icon: Icon }) => {
            const active = href === "#more" ? moreActive : isActive(pathname, href);
            const inner = (
              <>
                <span
                  className={`grid h-8 w-14 place-items-center rounded-full transition-all duration-300 ${
                    active ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200" : "text-zinc-500 dark:text-zinc-400"
                  }`}
                >
                  <span className={active ? "motion-safe:animate-pop" : ""}>
                    <Icon size={21} />
                  </span>
                </span>
                <span className={`text-[11px] ${active ? "font-semibold text-zinc-900 dark:text-white" : "text-zinc-600 dark:text-zinc-400"}`}>
                  {label}
                </span>
              </>
            );
            const cls = "flex w-full flex-col items-center gap-0.5 rounded-2xl py-1 active:scale-95 transition";
            return (
              <li key={href}>
                {href === "#more" ? (
                  <button type="button" onClick={() => setOpen(true)} className={cls} aria-haspopup="dialog">
                    {inner}
                  </button>
                ) : (
                  <Link href={href} aria-current={active ? "page" : undefined} className={cls}>
                    {inner}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
      <MoreSheet open={open} onClose={close} email={email} isAdmin={isAdmin} />
    </>
  );
}
