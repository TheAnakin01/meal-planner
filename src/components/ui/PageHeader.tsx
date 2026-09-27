import type { ComponentType, ReactNode } from "react";

// The same heading block on every page: optional icon, small line above, big title, one-line intro, action.
export default function PageHeader({
  title,
  eyebrow,
  intro,
  icon: Icon,
  tint = "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  action,
}: {
  title: string;
  eyebrow?: string;
  intro?: ReactNode;
  icon?: ComponentType<{ size?: number }>;
  tint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div className="flex min-w-0 items-center gap-3">
        {Icon && (
          <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl shadow-sm ${tint}`}>
            <Icon size={24} />
          </span>
        )}
        <div className="min-w-0">
          {eyebrow && <p className="text-sm font-medium muted">{eyebrow}</p>}
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          {intro && <p className="mt-1 text-sm muted">{intro}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
