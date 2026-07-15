"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CommandPalette } from "@/components/workspace/command-palette";
import { PulseProvider, usePulse } from "@/components/workspace/pulse-context";
import { Sidebar } from "@/components/workspace/sidebar";
import { Topbar } from "@/components/workspace/topbar";
import { cn } from "@/lib/utils";
import { activeSurface, NAV_SURFACES } from "@/lib/workspace/nav";

/** Small-screen fallback nav: the same surface registry as the sidebar, as a scrollable strip. */
function MobileNav() {
  const pathname = usePathname();
  const active = activeSurface(pathname);
  const { pulse } = usePulse();
  const needsYou = pulse?.needsYou ?? 0;
  return (
    <nav
      aria-label="Workspace navigation"
      className="flex gap-1 overflow-x-auto border-b border-border bg-sidebar px-2 py-1.5 md:hidden"
    >
      {NAV_SURFACES.map((surface) => (
        <Link
          key={surface.href}
          href={surface.href}
          aria-current={active?.href === surface.href ? "page" : undefined}
          className={cn(
            "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs transition-colors",
            active?.href === surface.href
              ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {surface.label}
          {/* The desktop sidebar shows the needs-you count; the mobile strip
              must not hide it (critique, Sam persona). */}
          {surface.showsNeedsYou && needsYou > 0 && (
            <span
              aria-label={`${needsYou} drafts need you`}
              className="u-tabular inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-signal px-1 text-2xs font-semibold text-signal-foreground"
            >
              {needsYou}
            </span>
          )}
        </Link>
      ))}
    </nav>
  );
}

/** The workspace command-center shell (docs/FRONTEND.md §3): left rail + top bar around every /app surface. */
export function WorkspaceShell({ children }: { children: React.ReactNode }) {
  return (
    <PulseProvider>
      {/* 12 chrome tab-stops precede content on every surface — keyboard and
          SR users get the standard bypass (critique s39, Sam persona). */}
      <a
        href="#workspace-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-1.5 focus:text-sm focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <div className="flex min-h-screen w-full">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <MobileNav />
          <main id="workspace-content" tabIndex={-1} className="flex min-w-0 flex-1 flex-col">
            {children}
          </main>
        </div>
      </div>
      <CommandPalette />
    </PulseProvider>
  );
}
