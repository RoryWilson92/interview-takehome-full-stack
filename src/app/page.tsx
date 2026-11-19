import { BookOpen } from "lucide-react";
import { Generator } from "@/components/generator/generator";
import { Logo } from "@/components/ui/logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export default function Page() {
  return (
    <div className="page-glow min-h-screen">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 sm:px-6">
        <div className="flex items-center gap-3">
          <Logo />
          <span className="hidden h-5 w-px bg-border-strong sm:block" />
          <span className="hidden text-sm font-medium text-fg-muted sm:block">Proxy Generator</span>
        </div>
        <nav className="flex items-center gap-1">
          <a
            href="https://documentation.byteful.com/general/generating-residential-proxies"
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-fg-muted transition hover:bg-surface-muted hover:text-fg"
          >
            <BookOpen className="size-4" /> Docs
          </a>
          <ThemeToggle />
        </nav>
      </header>

      <main className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
        <div className="mb-8 max-w-2xl pt-4">
          <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-border bg-surface/70 px-3 py-1 text-xs font-medium text-fg-muted backdrop-blur">
            <span className="size-1.5 rounded-full bg-brand-500" /> Residential proxies
          </p>
          <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Generate a proxy list</h1>
          <p className="mt-2 text-fg-muted">
            Pick a location and network, choose sticky or rotating sessions, and get proxy strings you can paste straight into your
            tools.
          </p>
        </div>
        <Generator />
      </main>
    </div>
  );
}
