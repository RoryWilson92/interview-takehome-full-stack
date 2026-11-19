import type { ReactNode } from "react";

type SectionProps = { step: number; title: string; description: string; action?: ReactNode; children: ReactNode };

/** A numbered card. The numbers walk the user through the form in order. */
export function Section({ step, title, description, action, children }: SectionProps) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm shadow-black/[0.03]">
      <header className="mb-4 flex items-start gap-3">
        <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-brand-soft font-display text-xs font-bold text-brand-600 dark:text-brand-300">
          {step}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-[15px] font-semibold tracking-tight">{title}</h2>
          <p className="text-xs text-fg-muted">{description}</p>
        </div>
        {action}
      </header>
      <div className="space-y-4">{children}</div>
    </section>
  );
}
