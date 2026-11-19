/** Byteful-style mark: three "bytes" forming a b. */
export function Logo() {
  return (
    <span className="flex items-center gap-2.5">
      <svg viewBox="0 0 32 32" className="size-8" aria-hidden>
        <defs>
          <linearGradient id="logo-gradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#8a7cf2" />
            <stop offset="1" stopColor="#5243d6" />
          </linearGradient>
        </defs>
        <rect width="32" height="32" rx="9" fill="url(#logo-gradient)" />
        <rect x="8" y="7" width="6.5" height="6.5" rx="1.8" fill="white" />
        <rect x="8" y="17.5" width="6.5" height="6.5" rx="1.8" fill="white" />
        <rect x="17.5" y="17.5" width="6.5" height="6.5" rx="1.8" fill="white" opacity="0.7" />
      </svg>
      <span className="font-display text-lg font-bold tracking-tight">byteful</span>
    </span>
  );
}
