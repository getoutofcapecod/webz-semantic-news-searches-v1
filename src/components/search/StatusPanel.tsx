import type { ComponentType } from "react";

import {
  AlertTriangleIcon,
  InfoIcon,
  SearchIcon,
  type IconProps,
} from "../icons";

interface StatusPanelProps {
  variant: "hint" | "empty" | "error";
  message: string;
}

const NEUTRAL_STYLE =
  "border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400";

const STYLES: Record<StatusPanelProps["variant"], string> = {
  hint: NEUTRAL_STYLE,
  empty: NEUTRAL_STYLE,
  error: "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300",
};

const ICONS: Record<StatusPanelProps["variant"], ComponentType<IconProps>> = {
  hint: InfoIcon,
  empty: SearchIcon,
  error: AlertTriangleIcon,
};

export function StatusPanel({ variant, message }: StatusPanelProps) {
  const Icon = ICONS[variant];

  // This panel sits inside the results section's aria-live region, so it needs
  // no role of its own; adding one would announce changes twice.
  return (
    <div
      className={`flex items-start gap-3 rounded-xl border px-4 py-4 text-sm leading-relaxed ${STYLES[variant]}`}
    >
      <Icon className="mt-0.5 h-5 w-5 shrink-0" />
      <p className="whitespace-pre-line">{message}</p>
    </div>
  );
}
