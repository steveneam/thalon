"use client";

import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LeadCard, LearnedWeightsInfo } from "@/lib/leads/types";
import { timeAgo } from "@/lib/workspace/format";

/** Render order matches the scorer's signal order — stable, never alphabetized. */
const SIGNAL_ORDER = ["relevance", "fit", "completeness", "recency"] as const;

interface WeightsProvenanceProps {
  info: LearnedWeightsInfo;
  /** The full card list — per-card weightStateId says what the LAST score actually applied. */
  leads: LeadCard[];
  busy: boolean;
  onLearn: () => void;
}

/**
 * B-crm.5 provenance (quiet panel, secondary information): whether scores
 * ride base weights or a learned state — state id/age, evidence size, and
 * the per-signal multipliers. Cards carry the state their latest score
 * APPLIED, so the panel can say honestly when scored leads lag the current
 * state (amber signal — Score now refreshes; learning never auto-scores).
 */
export function WeightsProvenance({ info, leads, busy, onLearn }: WeightsProvenanceProps) {
  const state = info.state;
  const scored = leads.filter((l) => l.status === "scored" && l.score !== null);
  const lagging = state ? scored.filter((l) => l.weightStateId !== state.id).length : 0;

  return (
    <section
      data-testid="weights-provenance"
      aria-label="Scoring weight provenance"
      className="flex flex-col gap-1 rounded-lg border border-border bg-muted/40 p-2.5 text-xs text-muted-foreground"
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="u-eyebrow">scoring weights</span>
        {state ? (
          <span>
            <strong className="font-medium text-foreground">Learned</strong> · state{" "}
            <span className="font-mono">{state.id.slice(0, 8)}</span> · {timeAgo(state.computedAt)}{" "}
            · from {state.verdicts} verdict{state.verdicts === 1 ? "" : "s"} ({state.rows} triage
            row{state.rows === 1 ? "" : "s"})
          </span>
        ) : (
          <strong className="font-medium text-foreground">Base weights</strong>
        )}
        <span className="ml-auto">
          <Button size="sm" variant="outline" disabled={busy} onClick={onLearn}>
            <SlidersHorizontal aria-hidden className="size-3.5" /> Learn from feedback
          </Button>
        </span>
      </div>
      {state && (
        <p>
          {SIGNAL_ORDER.map((signal, i) => (
            <span key={signal}>
              {i > 0 && " · "}
              {signal} <span className="font-mono">×{state.multipliers[signal].toFixed(2)}</span>
            </span>
          ))}
        </p>
      )}
      {state && scored.length > 0 && (
        <p>
          {lagging === 0 ? (
            <>applied to all {scored.length} scored lead{scored.length === 1 ? "" : "s"}</>
          ) : (
            <span className="text-signal">
              {lagging} of {scored.length} scored lead{scored.length === 1 ? "" : "s"} riding older
              weights — Score now refreshes them
            </span>
          )}
        </p>
      )}
      {!state &&
        (info.staleForProfile ? (
          <p className="text-signal">
            The ICP changed since weights were last learned — scores ride base weights until the
            loop re-runs.
          </p>
        ) : (
          <p>Every dismiss and hot-pick is a verdict the loop can learn from.</p>
        ))}
    </section>
  );
}
