"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Moon, Sun } from "lucide-react";
import { IconButton } from "@astryxdesign/core/IconButton";
import { TopNav } from "@astryxdesign/core/TopNav";
import { OPEN_PALETTE_EVENT } from "@/components/workspace/command-palette";
import { usePulse } from "@/components/workspace/pulse-context";
import { WorkTray } from "@/components/workspace/work-tray";
import { cn } from "@/lib/utils";
import { activeSurface } from "@/lib/workspace/nav";

/**
 * Top bar (wave-0 Astryx shell): tenant switcher first — whose workspace
 * this is — then the surface title, then the global affordances every
 * surface carries: the async-work tray, the needs-you chip (amber signal
 * channel), + Create, the command palette, and the light-mode toggle
 * (dark is the workspace default).
 */
export function WorkspaceTopNav({
  mode,
  onToggleMode,
}: {
  mode: "light" | "dark";
  onToggleMode: () => void;
}) {
  const pathname = usePathname();
  const { pulse, status } = usePulse();
  const surface = activeSurface(pathname);
  const needsYou = pulse?.needsYou ?? 0;

  return (
    <TopNav
      label="Workspace top bar"
      heading={
        /* Tenant/profile switcher — <details> keeps it dependency-free and
           accessible. One tenant per process today (DEMO_TENANT_SLUG, B2.1);
           the menu says so honestly instead of faking a multi-tenant list. */
        <details className="group relative">
          <summary
            className={cn(
              "flex h-8 cursor-pointer list-none items-center gap-1.5 rounded-lg border border-border px-2.5 text-sm",
              "hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden",
            )}
          >
            <span className="max-w-32 truncate font-medium">
              {pulse?.tenant?.name ?? "No tenant"}
            </span>
            {pulse?.profile && (
              <span className="hidden text-xs text-muted-foreground sm:inline">
                v{pulse.profile.version}
              </span>
            )}
            <ChevronDown
              aria-hidden
              className="size-3.5 text-muted-foreground transition-transform group-open:rotate-180"
            />
          </summary>
          <div className="absolute left-0 top-10 z-20 w-72 rounded-xl border border-border bg-popover p-3 text-popover-foreground shadow-lg">
            {pulse?.tenant ? (
              <>
                <p className="text-sm font-medium">{pulse.tenant.name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">slug · {pulse.tenant.slug}</p>
                <div className="mt-3 rounded-lg bg-muted/60 p-2.5 text-xs">
                  {pulse.profile ? (
                    <p>
                      Active profile <span className="font-medium">v{pulse.profile.version}</span>
                      {pulse.profile.company ? ` · ${pulse.profile.company}` : ""}
                    </p>
                  ) : (
                    <p>No active brand profile yet.</p>
                  )}
                  <div className="mt-1.5 flex flex-col gap-0.5">
                    <Link href="/app/profiles" className="text-primary hover:underline">
                      Manage profiles →
                    </Link>
                    {/* Settings ALSO lives here (founder s66: the rail's foot gear
                        alone wasn't findable) — the nav keeps its Settings entry. */}
                    <Link href="/app/settings" className="text-primary hover:underline">
                      Workspace settings →
                    </Link>
                  </div>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm font-medium">No tenant seeded</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Set up your workspace from the dashboard to start.
                </p>
              </>
            )}
            <p className="mt-3 border-t border-border pt-2 text-xs text-muted-foreground">
              One workspace tenant at a time for now — operator sign-in and true switching arrive
              with accounts. Which tenant this box operates shows in{" "}
              <Link href="/app/settings" className="text-primary hover:underline">
                Settings
              </Link>
              .
            </p>
          </div>
        </details>
      }
      startContent={
        <h1 className="min-w-0 truncate text-sm font-semibold">{surface?.label ?? "Workspace"}</h1>
      }
      endContent={
        <div className="flex items-center gap-2">
          <WorkTray />

          <Link
            href="/app/approve"
            aria-label={
              needsYou > 0
                ? `${needsYou} items need you — open the approve queue`
                : "Approve queue"
            }
            className={cn(
              "inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-xs font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              needsYou > 0
                ? "bg-signal text-signal-foreground hover:bg-signal/80"
                : "border border-border text-muted-foreground hover:bg-muted",
            )}
          >
            {status === "success" && needsYou === 0 ? (
              "queue clear"
            ) : (
              <>
                needs you ·{" "}
                <span className="u-tabular">{status === "success" ? needsYou : "–"}</span>
              </>
            )}
          </Link>

          <Link
            href="/app/create"
            className={cn(
              "inline-flex h-8 items-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground",
              "hover:opacity-90 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
            )}
          >
            + Create
          </Link>

          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent(OPEN_PALETTE_EVENT))}
            className={cn(
              "hidden h-8 items-center gap-1.5 rounded-lg px-2.5 font-mono text-xs text-foreground sm:inline-flex",
              "hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
            )}
          >
            ⌘K
            <span className="text-muted-foreground">command</span>
          </button>

          <IconButton
            variant="ghost"
            size="sm"
            label={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            icon={mode === "dark" ? <Sun aria-hidden className="size-4" /> : <Moon aria-hidden className="size-4" />}
            onClick={onToggleMode}
          />
        </div>
      }
    />
  );
}
