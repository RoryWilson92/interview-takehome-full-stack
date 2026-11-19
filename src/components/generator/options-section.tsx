"use client";

import { clsx } from "clsx";
import { AnimatePresence, motion } from "motion/react";
import { Lock, Pin, Repeat, Shield } from "lucide-react";
import { Field, inputClass } from "@/components/ui/field";
import { Segmented } from "@/components/ui/segmented";
import { formatCount } from "@/lib/format";
import { LIST_COUNT, type ListFormat, type SessionType } from "@/lib/proxy/schema";
import { Section } from "./section";
import type { GeneratorForm } from "./use-generator-form";

const SESSION_INFO: Record<SessionType, string> = {
  sticky: "Each line keeps its own IP for the session. Best for logins, carts and multi-step flows.",
  rotating: "Every request leaves from a new IP. All lines are the same, so take one per worker thread.",
};

const FORMAT_INFO: Record<ListFormat, string> = {
  http: "Plain HTTP proxy. Works with almost every tool and library.",
  https: "TLS between you and the proxy, so your own network can't read the proxy traffic.",
  socks5: "SOCKS5 for any TCP traffic. Your client resolves hostnames itself.",
  socks5h: "SOCKS5 with DNS resolved by the proxy, so lookups match the exit location.",
};

const QUICK_COUNTS = [10, 100, 500, 1000];

/** Description under a segmented control that cross-fades when the choice changes. */
function Explainer({ id, text }: { id: string; text: string }) {
  return (
    <div className="relative min-h-8 text-xs text-fg-subtle">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.p key={text} id={id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.18 }}>
          {text}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}

export function OptionsSection({ form }: { form: GeneratorForm }) {
  const { list_session_type, list_format, list_count } = form.values;
  const countError = form.errorFor("list_count");

  return (
    <Section step={2} title="Session & protocol" description="How the proxies behave and how your tools connect to them.">
      <div className="space-y-1.5">
        <span className="text-sm font-medium">Session type</span>
        <Segmented
          id="list_session_type"
          label="Session type"
          value={list_session_type}
          onChange={(value) => form.set("list_session_type", value)}
          options={[
            { value: "sticky", label: "Sticky", icon: <Pin className="size-3.5" /> },
            { value: "rotating", label: "Rotating", icon: <Repeat className="size-3.5" /> },
          ]}
        />
        <Explainer id="session-info" text={SESSION_INFO[list_session_type]} />
      </div>

      <div className="space-y-1.5">
        <span className="text-sm font-medium">Protocol</span>
        <Segmented
          id="list_format"
          label="Protocol"
          value={list_format}
          onChange={(value) => form.set("list_format", value)}
          options={[
            { value: "http", label: "HTTP" },
            { value: "https", label: "HTTPS", icon: <Lock className="hidden size-3 sm:block" /> },
            { value: "socks5", label: "SOCKS5" },
            { value: "socks5h", label: "SOCKS5h", icon: <Shield className="hidden size-3 sm:block" /> },
          ]}
        />
        <Explainer id="format-info" text={FORMAT_INFO[list_format]} />
      </div>

      <Field
        id="list_count"
        label="Quantity"
        error={countError}
        hint={`From ${LIST_COUNT.min} to ${formatCount(LIST_COUNT.max)} proxies per list.`}
        aside={
          <div className="flex gap-1" role="group" aria-label="Quick quantities">
            {QUICK_COUNTS.map((count) => (
              <button
                key={count}
                type="button"
                onClick={() => form.set("list_count", String(count))}
                className={clsx(
                  "rounded-md px-1.5 py-0.5 text-xs font-medium tabular-nums transition",
                  list_count === String(count) ? "bg-brand-soft text-brand-600 dark:text-brand-300" : "text-fg-subtle hover:text-fg",
                )}
              >
                {formatCount(count)}
              </button>
            ))}
          </div>
        }
      >
        <input
          id="list_count"
          type="number"
          inputMode="numeric"
          min={LIST_COUNT.min}
          max={LIST_COUNT.max}
          step={1}
          className={clsx(inputClass(Boolean(countError)), "tabular-nums")}
          value={list_count}
          onChange={(event) => form.set("list_count", event.target.value)}
          onBlur={() => form.touch("list_count")}
          aria-invalid={Boolean(countError) || undefined}
          aria-describedby={countError ? "list_count-error" : undefined}
        />
      </Field>
    </Section>
  );
}
