"use client";

import { Radio, RadioGroup } from "@headlessui/react";
import { motion } from "motion/react";
import type { ReactNode } from "react";

type Option<T extends string> = { value: T; label: string; icon?: ReactNode };

/**
 * A radio group drawn as a segmented control. Headless UI handles the keyboard
 * (arrow keys) and ARIA; Motion slides the highlight between options.
 */
export function Segmented<T extends string>({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: Option<T>[];
}) {
  return (
    <RadioGroup
      id={id}
      aria-label={label}
      value={value}
      onChange={onChange}
      className="grid auto-cols-fr grid-flow-col gap-1 rounded-xl bg-surface-muted p-1 ring-1 ring-border ring-inset"
    >
      {options.map((option) => (
        <Radio
          key={option.value}
          value={option.value}
          className="group relative flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-2 text-sm font-medium text-fg-muted outline-none transition-colors hover:text-fg data-checked:text-fg data-focus:ring-2 data-focus:ring-brand-500/40"
        >
          {({ checked }) => (
            <>
              {checked && (
                <motion.span
                  layoutId={`${id}-highlight`}
                  className="absolute inset-0 rounded-lg bg-surface shadow-sm ring-1 ring-border"
                  transition={{ type: "spring", bounce: 0.18, duration: 0.4 }}
                />
              )}
              <span className="relative flex items-center gap-1.5">
                {option.icon}
                {option.label}
              </span>
            </>
          )}
        </Radio>
      ))}
    </RadioGroup>
  );
}
