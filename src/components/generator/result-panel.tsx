"use client";

import { clsx } from "clsx";
import { Check, CircleAlert, EyeOff, Eye, ListPlus, RefreshCw, RotateCw, TerminalSquare } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { memo, useCallback, useState } from "react";
import type { ErrorCopy } from "@/client/describe-error";
import { glyphs } from "@/components/ui/glyphs";
import { MorphIcon } from "@/components/ui/morph-icon";
import { useCopy } from "@/components/ui/use-copy";
import type { ResidentialListRequest } from "@/lib/proxy/schema";

export type GeneratedList = { id: number; lines: string[]; request: ResidentialListRequest; summary: string };

type ResultPanelProps = {
  result: GeneratedList | null;
  pending: boolean;
  error: ErrorCopy | null;
  stale: boolean;
  onRegenerate: () => void;
};

/** For example byteful-gb-london-sticky-http-100.txt, from the request that made the list. */
function fileName({ request }: GeneratedList) {
  const where = [request.country_id, request.city_alias, request.asn_id && `as${request.asn_id}`].filter(Boolean).join("-");
  return `byteful-${where || "global"}-${request.list_session_type}-${request.list_format}-${request.list_count}.txt`;
}

function download(lines: string[], name: string) {
  const url = URL.createObjectURL(new Blob([`${lines.join("\n")}\n`], { type: "text/plain" }));
  Object.assign(document.createElement("a"), { href: url, download: name }).click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function ResultPanel({ result, pending, error, stale, onRegenerate }: ResultPanelProps) {
  const [maskPasswords, setMaskPasswords] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const copyAll = useCopy();
  const copyLine = useCopy(1200);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const { copy: copyLineText } = copyLine;
  // Stable across renders, so memoised lines only re-render when their own props change.
  const onCopyLine = useCallback(
    (index: number, line: string) => {
      setCopiedIndex(index);
      copyLineText(line);
    },
    [copyLineText],
  );

  const lines = result?.lines ?? [];

  return (
    <section className="flex min-h-[28rem] flex-col rounded-2xl border border-border bg-surface shadow-sm shadow-black/[0.03]">
      <header className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-3.5">
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-[15px] font-semibold tracking-tight">Proxy list</h2>
          <p className="truncate text-xs text-fg-muted">{result ? result.summary : "Generated proxies appear here."}</p>
        </div>
        {result && (
          <div className="flex items-center gap-1.5">
            <IconButton
              label={maskPasswords ? "Show passwords" : "Hide passwords"}
              onClick={() => setMaskPasswords((masked) => !masked)}
              pressed={maskPasswords}
            >
              {maskPasswords ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </IconButton>
            <button type="button" onClick={() => copyAll.copy(lines.join("\n"))} className={actionClass}>
              <MorphIcon glyph={copyAll.state === "copied" ? glyphs.check : copyAll.state === "failed" ? glyphs.cross : glyphs.copy} />
              {copyAll.state === "copied" ? "Copied" : copyAll.state === "failed" ? "Copy blocked" : "Copy all"}
            </button>
            <button
              type="button"
              onClick={() => {
                download(lines, fileName(result));
                setDownloaded(true);
                setTimeout(() => setDownloaded(false), 1600);
              }}
              className={clsx(actionClass, "bg-brand-500 text-white ring-0 hover:bg-brand-600")}
            >
              <MorphIcon glyph={downloaded ? glyphs.check : glyphs.download} />
              .txt
            </button>
          </div>
        )}
      </header>

      <AnimatePresence initial={false}>
        {error && !pending && (
          <Banner key="error" tone="error" icon={<CircleAlert className="size-4" />} title={error.title} detail={error.detail}>
            {error.requestId && <span className="font-mono text-[11px] opacity-70">Ref {error.requestId.slice(0, 12)}</span>}
            {error.retryable && (
              <BannerButton onClick={onRegenerate}>
                <RotateCw className="size-3.5" /> Try again
              </BannerButton>
            )}
          </Banner>
        )}
        {stale && !error && !pending && (
          <Banner key="stale" tone="info" icon={<RefreshCw className="size-4" />} title="Settings changed" detail="This list was made with your previous settings.">
            <BannerButton onClick={onRegenerate}>Regenerate</BannerButton>
          </Banner>
        )}
      </AnimatePresence>

      <div className="relative flex-1">
        {pending && !result ? (
          <Skeleton />
        ) : result ? (
          <motion.ol
            key={result.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: pending ? 0.45 : 1 }}
            className="max-h-[34rem] overflow-auto py-2 font-mono text-[12.5px] leading-7"
            aria-label={`${lines.length} generated proxies`}
          >
            {lines.map((line, index) => (
              <ProxyLine
                key={index}
                line={line}
                index={index}
                masked={maskPasswords}
                copied={copiedIndex === index && copyLine.state === "copied"}
                onCopy={onCopyLine}
              />
            ))}
          </motion.ol>
        ) : (
          !error && <EmptyState />
        )}
      </div>

      {result && lines[0] && <TestSnippet line={lines[0]} />}
    </section>
  );
}

const actionClass =
  "inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-fg ring-1 ring-border transition hover:bg-surface-muted";

function IconButton({ label, pressed, onClick, children }: { label: string; pressed: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} aria-pressed={pressed} className={clsx(actionClass, "w-8 justify-center px-0 text-fg-muted")}>
      {children}
    </button>
  );
}

/** One line: click to copy. Colours follow the username preview. Memoised because lists reach 1,000 lines. */
const ProxyLine = memo(function ProxyLine({
  line,
  index,
  masked,
  copied,
  onCopy,
}: {
  line: string;
  index: number;
  masked: boolean;
  copied: boolean;
  onCopy: (index: number, line: string) => void;
}) {
  const scheme = line.indexOf("://") + 3;
  const at = line.lastIndexOf("@");
  const [user, password] = [line.slice(scheme, line.indexOf(":", scheme)), line.slice(line.indexOf(":", scheme) + 1, at)];
  const sessionAt = user.lastIndexOf("_s_");

  return (
    <li className="proxy-line">
      <button
        type="button"
        onClick={() => onCopy(index, line)}
        title="Copy this proxy"
        className="group flex w-max min-w-full items-center gap-4 px-5 text-left whitespace-nowrap hover:bg-surface-muted focus-visible:bg-surface-muted focus-visible:outline-none"
      >
        <span className="w-8 shrink-0 text-right text-fg-subtle tabular-nums select-none">{index + 1}</span>
        <span className="flex-1">
          <span className="text-fg-subtle">{line.slice(0, scheme)}</span>
          {sessionAt === -1 ? user : user.slice(0, sessionAt)}
          {sessionAt !== -1 && <span className="text-emerald-600 dark:text-emerald-400">{user.slice(sessionAt)}</span>}
          <span className="text-fg-subtle">:</span>
          {masked ? "••••••••" : password}
          <span className="text-fg-subtle">{line.slice(at)}</span>
        </span>
        <span className={clsx("flex shrink-0 items-center gap-1 text-[11px] font-sans", copied ? "text-emerald-600 dark:text-emerald-400" : "text-fg-subtle opacity-0 group-hover:opacity-100")}>
          {copied ? <Check className="size-3.5" /> : null}
          {copied ? "Copied" : "Copy"}
        </span>
      </button>
    </li>
  );
});

function Banner({
  tone,
  icon,
  title,
  detail,
  children,
}: {
  tone: "error" | "info";
  icon: React.ReactNode;
  title: string;
  detail: string;
  children?: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      className="overflow-hidden"
      role={tone === "error" ? "alert" : "status"}
    >
      <div
        className={clsx(
          "flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-5 py-3 text-sm",
          tone === "error"
            ? "border-red-200 bg-red-50 text-red-800 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200"
            : "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200",
        )}
      >
        <span className="shrink-0">{icon}</span>
        <p className="min-w-0 flex-1">
          <span className="font-semibold">{title}.</span> {detail}
        </p>
        {children}
      </div>
    </motion.div>
  );
}

const BannerButton = ({ onClick, children }: { onClick: () => void; children: React.ReactNode }) => (
  <button
    type="button"
    onClick={onClick}
    className="inline-flex items-center gap-1.5 rounded-lg bg-white/70 px-2.5 py-1 text-xs font-semibold ring-1 ring-current/20 hover:bg-white dark:bg-white/10 dark:hover:bg-white/15"
  >
    {children}
  </button>
);

function Skeleton() {
  return (
    <div className="space-y-3 px-5 py-4" aria-label="Generating">
      {Array.from({ length: 9 }, (_, index) => (
        <div key={index} className="flex gap-4">
          <div className="skeleton h-3.5 w-6 rounded" />
          <div className="skeleton h-3.5 rounded" style={{ width: `${88 - (index % 3) * 9}%` }} />
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="grid h-full min-h-80 place-items-center px-8 py-12 text-center">
      <div className="max-w-xs">
        <div className="mx-auto mb-4 grid size-12 place-items-center rounded-2xl bg-brand-soft text-brand-600 dark:text-brand-300">
          <ListPlus className="size-6" />
        </div>
        <p className="font-display font-semibold">No proxies yet</p>
        <p className="mt-1 text-sm text-fg-muted">
          Enter your proxy user, pick a location if you need one, then press Generate. Nothing is sent to the proxy network until you use a line.
        </p>
      </div>
    </div>
  );
}

/** A ready curl command for the first proxy. ipinfo.io echoes the exit IP and its location. */
function TestSnippet({ line }: { line: string }) {
  const command = `curl -x '${line}' https://ipinfo.io/json`;
  const { state, copy } = useCopy();
  return (
    <footer className="flex items-center gap-3 border-t border-border bg-surface-muted/50 px-5 py-3">
      <TerminalSquare className="size-4 shrink-0 text-fg-subtle" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-fg-muted">Test the first proxy</p>
        <code className="block truncate font-mono text-xs text-fg-subtle">{command}</code>
      </div>
      <button type="button" onClick={() => copy(command)} className={actionClass}>
        <MorphIcon glyph={state === "copied" ? glyphs.check : glyphs.copy} />
        {state === "copied" ? "Copied" : "Copy"}
      </button>
    </footer>
  );
}
