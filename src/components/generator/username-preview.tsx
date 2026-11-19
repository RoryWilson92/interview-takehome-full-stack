"use client";

import { clsx } from "clsx";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { PROXY_HOST, PROXY_PORT, randomSessionId } from "@/lib/proxy/generate";
import { usernameParts, type UsernamePart } from "@/lib/proxy/targeting";
import type { GeneratorValues } from "./use-generator-form";

const STYLES: Record<UsernamePart["kind"], { chip: string; dot: string }> = {
  user: { chip: "text-fg", dot: "bg-fg-subtle" },
  country_id: { chip: "bg-brand-500/10 text-brand-700 dark:text-brand-300", dot: "bg-brand-500" },
  city_alias: { chip: "bg-sky-500/10 text-sky-700 dark:text-sky-300", dot: "bg-sky-500" },
  asn_id: { chip: "bg-amber-500/10 text-amber-700 dark:text-amber-300", dot: "bg-amber-500" },
  session: { chip: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300", dot: "bg-emerald-500" },
};

/** A sample session ID that changes every few seconds, to show that each line gets its own. */
function useSampleSessionId() {
  const [id, setId] = useState("K7Q2M9X4T1B8R5ZC"); // fixed first value keeps server and client HTML equal
  const reduceMotion = useReducedMotion();
  useEffect(() => {
    if (reduceMotion) return;
    const timer = setInterval(() => setId(randomSessionId()), 2400);
    return () => clearInterval(timer);
  }, [reduceMotion]);
  return id;
}

/** The username, built live from the form with the same function the server uses, part by part. */
export function UsernamePreview({ values }: { values: GeneratorValues }) {
  const sessionId = useSampleSessionId();
  const sticky = values.list_session_type === "sticky";
  const { country, city, asn } = values;
  const parts = usernameParts(
    values.proxy_user_id.trim() || "your_user",
    { country_id: country?.country_id, city_alias: city?.city_alias, asn_id: asn?.asn_id },
    sticky ? sessionId : undefined,
  );

  const meaning: Record<UsernamePart["kind"], string> = {
    user: "Proxy user",
    country_id: `Country · ${country?.country_name}`,
    city_alias: `City · ${city?.city_name}`,
    asn_id: `ISP · ${asn?.asn_name}`,
    session: "Sticky session · new random ID per line",
  };

  return (
    <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm shadow-black/[0.03]">
      <header className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-[15px] font-semibold tracking-tight">How your proxy is built</h2>
        <span className="text-xs text-fg-subtle">Updates as you edit</span>
      </header>

      <p className="mt-3 overflow-x-auto rounded-xl bg-surface-muted px-3.5 py-3 font-mono text-[13px] leading-6 whitespace-nowrap">
        <span className="text-fg-subtle">{values.list_format}://</span>
        <AnimatePresence initial={false} mode="popLayout">
          {parts.map((part, index) => (
            <motion.span
              key={part.kind}
              layout="position"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ type: "spring", bounce: 0.2, duration: 0.35 }}
              className="inline-block"
            >
              {index > 0 && <span className="text-fg-subtle">_</span>}
              <span className={clsx("rounded px-0.5", STYLES[part.kind].chip)}>
                {part.kind === "user" ? part.value : `${part.tag}_${part.value}`}
              </span>
            </motion.span>
          ))}
        </AnimatePresence>
        <span className="text-fg-subtle">:</span>
        <span className="text-fg-muted">••••••••</span>
        <span className="text-fg-subtle">
          @{PROXY_HOST}:{PROXY_PORT}
        </span>
      </p>

      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-fg-muted">
        <AnimatePresence initial={false}>
          {parts.map((part) => (
            <motion.li key={part.kind} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-1.5">
              <span className={clsx("size-2 rounded-full", STYLES[part.kind].dot)} />
              {meaning[part.kind]}
            </motion.li>
          ))}
          {!sticky && (
            <motion.li key="rotating" layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-1.5">
              <span className="size-2 rounded-full border border-fg-subtle" />
              Rotating · no session ID, so every request gets a new IP
            </motion.li>
          )}
        </AnimatePresence>
      </ul>
    </section>
  );
}
