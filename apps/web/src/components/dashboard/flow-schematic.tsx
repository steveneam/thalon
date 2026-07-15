"use client";

import Link from "next/link";
import { EmptyArt } from "@/components/ui/empty-art";
import { timeUntil } from "@/lib/workspace/format";
import { sweepOverdue } from "@/lib/workspace/week";
import { cn } from "@/lib/utils";
import type { PlanPayload, PulseCounts } from "@/lib/workspace/types";
import type { WorkspaceAssetKey } from "@/lib/brand-assets";

interface FlowSchematicProps {
  counts: PulseCounts;
  /** null while the plan read is in flight or failed — those stations show "–". */
  plan: PlanPayload | null;
  /** Pulse read still unresolved — every count shows "–", never a real-looking zero. */
  unknown: boolean;
}

interface Station {
  key: string;
  eyebrow: string;
  title: string;
  href: string;
  art: WorkspaceAssetKey;
  /** null renders "–" (loading/error/plan-missing — the honest-states rule). */
  count: number | null;
  /** What the count counts. */
  unit: string;
  /** One honest state line under the count. */
  sub: string | null;
  /** The line belongs to the signal channel (waits on the operator). */
  signal?: boolean;
  /** The line reports a failure. */
  alert?: boolean;
}

/** The connector between stations: a drafted ink stroke with an arrowhead, drawn once on mount (reduced-motion renders it complete). */
function FlowArrow() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 40 24"
      className="h-6 w-10 shrink-0 self-center text-border"
      fill="none"
    >
      <path
        d="M2 12h30m0 0-6-5m6 5-6 5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="anim-draw"
        style={{ "--draw-length": 48 } as React.CSSProperties}
      />
    </svg>
  );
}

/**
 * Dashboard v3's spine: the engine's working diagram — intel → create →
 * judge → approve → distribute — with the live counts riding their stations
 * (founder direction, session 38; doubles as the concept-film storyboard).
 * Every station is a doorway to its surface; amber appears only where work
 * waits on the operator (Two-Channel Rule); unknown reads render "–".
 */
export function FlowSchematic({ counts, plan, unknown }: FlowSchematicProps) {
  const published = plan ? plan.assets.filter((a) => a.publishedAt !== null).length : null;

  const stations: Station[] = [
    {
      key: "intel",
      eyebrow: "01 · Intel",
      title: "Watch",
      href: "/app/intel",
      art: "emptyTrends",
      count: plan ? plan.areas : null,
      unit: "areas watched",
      sub: plan
        ? plan.sweep
          ? sweepOverdue(plan.sweep, new Date())
            ? "sweeps overdue — poller quiet"
            : `next sweep ${timeUntil(plan.sweep.nextSweepAt)}`
          : "no live sweeps armed yet"
        : null,
    },
    {
      key: "create",
      eyebrow: "02 · Create",
      title: "Draft",
      href: "/app/runs",
      art: "stepProfile",
      count: unknown ? null : counts.runs,
      unit: "recent runs",
      sub: unknown ? null : counts.runsWithErrors > 0 ? `${counts.runsWithErrors} failed — triage` : `${counts.drafts} drafts fanned out`,
      alert: !unknown && counts.runsWithErrors > 0,
    },
    {
      key: "judge",
      eyebrow: "03 · Judge",
      title: "Gate",
      href: "/app/approve",
      art: "emptySearch",
      count: unknown ? null : counts.blocked,
      unit: "blocked",
      sub: unknown ? null : counts.blocked > 0 ? "need your edit" : "gates clear",
      signal: !unknown && counts.blocked > 0,
    },
    {
      key: "approve",
      eyebrow: "04 · Approve",
      title: "Release",
      href: "/app/approve",
      art: "emptyApprove",
      count: unknown ? null : counts.queued,
      unit: "queued",
      sub: unknown ? null : counts.queued > 0 ? "wait on your review" : "inbox clear",
      signal: !unknown && counts.queued > 0,
    },
    {
      key: "distribute",
      eyebrow: "05 · Distribute",
      title: "Publish",
      href: "/blog",
      art: "stepRelease",
      count: published,
      unit: "pages live",
      sub: plan ? "own site today · social lands later" : null,
    },
  ];

  return (
    <section
      aria-label="Workflow"
      className="relative overflow-hidden rounded-xl border border-border bg-card"
    >
      {/* Drafting-sheet furniture: a faint survey ring + registration marks.
          Pure decoration on the ink channel — never signal, never interactive. */}
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full text-foreground opacity-[0.04]"
        fill="none"
      >
        <circle cx="50%" cy="120%" r="52%" stroke="currentColor" strokeWidth="1" strokeDasharray="3 7" />
        <circle cx="50%" cy="120%" r="40%" stroke="currentColor" strokeWidth="1" />
        <path d="M16 16v8M12 20h8" stroke="currentColor" strokeWidth="1" />
        <path d="M-8 0l40 40M-8 12l28 28" stroke="currentColor" strokeWidth="1" />
      </svg>

      <div className="overflow-x-auto">
        <ol className="flex min-w-[640px] items-stretch justify-between gap-1 px-4 pb-8 pt-4 lg:px-6">
          {stations.map((station, i) => (
            <li key={station.key} className="flex min-w-0 flex-1 items-stretch">
              {i > 0 && <FlowArrow />}
              <Link
                href={station.href}
                className="group flex min-w-0 flex-1 flex-col items-center gap-1 rounded-lg px-2 py-2 text-center transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {/* Fixed-height plate box: the minted plates mix 1:1 and 3:2
                    aspects — without this the station baselines wobble. The
                    tighter mask override keeps the plate's paper field from
                    reading as a beige thumbnail box at this tiny scale. */}
                <span className="flex h-14 items-center justify-center">
                  <EmptyArt
                    asset={station.art}
                    size="xs"
                    className="max-h-14 w-auto opacity-90 transition-opacity group-hover:opacity-100 [mask-image:radial-gradient(ellipse_62%_62%_at_50%_50%,black_35%,transparent_78%)]"
                  />
                </span>
                <p className="u-eyebrow text-muted-foreground">
                  {station.eyebrow}
                  <span className="sr-only">:</span>
                </p>
                <p
                  className={cn(
                    "u-tabular text-2xl font-semibold leading-none",
                    station.signal && "text-signal",
                    station.alert && "text-destructive",
                  )}
                >
                  {station.count === null ? (
                    <>
                      <span aria-hidden>–</span>
                      <span className="sr-only">not loaded</span>
                    </>
                  ) : (
                    station.count
                  )}
                  {/* Separator so the accessible name never fuses count into unit ("1areas watched"). */}
                  <span className="sr-only">,</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {station.unit}
                  <span className="sr-only">.</span>
                </p>
                {station.sub && (
                  <p
                    className={cn(
                      "text-2xs",
                      station.signal
                        ? "font-medium text-signal"
                        : station.alert
                          ? "font-medium text-destructive"
                          : "text-muted-foreground",
                    )}
                  >
                    {station.sub}
                  </p>
                )}
              </Link>
            </li>
          ))}
        </ol>
      </div>

      {/* The sheet's title block — the storyboard frame the concept film reuses. */}
      <p
        aria-hidden="true"
        className="pointer-events-none absolute bottom-2 right-4 font-mono text-2xs tracking-[0.18em] text-muted-foreground/70"
      >
        THALON · WORKING DIAGRAM · SHEET 01
      </p>
    </section>
  );
}
