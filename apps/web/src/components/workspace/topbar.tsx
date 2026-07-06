"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Inbox } from "lucide-react";
import { usePulse } from "@/components/workspace/pulse-context";
import { cn } from "@/lib/utils";
import { activeSurface } from "@/lib/workspace/nav";

/**
 * Top bar: surface title, the tenant/profile switcher (feature 3 visible
 * from day one), and the needs-you badge — the 10-second rule's "what needs
 * me" answer, present on every surface.
 */
export function Topbar() {
  const pathname = usePathname();
  const { pulse, status } = usePulse();
  const surface = activeSurface(pathname);
  const needsYou = pulse?.needsYou ?? 0;

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background px-4">
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-sm font-semibold">{surface?.label ?? "Workspace"}</h1>
        {surface && (
          <p className="hidden truncate text-xs text-muted-foreground sm:block">{surface.hint}</p>
        )}
      </div>

      <Link
        href="/app/approve"
        aria-label={
          needsYou > 0 ? `${needsYou} drafts need you — open the approve queue` : "Approve queue"
        }
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors",
          "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          needsYou > 0
            ? "border-primary/40 bg-primary/15 font-medium text-primary hover:bg-primary/25"
            : "border-border text-muted-foreground hover:bg-muted",
        )}
      >
        <Inbox aria-hidden className="size-4" />
        <span className="u-tabular">{status === "success" ? needsYou : "–"}</span>
        <span className="hidden sm:inline">{needsYou === 1 ? "needs you" : "need you"}</span>
      </Link>

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
        <div className="absolute right-0 top-10 z-20 w-72 rounded-xl border border-border bg-popover p-3 text-popover-foreground shadow-lg">
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
                <Link href="/app/profiles" className="mt-1.5 inline-block text-primary hover:underline">
                  Manage profiles →
                </Link>
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
            One operated tenant per process — selected by <code className="font-mono">DEMO_TENANT_SLUG</code>.
            Operator sign-in and true switching arrive with auth.
          </p>
        </div>
      </details>
    </header>
  );
}
