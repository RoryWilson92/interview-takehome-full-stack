"use client";

import { useMutation } from "@tanstack/react-query";
import { useAnimate } from "motion/react";
import { useRef, useState, useSyncExternalStore, type FormEvent, type KeyboardEvent } from "react";
import { api } from "@/client/api";
import { describeError } from "@/client/describe-error";
import { glyphs } from "@/components/ui/glyphs";
import { MorphIcon } from "@/components/ui/morph-icon";
import { ApiError } from "@/lib/api/errors";
import { formatCount } from "@/lib/format";
import type { ResidentialListRequest } from "@/lib/proxy/schema";
import { CredentialsSection } from "./credentials-section";
import { OptionsSection } from "./options-section";
import { PresetsMenu } from "./presets-menu";
import { ResultPanel, type GeneratedList } from "./result-panel";
import { TargetingSection } from "./targeting-section";
import { UsernamePreview } from "./username-preview";
import { FIELD_LABELS, useGeneratorForm, type GeneratorValues } from "./use-generator-form";

const isMac = () => /Mac|iPhone|iPad/.test(navigator.platform);

/** "100 sticky HTTP proxies · United Kingdom · London · AS5089" */
function summarize(request: ResidentialListRequest, values: GeneratorValues) {
  const what = `${formatCount(request.list_count)} ${request.list_session_type} ${request.list_format.toUpperCase()} ${request.list_count === 1 ? "proxy" : "proxies"}`;
  const where = [values.country?.country_name ?? "Any country", values.city?.city_name, values.asn && `AS${values.asn.asn_id}`];
  return [what, ...where].filter(Boolean).join(" · ");
}

/** Wires the form, the generate request and the result together. */
export function Generator() {
  const form = useGeneratorForm();
  const [result, setResult] = useState<GeneratedList | null>(null);
  const [flash, setFlash] = useState<"success" | "error" | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pendingSummary = useRef("");
  const [buttonScope, animate] = useAnimate<HTMLButtonElement>();
  const mac = useSyncExternalStore(() => () => {}, isMac, () => true);

  const showFlash = (state: "success" | "error") => {
    clearTimeout(flashTimer.current);
    setFlash(state);
    flashTimer.current = setTimeout(() => setFlash(null), 1500);
  };

  const generate = useMutation({
    mutationFn: api.generateList,
    onSuccess: (lines, request) => {
      setResult({ id: Date.now(), lines, request, summary: pendingSummary.current });
      showFlash("success");
    },
    onError: (error, request) => {
      if (error instanceof ApiError) form.applyServerError(error, request);
      showFlash("error");
    },
  });

  function submit(event?: FormEvent) {
    event?.preventDefault();
    if (generate.isPending) return;
    const request = form.submit();
    if (!request) {
      // Point at the problem instead of failing silently.
      if (form.firstInvalidField) document.getElementById(form.firstInvalidField)?.focus();
      animate(buttonScope.current, { x: [0, -7, 7, -4, 4, 0] }, { duration: 0.4 });
      return;
    }
    pendingSummary.current = summarize(request, form.values); // the settings as they were when sent
    generate.mutate(request);
  }

  // Cmd/Ctrl+Enter submits from anywhere in the form, including the comboboxes.
  function onKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) submit(event);
  }

  // Both come from the same schema, so key order matches and a string compare is enough.
  const stale = Boolean(result && form.parsed && JSON.stringify(form.parsed) !== JSON.stringify(result.request));
  const count = Number(form.values.list_count);
  const status = generate.isPending ? "pending" : (flash ?? "idle");
  const buttonGlyph = { idle: glyphs.bolt, pending: glyphs.spinner, success: glyphs.check, error: glyphs.cross }[status];

  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-fg-muted">Settings</p>
          <PresetsMenu form={form} />
        </div>
        <form onSubmit={submit} onKeyDown={onKeyDown} noValidate className="space-y-4">
          <CredentialsSection form={form} />
          <OptionsSection form={form} />
          <TargetingSection form={form} />

          <div className="sticky bottom-4 z-10 space-y-2 rounded-2xl lg:static">
            <button
              ref={buttonScope}
              type="submit"
              disabled={generate.isPending}
              className="group flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-brand-500 to-brand-600 font-semibold text-white shadow-lg shadow-brand-500/30 ring-1 ring-brand-700/40 transition outline-none ring-inset hover:from-brand-400 hover:to-brand-600 focus-visible:ring-4 focus-visible:ring-brand-500/40 disabled:cursor-progress"
            >
              <MorphIcon glyph={buttonGlyph} spin={status === "pending"} size={18} />
              {status === "pending"
                ? "Generating…"
                : Number.isInteger(count) && count >= 1 && count <= 1000
                  ? `Generate ${formatCount(count)} ${count === 1 ? "proxy" : "proxies"}`
                  : "Generate proxies"}
              <kbd className="ml-1 hidden rounded bg-white/15 px-1.5 py-0.5 font-sans text-[11px] font-medium text-white/80 sm:inline">
                {mac ? "⌘" : "Ctrl"} ↵
              </kbd>
            </button>
          </div>
        </form>
      </div>

      <div className="space-y-6 lg:sticky lg:top-6">
        <UsernamePreview values={form.values} />
        <ResultPanel
          result={result}
          pending={generate.isPending}
          error={generate.isError ? describeError(generate.error, FIELD_LABELS) : null}
          stale={stale}
          onRegenerate={() => submit()}
        />
      </div>
    </div>
  );
}
