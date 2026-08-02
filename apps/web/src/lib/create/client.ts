/**
 * The create-runs feed (W1 Runs re-shape): parents for the history's
 * nesting, plus the day's usage total for the footer's Clay take. Dates
 * cross the wire as ISO strings, jsonb as unknown — name only what is
 * actually there (the approve-queue types' rule).
 */

import type { GridDraft } from "@/lib/approve-queue/types";

export interface CreateChildRefWire {
  kind: "fanout_run" | "draft" | "video_project";
  id: string;
  error?: string;
}

export interface CreateRunWire {
  id: string;
  family: string;
  mode: string;
  brief: unknown;
  plan: unknown;
  children: CreateChildRefWire[];
  status: string;
  lastError: string | null;
  createdAt: string;
}

export interface UsageTodayWire {
  tokensIn: number;
  tokensOut: number;
  costEstimate: number;
}

export interface CreateRunsFeed {
  runs: CreateRunWire[];
  /** null only when no tenant resolved — a read that answered carries real sums (0 is honest). */
  usageToday: UsageTodayWire | null;
}

export async function fetchCreateRunsFeed(): Promise<CreateRunsFeed> {
  const res = await fetch("/api/create/runs");
  if (!res.ok) throw new Error(`create-runs feed read failed: ${res.status}`);
  const data = (await res.json()) as { runs?: unknown; usageToday?: UsageTodayWire | null };
  const runs = Array.isArray(data.runs) ? (data.runs as CreateRunWire[]) : [];
  // jsonb children: trust nothing — keep only well-shaped refs.
  for (const run of runs) {
    run.children = Array.isArray(run.children)
      ? run.children.filter(
          (c): c is CreateChildRefWire =>
            typeof c === "object" && c !== null && typeof (c as { id?: unknown }).id === "string",
        )
      : [];
  }
  return { runs, usageToday: data.usageToday ?? null };
}

/** The Composer's run-scoped read: one run + every draft its children produced. */
export async function fetchCreateRun(
  runId: string,
): Promise<{ run: CreateRunWire; drafts: GridDraft[] }> {
  const res = await fetch(`/api/create/runs/${encodeURIComponent(runId)}`);
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `create-run read failed: ${res.status}`);
  }
  const data = (await res.json()) as { run: CreateRunWire; drafts?: GridDraft[] };
  data.run.children = Array.isArray(data.run.children)
    ? data.run.children.filter(
        (c): c is CreateChildRefWire =>
          typeof c === "object" && c !== null && typeof (c as { id?: unknown }).id === "string",
      )
    : [];
  return { run: data.run, drafts: Array.isArray(data.drafts) ? data.drafts : [] };
}
