"use client";

import { Popover, PopoverButton, PopoverPanel } from "@headlessui/react";
import { Bookmark, Trash2 } from "lucide-react";
import { useState } from "react";
import { usePresets, type PresetValues } from "@/client/presets";
import { countryFlag } from "@/lib/format";
import type { GeneratorForm } from "./use-generator-form";

const describe = (values: PresetValues) =>
  [
    `${values.list_count} ${values.list_session_type}`,
    values.list_format.toUpperCase(),
    values.country && `${countryFlag(values.country.country_id)} ${values.city?.city_name ?? values.country.country_name}`,
    values.asn && `AS${values.asn.asn_id}`,
  ]
    .filter(Boolean)
    .join(" · ");

/** Save and reuse option + targeting combinations. Credentials are never stored. */
export function PresetsMenu({ form }: { form: GeneratorForm }) {
  const { presets, save, remove } = usePresets();
  const [name, setName] = useState("");

  return (
    <Popover>
      <PopoverButton className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-fg-muted ring-1 ring-border transition outline-none hover:bg-surface hover:text-fg data-focus:ring-2 data-focus:ring-brand-500/40">
        <Bookmark className="size-3.5" />
        Presets
        {presets.length > 0 && <span className="rounded-full bg-brand-soft px-1.5 text-[10px] text-brand-600 dark:text-brand-300">{presets.length}</span>}
      </PopoverButton>
      <PopoverPanel
        anchor="bottom end"
        transition
        className="z-50 w-80 rounded-xl border border-border bg-surface p-2 shadow-xl shadow-black/10 transition duration-150 [--anchor-gap:6px] data-closed:translate-y-1 data-closed:opacity-0"
      >
        {({ close }) => (
          <>
            <p className="px-2 pt-1 pb-2 text-xs font-medium text-fg-subtle">Saved presets</p>
            {presets.length === 0 ? (
              <p className="px-2 pb-2 text-sm text-fg-muted">Save your options and targeting to reuse them in one click. Passwords are never saved.</p>
            ) : (
              <ul className="max-h-64 overflow-auto">
                {presets.map((preset) => (
                  <li key={preset.id} className="group flex items-center rounded-lg hover:bg-surface-muted">
                    <button
                      type="button"
                      onClick={() => {
                        form.applyPreset(preset.values);
                        close();
                      }}
                      className="min-w-0 flex-1 px-2 py-1.5 text-left"
                    >
                      <span className="block truncate text-sm font-medium">{preset.name}</span>
                      <span className="block truncate text-xs text-fg-subtle">{describe(preset.values)}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(preset.id)}
                      aria-label={`Delete preset ${preset.name}`}
                      className="mr-1 grid size-7 place-items-center rounded-md text-fg-subtle opacity-0 group-hover:opacity-100 hover:text-red-600 focus:opacity-100"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-2 flex gap-1.5 border-t border-border pt-2">
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && name.trim()) {
                    event.preventDefault();
                    save(name.trim(), form.presetValues());
                    setName("");
                  }
                }}
                maxLength={40}
                placeholder="Name the current setup"
                aria-label="Preset name"
                className="h-8 min-w-0 flex-1 rounded-lg border border-border-strong bg-surface px-2.5 text-sm outline-none focus:border-brand-400"
              />
              <button
                type="button"
                disabled={!name.trim()}
                onClick={() => {
                  save(name.trim(), form.presetValues());
                  setName("");
                }}
                className="h-8 rounded-lg bg-brand-500 px-3 text-xs font-semibold text-white disabled:opacity-40"
              >
                Save
              </button>
            </div>
          </>
        )}
      </PopoverPanel>
    </Popover>
  );
}
