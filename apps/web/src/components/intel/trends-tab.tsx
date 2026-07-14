"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AreasManager } from "@/components/intel/areas-manager";
import { CadenceStamp } from "@/components/intel/cadence-stamp";
import { DemoBanner } from "@/components/intel/demo-banner";
import { TrendCard } from "@/components/intel/trend-card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorNotice } from "@/components/workspace/error-notice";
import { cn } from "@/lib/utils";
import { createArea, dismissTrend, fetchTrends, promoteTrend, sweepNow, updateArea } from "@/lib/intel/client";
import type { TrendsPayload } from "@/lib/intel/types";

type TabStatus = "loading" | "error" | "success";

/**
 * Trends: monitored-areas manager (real repo rows) + ranked cards with
 * plain-language reasons. Area filtering is CLIENT-side over the cards
 * (B6.4: ranked is per item × area — no extra engine call).
 */
export function TrendsTab() {
  const router = useRouter();
  const [status, setStatus] = useState<TabStatus>("loading");
  const [payload, setPayload] = useState<TrendsPayload | null>(null);
  const [filter, setFilter] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(
    () =>
      fetchTrends()
        .then((data) => {
          setPayload(data);
          setStatus("success");
        })
        .catch(() => {
          setStatus("error");
        }),
    [],
  );

  useEffect(() => {
    void load();
  }, [load]);

  function retry() {
    setStatus("loading");
    void load();
  }

  async function reload() {
    setPayload(await fetchTrends());
  }

  async function withBusy(action: () => Promise<unknown>) {
    setBusy(true);
    setActionError(null);
    try {
      await action();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  const cards = payload?.cards ?? [];
  const cardAreaNames = [...new Set(cards.map((c) => c.areaName))];
  const filtered = filter ? cards.filter((c) => c.areaName === filter) : cards;
  // Chips: every area name present in cards + every REAL area (which may
  // have zero cards until B6.5 polls it — the seam stays visible).
  const chipNames = [
    ...new Set([...cardAreaNames, ...(payload?.areas ?? []).map((a) => a.name)]),
  ];

  return (
    <div className="flex flex-col gap-4">
      {status === "loading" && (
        <div className="flex flex-col gap-3" aria-label="Loading trends">
          <Skeleton className="h-4 w-72" />
          <div className="grid gap-3 xl:grid-cols-2">
            <Skeleton className="h-40" />
            <Skeleton className="h-40" />
          </div>
        </div>
      )}
      {status === "error" && <ErrorNotice message="Couldn’t load trends." onRetry={retry} />}
      {status === "success" && payload && (
        <>
          <CadenceStamp
            sweep={payload.sweep}
            busy={busy}
            onSweepNow={() =>
              withBusy(async () => {
                await sweepNow();
                await reload();
              })
            }
          />

          <AreasManager
            areas={payload.areas}
            busy={busy}
            onCreate={async (input) => {
              await createArea(input);
              await reload();
            }}
            onUpdate={async (areaId, patch) => {
              await withBusy(async () => {
                await updateArea(areaId, patch);
                await reload();
              });
            }}
          />

          {payload.demo && (
            <DemoBanner arming="Live per-area polling isn’t switched on yet — these ranked cards show the exact shape it produces, reasons included." />
          )}

          <div role="group" aria-label="Filter by area" className="flex flex-wrap gap-1.5">
            <FilterChip label="All" active={filter === null} onClick={() => setFilter(null)} count={cards.length} />
            {chipNames.map((name) => (
              <FilterChip
                key={name}
                label={name}
                active={filter === name}
                onClick={() => setFilter(filter === name ? null : name)}
                count={cards.filter((c) => c.areaName === name).length}
              />
            ))}
          </div>

          {actionError && (
            <p role="alert" className="text-sm text-destructive">
              {actionError}
            </p>
          )}

          {filtered.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
              No cards {filter ? `for “${filter}” yet — its first live poll hasn’t landed` : "right now"}.
            </p>
          ) : (
            <div className="grid gap-3 xl:grid-cols-2">
              {filtered.map((card) => (
                <TrendCard
                  key={card.id}
                  card={card}
                  busy={busy}
                  onPromote={(cardId, pick) =>
                    withBusy(async () => {
                      const { createHref } = await promoteTrend(cardId, pick);
                      router.push(createHref);
                    })
                  }
                  onDismiss={(cardId) =>
                    withBusy(async () => {
                      await dismissTrend(cardId);
                      await reload();
                    })
                  }
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function FilterChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-full border px-3 text-xs transition-colors",
        "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        active
          ? "border-primary/40 bg-primary/15 font-medium text-primary"
          : "border-border text-muted-foreground hover:bg-muted",
      )}
    >
      {label}
      <span className="u-tabular">{count}</span>
    </button>
  );
}
