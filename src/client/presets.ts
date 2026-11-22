import { useSyncExternalStore } from "react";
import { z } from "zod";
import { asnSchema, citySchema, countrySchema } from "@/lib/api/contracts";
import { LIST_FORMATS, SESSION_TYPES } from "@/lib/proxy/schema";

/*
 * Saved presets live in localStorage. They hold options and targeting, never
 * credentials. The stored data is versioned and checked with Zod on read, so
 * a future shape change can migrate old data instead of crashing on it.
 *
 * TODO: with accounts, store presets on the server (same schema, per user)
 * so they follow the user across devices and can be shared with a team.
 */

const STORAGE_KEY = "byteful.generator.presets";
const PRESET_VERSION = 1;

export const presetValuesSchema = z.object({
  list_count: z.string(),
  list_format: z.enum(LIST_FORMATS),
  list_session_type: z.enum(SESSION_TYPES),
  country: countrySchema.nullable(),
  city: citySchema.nullable(),
  asn: asnSchema.nullable(),
});

const presetSchema = z.object({ id: z.string(), name: z.string(), values: presetValuesSchema });
const storeSchema = z.object({ version: z.literal(PRESET_VERSION), presets: z.array(presetSchema) });

export type PresetValues = z.infer<typeof presetValuesSchema>;
export type Preset = z.infer<typeof presetSchema>;

const EMPTY: Preset[] = [];
const listeners = new Set<() => void>();
let cache: { raw: string | null; presets: Preset[] } = { raw: null, presets: EMPTY };

// useSyncExternalStore needs a stable snapshot, so we only re-parse when the raw string changes.
function read(): Preset[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    // Storage blocked (private mode, sandbox). Presets just stay empty.
  }
  if (raw === cache.raw) return cache.presets;
  let presets = EMPTY;
  try {
    presets = storeSchema.parse(JSON.parse(raw ?? "null")).presets;
  } catch {
    // Missing or corrupt data: start fresh rather than break the page.
  }
  cache = { raw, presets };
  return presets;
}

function write(presets: Preset[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: PRESET_VERSION, presets } satisfies z.infer<typeof storeSchema>));
  } catch {
    return;
  }
  listeners.forEach((notify) => notify());
}

function subscribe(notify: () => void) {
  listeners.add(notify);
  window.addEventListener("storage", notify); // keeps other tabs in sync
  return () => {
    listeners.delete(notify);
    window.removeEventListener("storage", notify);
  };
}

/**
 * Saves (or replaces by name) a preset. The values go through the schema, which keeps
 * only the option and targeting fields, so passing the whole form never stores credentials.
 */
export function savePreset(name: string, values: PresetValues) {
  const preset = { id: crypto.randomUUID(), name, values: presetValuesSchema.parse(values) };
  write([...read().filter((existing) => existing.name !== name), preset]);
}

export function removePreset(id: string) {
  write(read().filter((preset) => preset.id !== id));
}

export function usePresets() {
  const presets = useSyncExternalStore(subscribe, read, () => EMPTY);
  return { presets, save: savePreset, remove: removePreset };
}
