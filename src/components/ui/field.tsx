"use client";

import { AnimatePresence, motion } from "motion/react";
import { CircleAlert } from "lucide-react";
import type { ReactNode } from "react";

type FieldProps = { id: string; label: string; hint?: ReactNode; error?: string; aside?: ReactNode; children: ReactNode };

/** Label, control, then either the error or the hint. The error is linked for screen readers. */
export function Field({ id, label, hint, error, aside, children }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium text-fg">
          {label}
        </label>
        {aside}
      </div>
      {children}
      <AnimatePresence initial={false} mode="wait">
        {error ? (
          <motion.p
            key="error"
            id={`${id}-error`}
            role="alert"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-start gap-1.5 text-xs text-red-600 dark:text-red-400"
          >
            <CircleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
            {error}
          </motion.p>
        ) : hint ? (
          <motion.p key="hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-xs text-fg-subtle">
            {hint}
          </motion.p>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/** Shared input look, including the error state. */
export const inputClass = (invalid?: boolean) =>
  [
    "h-10 w-full rounded-lg border bg-surface px-3 text-sm text-fg shadow-xs outline-none transition",
    "placeholder:text-fg-subtle disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-fg-subtle",
    "focus:border-brand-400 focus:ring-3 focus:ring-brand-500/15",
    invalid ? "border-red-400 dark:border-red-500/70" : "border-border-strong",
  ].join(" ");
