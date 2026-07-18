"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandMark } from "@/components/brand/marks";
import { cn } from "@/lib/utils";
import { activeSurface, JOURNEY_HREFS, NAV_SURFACES, type NavSurface } from "@/lib/workspace/nav";

/**
 * The icon side-rail (Phase D spine design): the journey surfaces live ON
 * the spine, so only the extras keep rail entries — Leads · Library ·
 * Videos · Runs, with Profiles + Settings at the foot. One icon metaphor
 * per feature (components/ui/icons.tsx). The rail stays at every width;
 * on narrow screens the spine stacks, the rail does not collapse.
 */

function RailLink({ surface, active }: { surface: NavSurface; active: boolean }) {
  const Icon = surface.icon;
  return (
    <Link
      href={surface.href}
      title={surface.label}
      aria-label={surface.label}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex size-9 items-center justify-center rounded-lg transition-colors",
        "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
      )}
    >
      <Icon aria-hidden />
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const active = activeSurface(pathname);
  const journey = NAV_SURFACES.find((s) => s.href === "/app")!;
  const onJourney = active !== undefined && JOURNEY_HREFS.has(active.href);

  return (
    <aside
      aria-label="Workspace navigation"
      className="flex w-14 shrink-0 flex-col items-center gap-1 border-r border-sidebar-border bg-sidebar py-3 text-sidebar-foreground"
    >
      <Link
        href="/app"
        aria-label="Workspace home"
        className="mb-3 flex size-9 items-center justify-center rounded-[0.625rem] bg-foreground text-background focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <BrandMark aria-hidden className="size-5" />
      </Link>
      {/* The journey icon stands for the whole spine: lit on any journey
          surface, aria-current only on the spine itself. */}
      <Link
        href="/app"
        title="Journey — the spine"
        aria-label="Journey — the spine"
        aria-current={active?.href === "/app" ? "page" : undefined}
        className={cn(
          "flex size-9 items-center justify-center rounded-lg transition-colors",
          "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          onJourney
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
        )}
      >
        <journey.icon aria-hidden />
      </Link>
      <nav aria-label="Workspace extras" className="flex flex-col items-center gap-1">
        {NAV_SURFACES.filter((s) => s.rail === "main").map((surface) => (
          <RailLink key={surface.href} surface={surface} active={active?.href === surface.href} />
        ))}
      </nav>
      <div className="flex-1" />
      <nav aria-label="Workspace account" className="flex flex-col items-center gap-1">
        {NAV_SURFACES.filter((s) => s.rail === "foot").map((surface) => (
          <RailLink key={surface.href} surface={surface} active={active?.href === surface.href} />
        ))}
      </nav>
    </aside>
  );
}
