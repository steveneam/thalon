"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { HeatGrade } from "@/components/intel/heat-grade";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { timeAgo, timeUntil } from "@/lib/workspace/format";
import { waitingSince } from "@/lib/workspace/week";
import { cn } from "@/lib/utils";
import type { TrendsPayload } from "@/lib/intel/types";
import type { PlanPayload, PulseCounts } from "@/lib/workspace/types";

interface JourneySpineProps {
  counts: PulseCounts;
  /** null while the plan read is in flight or failed — those stations show "–". */
  plan: PlanPayload | null;
  /** null while the trends read is in flight or failed — the intel station shows "–". */
  trends: TrendsPayload | null;
  /** Pulse read still unresolved — pulse-backed counts show "–", never a real-looking zero. */
  unknown: boolean;
  /** Injectable clock for tests; renders default to the real one. */
  now?: Date;
}

const IN_FLIGHT = new Set(["generated", "judging"]);

// Operator-local timezone, resolved on the client only — the server's zone
// must never hydrate into the operator's chrome (useSyncExternalStore keeps
// the server snapshot null without an effect-driven re-render).
let cachedZone: string | null | undefined;
const subscribeNever = () => () => {};
function zoneSnapshot(): string | null {
  if (cachedZone === undefined) {
    cachedZone =
      new Intl.DateTimeFormat(undefined, { timeZoneName: "short" })
        .formatToParts(new Date())
        .find((p) => p.type === "timeZoneName")?.value ?? null;
  }
  return cachedZone;
}

/** "26h" for a past instant — the waited-duration read of timeAgo. */
function waitedFor(iso: string, now: number): string {
  const label = timeAgo(iso, now);
  return label === "just now" ? "under a minute" : label.replace(" ago", "");
}

/** The big station number, honest about unresolved reads ("–", never a fake zero). */
function StationCount({ value }: { value: number | null }) {
  return (
    <p className="u-tabular text-3xl font-semibold leading-none tracking-tight">
      {value === null ? (
        <>
          <span aria-hidden>–</span>
          <span className="sr-only">not loaded</span>
        </>
      ) : (
        value
      )}
    </p>
  );
}

/**
 * One station card. On large screens the connecting line runs above the row
 * and each card hangs a node on it; narrow screens stack the stations as
 * steps on a vertical line (the design's narrow answer).
 */
function Station({
  eyebrow,
  aside,
  signal = false,
  children,
}: {
  eyebrow: string;
  /** Top-right slot: a micro word or a chip. */
  aside?: React.ReactNode;
  /** The station wears the signal accent (work waits on the operator). */
  signal?: boolean;
  children: React.ReactNode;
}) {
  return (
    <li
      className={cn(
        "relative flex min-w-0 flex-col gap-2.5 rounded-xl border bg-card p-4",
        signal ? "border-signal/45" : "border-border",
        // The station's node: on the horizontal line above the row (large
        // screens), on the vertical line beside the steps (narrow screens).
        "before:absolute before:size-2.5 before:rounded-full before:border-2 before:bg-card before:content-['']",
        signal ? "before:border-signal" : "before:border-primary",
        "lg:before:-top-[1.45rem] lg:before:left-4",
        "max-lg:before:-left-[1.375rem] max-lg:before:top-4",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="u-eyebrow text-muted-foreground">{eyebrow}</p>
        {aside}
      </div>
      {children}
    </li>
  );
}

/** The one-item station preview — a peek, never a list (Phase D bound). */
function Peek({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-background p-2.5">
      {children}
    </div>
  );
}

/**
 * The journey spine (Phase D): the five stations ARE the dashboard — intel →
 * pick → create → approve → fan-out on a literal connecting line, each with
 * live state and at most one primary action. Full surfaces open on click;
 * amber appears only where work waits on the operator (Two-Channel Rule).
 */
export function JourneySpine({ counts, plan, trends, unknown, now }: JourneySpineProps) {
  const clock = (now ?? new Date()).getTime();

  const zone = useSyncExternalStore(subscribeNever, zoneSnapshot, () => null);

  const topCard = trends
    ? [...trends.cards].sort((a, b) => b.score - a.score)[0] ?? null
    : null;

  const inFlight = plan
    ? plan.assets
        .filter((a) => IN_FLIGHT.has(a.status))
        .sort((a, b) => b.generatedAt.localeCompare(a.generatedAt))
    : null;

  const queuedOldestFirst = plan
    ? plan.assets
        .filter((a) => a.status === "queued")
        .sort((a, b) => waitingSince(a).getTime() - waitingSince(b).getTime())
    : null;
  const oldestQueued = queuedOldestFirst?.[0] ?? null;

  const scheduled = plan ? plan.assets.filter((a) => a.status === "scheduled") : null;

  return (
    <section aria-label="Journey spine" className="relative lg:pt-6">
      {/* The literal line the stations sit on (large screens)… */}
      <div
        aria-hidden
        className="absolute left-8 right-[19.5%] top-[0.85rem] hidden h-0.5 bg-border lg:block"
      />
      <ol
        className={cn(
          "grid gap-3.5 lg:grid-cols-[1.1fr_0.9fr_1fr_1.1fr_1.1fr]",
          // …and the vertical line the steps hang from (narrow screens).
          "max-lg:relative max-lg:ml-1.5 max-lg:border-l-2 max-lg:border-border max-lg:pl-4",
        )}
      >
        <Station
          eyebrow="01 · intel"
          aside={
            trends && (
              <span className={cn("u-eyebrow", trends.demo ? "text-muted-foreground" : "text-signal")}>
                {trends.demo ? "demo" : "live"}
              </span>
            )
          }
        >
          <div>
            <StationCount value={trends ? trends.cards.length : null} />
            <p className="text-xs text-muted-foreground">
              topics rising in {trends ? trends.areas.length : "–"}{" "}
              {trends?.areas.length === 1 ? "area" : "areas"}
            </p>
          </div>
          {topCard && (
            <Peek>
              <div className="flex items-center gap-2">
                <HeatGrade score={topCard.score} detail={topCard.areaName} />
                <span className="u-eyebrow ml-auto shrink-0 text-muted-foreground">
                  rising {waitedFor(topCard.publishedAt, clock)}
                </span>
              </div>
              <p className="line-clamp-2 text-xs font-medium leading-snug">{topCard.text}</p>
            </Peek>
          )}
          {trends && (
            <p className="u-eyebrow text-muted-foreground">
              swept {timeAgo(trends.sweep.lastSweptAt, clock)}
              {trends.sweep.nextSweepAt
                ? ` · next ${timeUntil(trends.sweep.nextSweepAt, clock)}`
                : " · no next sweep until live pollers arm"}
            </p>
          )}
          <Button asChild variant="outline" size="sm" className="mt-auto self-start">
            <Link href="/app/intel">Open intel</Link>
          </Button>
        </Station>

        <Station eyebrow="02 · pick">
          <div>
            <StationCount value={null} />
            <p className="text-xs text-muted-foreground">contexts held — not tracked yet</p>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Picking happens on the intel cards — each per-family exit carries its context into
            Create. Pick is a state, not a route.
          </p>
          <p className="mt-auto text-2xs text-muted-foreground">
            a pick carries title · angle · hook · source — never retyped
          </p>
        </Station>

        <Station eyebrow="03 · create">
          <div>
            <StationCount value={inFlight ? inFlight.length : null} />
            <p className="text-xs text-muted-foreground">drafts composing now</p>
          </div>
          {inFlight?.[0] && (
            <Peek>
              <p className="text-xs font-medium">
                {inFlight[0].platform}
                {inFlight[0].format ? ` · ${inFlight[0].format}` : ""}
              </p>
              <p className="u-eyebrow text-muted-foreground">
                {inFlight[0].status === "judging" ? "at the judge gate" : "generated — judging next"}
              </p>
            </Peek>
          )}
          <Button asChild size="sm" className="mt-auto self-start">
            <Link href="/app/create">Open create</Link>
          </Button>
        </Station>

        <Station
          eyebrow="04 · approve"
          signal={!unknown && counts.queued > 0}
          aside={
            !unknown && counts.queued > 0 ? (
              <Badge variant="signal">{counts.queued} waiting</Badge>
            ) : undefined
          }
        >
          <div>
            <StationCount value={unknown ? null : counts.queued} />
            <p className="text-xs text-muted-foreground">
              {oldestQueued
                ? `oldest has waited ${waitedFor(waitingSince(oldestQueued).toISOString(), clock)}`
                : "wait on your review"}
            </p>
          </div>
          {oldestQueued && (
            <Peek>
              <p className="text-xs font-medium">
                {oldestQueued.platform}
                {oldestQueued.format ? ` · ${oldestQueued.format}` : ""}
              </p>
              {oldestQueued.gates.length > 0 && (
                <p className="u-eyebrow text-muted-foreground">
                  {oldestQueued.gates.map((g) => `${g.gate} · ${g.verdict}`).join("  ")}
                </p>
              )}
            </Peek>
          )}
          {!unknown && counts.blocked > 0 && (
            <p className="u-eyebrow text-muted-foreground">
              {counts.blocked} more blocked by the judge — reasons attached
            </p>
          )}
          <Button asChild size="sm" className="mt-auto self-start">
            <Link href="/app/approve">Review queue</Link>
          </Button>
        </Station>

        <Station
          eyebrow="05 · fan-out"
          aside={
            zone && (
              <Badge variant="outline" className="font-mono" title="All times operator-local">
                {zone}
              </Badge>
            )
          }
        >
          <div>
            <StationCount value={scheduled ? scheduled.length : null} />
            <p className="text-xs text-muted-foreground">slots planned</p>
          </div>
          {scheduled && scheduled.length === 0 && (
            <p className="text-xs leading-relaxed text-muted-foreground">
              {unknown ? "" : counts.approved > 0 ? `${counts.approved} approved and ready to plan. ` : ""}
              Nothing is scheduled — planning lands with the calendar.
            </p>
          )}
          <p className="mt-auto text-2xs text-muted-foreground">
            publish door unarmed — these are plans, not uploads
          </p>
          <Button asChild variant="outline" size="sm" className="self-start">
            <Link href="/app/calendar">Open calendar</Link>
          </Button>
        </Station>
      </ol>
    </section>
  );
}
