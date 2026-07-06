"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CommandPalette } from "@/components/workspace/command-palette";
import { PulseProvider } from "@/components/workspace/pulse-context";
import { Sidebar } from "@/components/workspace/sidebar";
import { Topbar } from "@/components/workspace/topbar";
import { cn } from "@/lib/utils";
import { activeSurface, NAV_SURFACES } from "@/lib/workspace/nav";

/** Small-screen fallback nav: the same surface registry as the sidebar, as a scrollable strip. */
function MobileNav() {
  const pathname = usePathname();
  const active = activeSurface(pathname);
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
            "shrink-0 rounded-full px-3 py-1 text-xs transition-colors",
            active?.href === surface.href
              ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {surface.label}
        </Link>
      ))}
    </nav>
  );
}

/** The workspace command-center shell (docs/FRONTEND.md §3): left rail + top bar around every /app surface. */
export function WorkspaceShell({ children }: { children: React.ReactNode }) {
  return (
    <PulseProvider>
      <div className="flex min-h-screen w-full">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <MobileNav />
          <main className="flex min-w-0 flex-1 flex-col">{children}</main>
        </div>
      </div>
      <CommandPalette />
    </PulseProvider>
  );
}
