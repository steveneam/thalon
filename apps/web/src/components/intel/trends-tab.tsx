"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AreasManager } from "@/components/intel/areas-manager";
import { CadenceStamp } from "@/components/intel/cadence-stamp";
import { DemoBanner } from "@/components/intel/demo-banner";
import { TrendCard } from "@/components/intel/trend-card";
import { EmptyArt } from "@/components/ui/empty-art";
import { Skeleton } from "@/components/ui/skeleton";
import { ActionToast, type ToastState } from "@/components/workspace/action-toast";
import { BulkBar } from "@/components/workspace/bulk-bar";
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
  // Multi-select for bulk Dismiss (FRONTEND §0 parity, s40) + the terminal-
  // action toast confirming what left the list.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<ToastState | null>(null);
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

  function onSelect(cardId: string, isSelected: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (isSelected) next.add(cardId);
      else next.delete(cardId);
      return next;
    });
  }

  // Bulk Dismiss (s40 parity; BulkBar carries the ONE named confirm).
  // Sequential through the same single-card endpoint — a failure surfaces
  // with how far it got; the reload shows the true remainder.
  function onBulkDismiss() {
    const ids = [...selected];
    void withBusy(async () => {
      let done = 0;
      const failures: string[] = [];
      for (const id of ids) {
        try {
          await dismissTrend(id);
          done += 1;
        } catch (err) {
          failures.push(err instanceof Error ? err.message : "dismiss failed");
        }
      }
      setSelected(new Set());
      await reload();
      if (failures.length > 0) {
        throw new Error(`Dismissed ${done}; ${failures.length} failed (${failures[0]})`);
      }
      setToast({ message: `Dismissed ${done} card${done === 1 ? "" : "s"}.` });
    });
  }
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

          <BulkBar
            count={selected.size}
            busy={busy}
            actionLabel="Dismiss selected"
            confirmMessage={`Dismiss ${selected.size} selected card${selected.size === 1 ? "" : "s"}?`}
            onAction={onBulkDismiss}
            onClear={() => setSelected(new Set())}
          />

          {filtered.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-4">
              {!filter && <EmptyArt asset="emptyTrends" />}
              <p className="text-center text-sm text-muted-foreground">
                No cards {filter ? `for “${filter}” yet — its first live poll hasn’t landed` : "right now — the watch is on"}.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 xl:grid-cols-2">
              {filtered.map((card) => (
                <TrendCard
                  key={card.id}
                  card={card}
                  selected={selected.has(card.id)}
                  busy={busy}
                  onSelect={onSelect}
                  onPromote={(cardId, pick) =>
                    withBusy(async () => {
                      const { createHref } = await promoteTrend(cardId, pick);
                      router.push(createHref);
                    })
                  }
                  onDismiss={(cardId) =>
                    withBusy(async () => {
                      await dismissTrend(cardId);
                      onSelect(cardId, false);
                      await reload();
                      setToast({ message: "Card dismissed." });
                    })
                  }
                />
              ))}
            </div>
          )}
        </>
      )}
      <ActionToast toast={toast} onClear={() => setToast(null)} />
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
