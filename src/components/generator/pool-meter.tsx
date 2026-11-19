"use client";

import { clsx } from "clsx";
import { RotateCw } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useAvailability } from "@/client/queries";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { formatCount } from "@/lib/format";
import { ApiError } from "@/lib/api/errors";
import type { Targeting } from "@/lib/proxy/targeting";

type Level = "none" | "small" | "medium" | "large";

const LEVELS: Record<Level, { bars: number; tone: string; text: string }> = {
  none: { bars: 0, tone: "bg-red-500", text: "No IPs are online for this targeting right now, so these proxies would fail. Remove the city or ASN to widen the pool." },
  small: { bars: 1, tone: "bg-amber-500", text: "A small pool. Expect slower connections and repeated IPs." },
  medium: { bars: 2, tone: "bg-emerald-500", text: "A healthy pool for most jobs." },
  large: { bars: 3, tone: "bg-emerald-500", text: "A large pool. Good for high-volume work." },
};

const levelOf = (count: number): Level => (count === 0 ? "none" : count < 1_000 ? "small" : count < 25_000 ? "medium" : "large");

/** Live size of the matching IP pool, so users see a dead combination before they generate. */
export function PoolMeter({ targeting, listCount, sticky }: { targeting: Targeting; listCount: number; sticky: boolean }) {
  const availability = useAvailability(targeting);
  const count = availability.data;
  const level = count === undefined ? undefined : LEVELS[levelOf(count)];
  // More sticky sessions than online IPs means some sessions must share an IP.
  const oversubscribed = sticky && count !== undefined && count > 0 && listCount > count;

  return (
    <div className="rounded-xl border border-border bg-gradient-to-br from-brand-soft/60 to-transparent p-3.5" aria-live="polite">
      <div className="flex items-center justify-between gap-2 text-xs font-medium text-fg-muted">
        <span className="flex items-center gap-1.5">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60 motion-reduce:hidden" />
            <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
          </span>
          Matching pool, live
        </span>
        <span className="flex gap-0.5" aria-hidden>
          {[1, 2, 3].map((bar) => (
            <span key={bar} className={clsx("h-1.5 w-4 rounded-full transition-colors duration-500", level && bar <= level.bars ? level.tone : "bg-border")} />
          ))}
        </span>
      </div>

      {availability.isError && count === undefined ? (
        <p className="mt-2 flex items-center justify-between gap-2 text-xs text-fg-muted">
          {availability.error instanceof ApiError && availability.error.code === "unknown_location"
            ? "This location is not available any more, so nothing matches. Pick another one."
            : "Couldn't check availability. You can still generate."}
          <button type="button" onClick={() => availability.refetch()} className="inline-flex items-center gap-1 font-medium text-brand-600 dark:text-brand-300">
            <RotateCw className="size-3" /> Retry
          </button>
        </p>
      ) : count === undefined ? (
        <div className="mt-2 space-y-2">
          <div className="skeleton h-7 w-32 rounded-md" />
          <div className="skeleton h-3 w-48 rounded" />
        </div>
      ) : (
        <>
          <p className={clsx("mt-1 flex items-baseline gap-2 transition-opacity", availability.isFetching && "opacity-60")}>
            <span className="font-display text-2xl font-semibold tracking-tight">
              <AnimatedNumber value={count} />
            </span>
            <span className="text-sm text-fg-muted">online IPs match</span>
          </p>
          <AnimatePresence mode="wait" initial={false}>
            <motion.p
              key={`${level?.text}${oversubscribed}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className={clsx("mt-1 text-xs", count === 0 ? "text-red-600 dark:text-red-400" : "text-fg-muted")}
            >
              {level?.text}
              {oversubscribed &&
                ` You asked for ${formatCount(listCount)} sticky sessions but only ${formatCount(count)} IPs are online, so some will share an IP.`}
            </motion.p>
          </AnimatePresence>
        </>
      )}
    </div>
  );
}
