"use client";

import { animate, motion, useMotionValue, useTransform } from "motion/react";
import { useEffect } from "react";
import { formatCount } from "@/lib/format";

/** Counts smoothly from the last value to the new one. */
export function AnimatedNumber({ value }: { value: number }) {
  const count = useMotionValue(value);
  const text = useTransform(count, (latest) => formatCount(Math.round(latest)));
  useEffect(() => {
    const controls = animate(count, value, { duration: 0.7, ease: [0.16, 1, 0.3, 1] });
    return () => controls.stop();
  }, [count, value]);
  return <motion.span className="tabular-nums">{text}</motion.span>;
}
