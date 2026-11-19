"use client";

import { combine, interpolate, interpolateAll, separate, type Interpolator } from "flubber";
import { animate, motion, useMotionValue, useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";
import { clsx } from "clsx";
import type { Glyph } from "./glyphs";

// A tiny circle at the centre. Pads glyph lists so N parts can morph into M parts.
const DOT = "M12 11.9A0.1 0.1 0 1 1 12 12.1A0.1 0.1 0 1 1 12 11.9Z";
const options = { maxSegmentLength: 1, single: true };
const morphers = new Map<string, Interpolator>();

/** Picks the right Flubber helper for the part counts on each side, and caches the result. */
function morpher(from: Glyph, to: Glyph): Interpolator {
  const key = `${from.join()}>${to.join()}`;
  let morph = morphers.get(key);
  if (!morph) {
    if (from.length === 1 && to.length === 1) morph = interpolate(from[0], to[0], options);
    else if (from.length === 1) morph = separate(from[0], [...to], options);
    else if (to.length === 1) morph = combine([...from], to[0], options);
    else {
      const size = Math.max(from.length, to.length);
      const pad = (glyph: Glyph) => [...glyph, ...Array<string>(size - glyph.length).fill(DOT)];
      morph = interpolateAll(pad(from), pad(to), options);
    }
    morphers.set(key, morph);
  }
  return morph;
}

type MorphIconProps = { glyph: Glyph; size?: number; spin?: boolean; className?: string };

/** An icon that morphs its shape whenever `glyph` changes. Pass constants from `glyphs`. */
export function MorphIcon({ glyph, size = 16, spin = false, className }: MorphIconProps) {
  const d = useMotionValue(glyph.join(" "));
  const shown = useRef(glyph);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const from = shown.current;
    if (from === glyph) return;
    shown.current = glyph;
    if (reduceMotion) {
      d.set(glyph.join(" "));
      return;
    }

    const morph = morpher(from, glyph);
    const controls = animate(0, 1, {
      duration: 0.38,
      ease: [0.32, 0.72, 0, 1],
      onUpdate: (t) => d.set(morph(t)),
      onComplete: () => d.set(glyph.join(" ")), // end on the crisp original path
    });
    return () => controls.stop();
  }, [glyph, d, reduceMotion]);

  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden
      className={clsx("shrink-0", spin && "animate-spin", className)}
    >
      <motion.path d={d} fill="currentColor" />
    </svg>
  );
}
