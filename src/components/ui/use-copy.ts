"use client";

import { useCallback, useEffect, useRef, useState } from "react";

function legacyCopy(text: string): boolean {
  const textarea = Object.assign(document.createElement("textarea"), { value: text, readOnly: true });
  textarea.style.cssText = "position:fixed;opacity:0";
  document.body.append(textarea);
  textarea.select();
  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    textarea.remove();
  }
}

/** Copies text and reports `copied` for a moment, or `failed` when the browser refuses. */
export function useCopy(resetMs = 1600) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = useCallback(
    async (text: string) => {
      clearTimeout(timer.current);
      try {
        await navigator.clipboard.writeText(text);
        setState("copied");
      } catch {
        // Clipboard API refused (iframe without permission, insecure context): try the legacy path.
        setState(legacyCopy(text) ? "copied" : "failed");
      }
      timer.current = setTimeout(() => setState("idle"), resetMs);
    },
    [resetMs],
  );

  return { state, copy };
}
