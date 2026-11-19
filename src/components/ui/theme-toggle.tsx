"use client";

import { useSyncExternalStore } from "react";
import { glyphs } from "./glyphs";
import { MorphIcon } from "./morph-icon";

type Theme = "light" | "dark";
const listeners = new Set<() => void>();

const getTheme = (): Theme => (document.documentElement.classList.contains("dark") ? "dark" : "light");
const subscribe = (notify: () => void) => {
  listeners.add(notify);
  return () => listeners.delete(notify);
};

function setTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  try {
    localStorage.setItem("theme", theme);
  } catch {}
  listeners.forEach((notify) => notify());
}

/** Sun and moon morph into each other. The first theme is set by the script in layout.tsx. */
export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getTheme, () => "light" as Theme);
  const next = theme === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={`Switch to ${next} mode`}
      className="grid size-9 place-items-center rounded-lg text-fg-muted transition hover:bg-surface-muted hover:text-fg"
    >
      <MorphIcon glyph={theme === "dark" ? glyphs.moon : glyphs.sun} size={18} />
    </button>
  );
}
