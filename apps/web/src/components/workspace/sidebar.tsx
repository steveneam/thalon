"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandLockup } from "@/components/brand/marks";
import { usePulse } from "@/components/workspace/pulse-context";
import { cn } from "@/lib/utils";
import { activeSurface, NAV_SURFACES } from "@/lib/workspace/nav";

/** Left rail (docs/FRONTEND.md §3 shell): the seven surfaces, always one click away. */
export function Sidebar() {
  const pathname = usePathname();
  const { pulse } = usePulse();
  const active = activeSurface(pathname);

  return (
    <aside
      aria-label="Workspace navigation"
      className="hidden w-56 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex"
    >
      <div className="flex h-14 items-center border-b border-sidebar-border px-4">
        <Link
          href="/app"
          className="rounded-md focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <BrandLockup />
        </Link>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 p-2">
        {NAV_SURFACES.map((surface) => {
          const isActive = active?.href === surface.href;
          const Icon = surface.icon;
          return (
            <Link
              key={surface.href}
              href={surface.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors",
                "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                isActive
                  ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
              )}
            >
              <Icon aria-hidden className={cn("size-4", isActive && "text-primary")} />
              <span className="flex-1">{surface.label}</span>
              {surface.showsNeedsYou && (pulse?.needsYou ?? 0) > 0 && (
                <span
                  aria-label={`${pulse!.needsYou} drafts need you`}
                  className="u-tabular inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground"
                >
                  {pulse!.needsYou}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-sidebar-border p-3">
        <p className="u-eyebrow text-muted-foreground">
          {pulse?.tenant ? `tenant · ${pulse.tenant.slug}` : "tenant · not seeded"}
        </p>
      </div>
    </aside>
  );
}
