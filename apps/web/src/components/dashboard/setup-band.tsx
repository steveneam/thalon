"use client";

import Link from "next/link";
import type { SetupState } from "@/components/dashboard/dashboard-model";

/**
 * The W1 sheet's setup band (Hex): "Set up your workspace · N of 4" —
 * done steps wear their ✓, the FIRST pending step is the band's one live
 * door (with the live waiting count on the approve step), later pending
 * steps rest as plain words. The × dismisses; the band never blocks
 * anything (every step is skippable — Grain's "Skip Connection" rule).
 */
export function SetupBand({ state, onDismiss }: { state: SetupState; onDismiss: () => void }) {
  const firstPending = state.steps.find((s) => !s.done)?.key ?? null;
  return (
    <div className="setup" role="status" aria-label="Workspace setup">
      <span className="t-title" style={{ fontSize: 13 }}>
        Set up your workspace
      </span>
      <span className="t-label">{`${state.doneCount} of ${state.steps.length}`}</span>
      {state.steps.map((step) =>
        step.done ? (
          <span key={step.key} className="step done">
            ✓ {step.label}
          </span>
        ) : step.key === firstPending ? (
          <Link key={step.key} className="card-link" href={step.href}>
            {step.doorLabel}
          </Link>
        ) : (
          <span key={step.key} className="step">
            {step.label}
          </span>
        ),
      )}
      <div style={{ flex: 1 }} />
      <button
        type="button"
        className="setup-x"
        title="dismiss — every step is skippable, this band never blocks"
        aria-label="Dismiss setup band"
        onClick={onDismiss}
      >
        ×
      </button>
    </div>
  );
}
