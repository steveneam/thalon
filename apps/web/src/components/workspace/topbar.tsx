"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { OPEN_PALETTE_EVENT } from "@/components/workspace/command-palette";
import { usePulse } from "@/components/workspace/pulse-context";
import { cn } from "@/lib/utils";
import { activeSurface } from "@/lib/workspace/nav";

/**
 * Top bar (Phase D spine design): tenant switcher first — whose workspace
 * this is — then the surface title, then the two global affordances every
 * surface carries: the needs-you chip (signal channel, the 10-second rule's
 * "what needs me") and the command palette.
 */
export function Topbar() {
  const pathname = usePathname();
  const { pulse, status } = usePulse();
  const surface = activeSurface(pathname);
  const needsYou = pulse?.needsYou ?? 0;

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background px-4">
      {/* Tenant/profile switcher — <details> keeps it dependency-free and
          accessible. One tenant per process today (DEMO_TENANT_SLUG, B2.1);
          the menu says so honestly instead of faking a multi-tenant list. */}
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
          <ChevronDown aria-hidden className="size-3.5 text-muted-foreground transition-transform group-open:rotate-180" />
        </summary>
        <div className="absolute left-0 top-10 z-20 w-72 rounded-xl border border-border bg-popover p-3 text-popover-foreground shadow-lg">
          {pulse?.tenant ? (
            <>
              <p className="text-sm font-medium">{pulse.tenant.name}</p>
              <p className="u-eyebrow mt-0.5 text-muted-foreground">slug · {pulse.tenant.slug}</p>
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
                      alone wasn't findable) — the rail keeps its gear. */}
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

      <h1 className="min-w-0 truncate text-sm font-semibold">
        {surface?.label ?? "Workspace"}
      </h1>

      <div className="flex-1" />

      <Link
        href="/app/approve"
        aria-label={
          needsYou > 0 ? `${needsYou} items need you — open the approve queue` : "Approve queue"
        }
        className={cn(
          "inline-flex h-6 items-center gap-1 rounded-4xl px-2.5 text-xs font-medium transition-colors",
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
            needs you · <span className="u-tabular">{status === "success" ? needsYou : "–"}</span>
          </>
        )}
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
    </header>
  );
}
