"use client";

import {
  Combobox as HeadlessCombobox,
  ComboboxButton,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
} from "@headlessui/react";
import { clsx } from "clsx";
import { ChevronsUpDown, LoaderCircle, RotateCw, X } from "lucide-react";
import type { ReactNode } from "react";
import { inputClass } from "./field";

export type ComboboxProps<T> = {
  id: string;
  label: string;
  placeholder: string;
  value: T | null;
  onChange: (value: T | null) => void;
  onBlur?: () => void;
  query: string;
  onQueryChange: (query: string) => void;
  options: T[];
  getKey: (item: T) => string | number;
  getLabel: (item: T) => string;
  renderOption: (item: T) => ReactNode;
  /** Shown inside the input, before the text, when a value is picked (a flag, say). */
  renderAdornment?: (item: T) => ReactNode;
  loading?: boolean;
  /** Background refresh: keeps the current options and shows a spinner. */
  fetching?: boolean;
  error?: { message: string; onRetry: () => void } | null;
  emptyMessage: string;
  footer?: ReactNode;
  disabled?: boolean;
  invalid?: boolean;
};

/**
 * Searchable select. Headless UI provides the ARIA combobox pattern and
 * keyboard support; the caller owns the options and the query, so the same
 * component serves a local list (countries) and server searches (cities, ASNs).
 */
export function Combobox<T>(props: ComboboxProps<T>) {
  const { id, value, onChange, getKey, getLabel, renderAdornment, options, query, disabled, invalid } = props;
  const adornment = value && renderAdornment?.(value);

  return (
    <HeadlessCombobox
      value={value}
      onChange={onChange}
      by={(a: T | null, b: T | null) => (a && b ? getKey(a) === getKey(b) : a === b)}
      onClose={() => props.onQueryChange("")}
      disabled={disabled}
      immediate
    >
      <div className="relative">
        {adornment && <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center">{adornment}</span>}
        <ComboboxInput
          id={id}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? `${id}-error` : undefined}
          className={clsx(inputClass(invalid), "pr-16", adornment && "pl-9")}
          placeholder={props.placeholder}
          displayValue={(item: T | null) => (item ? getLabel(item) : "")}
          onChange={(event) => props.onQueryChange(event.target.value)}
          onBlur={props.onBlur}
          autoComplete="off"
          spellCheck={false}
        />
        <div className="absolute inset-y-0 right-1 flex items-center gap-0.5">
          {props.fetching && query && <LoaderCircle className="size-4 animate-spin text-fg-subtle" aria-label="Searching" />}
          {value && !disabled && (
            <button
              type="button"
              onClick={() => onChange(null)}
              aria-label={`Clear ${props.label}`}
              className="grid size-7 place-items-center rounded-md text-fg-subtle hover:bg-surface-muted hover:text-fg"
            >
              <X className="size-3.5" />
            </button>
          )}
          <ComboboxButton className="grid size-7 place-items-center rounded-md text-fg-subtle hover:text-fg disabled:opacity-50" aria-label={`Show ${props.label} options`}>
            <ChevronsUpDown className="size-4" />
          </ComboboxButton>
        </div>
      </div>

      <ComboboxOptions
        anchor="bottom start"
        transition
        className={clsx(
          "z-50 w-(--input-width) min-w-64 rounded-xl border border-border bg-surface p-1 shadow-xl shadow-black/10 [--anchor-gap:6px] [--anchor-max-height:20rem] empty:invisible",
          "origin-top transition duration-150 ease-out data-closed:scale-98 data-closed:opacity-0",
        )}
      >
        {props.loading && options.length === 0 ? (
          <Status>
            <LoaderCircle className="size-4 animate-spin" /> Loading…
          </Status>
        ) : props.error ? (
          <Status>
            <span className="flex-1">{props.error.message}</span>
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()} // keep the list open
              onClick={props.error.onRetry}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 font-medium text-brand-600 hover:bg-brand-soft dark:text-brand-300"
            >
              <RotateCw className="size-3.5" /> Retry
            </button>
          </Status>
        ) : options.length === 0 ? (
          <Status>{props.emptyMessage}</Status>
        ) : (
          options.map((item) => (
            <ComboboxOption
              key={getKey(item)}
              value={item}
              className="group flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-fg select-none data-focus:bg-brand-soft data-selected:font-medium"
            >
              {props.renderOption(item)}
            </ComboboxOption>
          ))
        )}
        {props.footer && options.length > 0 && !props.error && (
          <div className="border-t border-border px-2.5 pt-2 pb-1.5 text-xs text-fg-subtle">{props.footer}</div>
        )}
      </ComboboxOptions>
    </HeadlessCombobox>
  );
}

const Status = ({ children }: { children: ReactNode }) => (
  <div className="flex items-center gap-2 px-2.5 py-2.5 text-sm text-fg-muted">{children}</div>
);
