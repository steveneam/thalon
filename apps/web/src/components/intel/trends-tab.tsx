"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CadenceStamp } from "@/components/intel/cadence-stamp";
import { RisingList } from "@/components/intel/rising-list";
import { TrendCard } from "@/components/intel/trend-card";
import { Watchlist } from "@/components/intel/watchlist";
import { Badge } from "@/components/ui/badge";
import { EmptyArt } from "@/components/ui/empty-art";
import { Skeleton } from "@/components/ui/skeleton";
import { ActionToast, type ToastState } from "@/components/workspace/action-toast";
import { BulkBar } from "@/components/workspace/bulk-bar";
import { ErrorNotice } from "@/components/workspace/error-notice";
import { createArea, dismissTrend, fetchTrends, promoteTrend, sweepNow, updateArea } from "@/lib/intel/client";
import { useListKeys } from "@/lib/workspace/keyboard";
import type { TrendsPayload } from "@/lib/intel/types";

type TabStatus = "loading" | "error" | "success";

/**
 * Trends as the dossier launchpad (Phase D design #4): ONE expanded dossier
 * card at a time, the rest as compact rows in a bounded rising list; the
 * header stamps cadence + rising count and the watchlist chips manage areas
 * in place. Cards sort by rank score (presentation-side — the ranked payload
 * is per item × area, no extra engine call). Keyboard grammar (useListKeys):
 * j/k move the cursor, enter expands it, x picks for bulk, d = Dismiss (the
 * surface's Four-Verbs word — the symmetric capture door, s52).
 */
export function TrendsTab() {
  const router = useRouter();
  const [status, setStatus] = useState<TabStatus>("loading");
  const [payload, setPayload] = useState<TrendsPayload | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [cursorId, setCursorId] = useState<string | null>(null);
  // Multi-select for bulk Dismiss (FRONTEND §0 parity, s40) + the terminal-
  // action toast confirming what left the list.
  const [picked, setPicked] = useState<Set<string>>(new Set());
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

  const cards = [...(payload?.cards ?? [])].sort((a, b) => b.score - a.score);
  // One card expands at a time; both cursor and dossier fall back to the
  // top-ranked card, so a dismissed launchpad hands over to the next one.
  const expanded = cards.find((c) => c.id === expandedId) ?? cards.at(0);
  const cursor = cards.find((c) => c.id === cursorId) ?? expanded;
  const risingRows = cards.filter((c) => c.id !== expanded?.id);
  const visualOrder = expanded ? [expanded, ...risingRows] : [];

  function onPick(cardId: string, isPicked: boolean) {
    setPicked((current) => {
      const next = new Set(current);
      if (isPicked) next.add(cardId);
      else next.delete(cardId);
      return next;
    });
  }

  function dismissCard(cardId: string) {
    // Hand the cursor to the neighbouring row before the list reloads.
    const at = visualOrder.findIndex((c) => c.id === cardId);
    const next = visualOrder[at + 1] ?? visualOrder[at - 1];
    void withBusy(async () => {
      await dismissTrend(cardId);
      onPick(cardId, false);
      setCursorId(next ? next.id : null);
      await reload();
      setToast({ message: "Card dismissed." });
    });
  }

  // Bulk Dismiss (s40 parity; BulkBar carries the ONE named confirm).
  // Sequential through the same single-card endpoint — a failure surfaces
  // with how far it got; the reload shows the true remainder.
  function onBulkDismiss() {
    const ids = [...picked];
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
      setPicked(new Set());
      await reload();
      if (failures.length > 0) {
        throw new Error(`Dismissed ${done}; ${failures.length} failed (${failures[0]})`);
      }
      setToast({ message: `Dismissed ${done} card${done === 1 ? "" : "s"}.` });
    });
  }

  const moveCursor = (delta: 1 | -1) => (event: KeyboardEvent) => {
    if (visualOrder.length === 0) return;
    event.preventDefault();
    const at = visualOrder.findIndex((c) => c.id === cursor?.id);
    const next = at === -1 ? 0 : Math.min(Math.max(at + delta, 0), visualOrder.length - 1);
    setCursorId(visualOrder[next].id);
  };
  useListKeys({
    enabled: status === "success" && !busy,
    bindings: {
      j: moveCursor(1),
      k: moveCursor(-1),
      Enter: (event) => {
        // A focused button/link keeps its native Enter activation — the
        // expand shortcut only claims the key when nothing interactive has it.
        if (!cursor) return;
        if (event.target instanceof HTMLElement && event.target.closest("button, a, [role='radio']")) return;
        event.preventDefault();
        setExpandedId(cursor.id);
      },
      x: (event) => {
        if (!cursor) return;
        event.preventDefault();
        onPick(cursor.id, !picked.has(cursor.id));
      },
      d: (event) => {
        if (!cursor) return;
        event.preventDefault();
        dismissCard(cursor.id);
      },
    },
  });

  return (
    <div className="flex flex-col gap-4">
      {/* j/k moves the cursor silently for screen readers without this
          (the approve queue's live-region precedent). */}
      <p aria-live="polite" className="sr-only">
        {cursor ? `Selected: ${cursor.text}` : ""}
      </p>
      {status === "loading" && (
        <div className="flex flex-col gap-3" aria-label="Loading trends">
          <Skeleton className="h-4 w-72" />
          <Skeleton className="h-72" />
        </div>
      )}
      {status === "error" && <ErrorNotice message="Couldn’t load trends." onRetry={retry} />}
      {status === "success" && payload && (
        <div className="flex flex-col rounded-xl border border-border bg-card">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-border px-4 py-3">
            <Badge variant="signal">{cards.length} rising</Badge>
            <CadenceStamp
              sweep={payload.sweep}
              demo={payload.demo}
              busy={busy}
              onSweepNow={() =>
                withBusy(async () => {
                  await sweepNow();
                  await reload();
                })
              }
            />
            <p className="u-eyebrow ml-auto hidden text-muted-foreground md:block">
              keys · j/k card · enter expand · x pick · d dismiss
            </p>
          </div>

          <Watchlist
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

          <div className="flex flex-col gap-3 p-4">
            {actionError && (
              <p role="alert" className="text-sm text-destructive">
                {actionError}
              </p>
            )}

            {!expanded ? (
              <div className="rounded-lg border border-dashed border-border p-4">
                <EmptyArt asset="emptyTrends" />
                <p className="text-center text-sm text-muted-foreground">
                  No cards right now — the watch is on.
                </p>
              </div>
            ) : (
              <>
                <TrendCard
                  card={expanded}
                  selected={picked.has(expanded.id)}
                  cursor={cursor?.id === expanded.id}
                  busy={busy}
                  onSelect={onPick}
                  onPromote={(cardId, pick) =>
                    withBusy(async () => {
                      const { createHref } = await promoteTrend(cardId, pick);
                      router.push(createHref);
                    })
                  }
                  onDismiss={dismissCard}
                />
                <RisingList
                  rows={risingRows}
                  cursorId={cursor?.id !== expanded.id ? (cursor?.id ?? null) : null}
                  picked={picked}
                  busy={busy}
                  onOpen={(cardId) => {
                    setExpandedId(cardId);
                    setCursorId(cardId);
                  }}
                  onPick={onPick}
                />
              </>
            )}
          </div>
        </div>
      )}

      <BulkBar
        count={picked.size}
        busy={busy}
        actionLabel="Dismiss selected"
        confirmMessage={`Dismiss ${picked.size} selected card${picked.size === 1 ? "" : "s"}?`}
        onAction={onBulkDismiss}
        onClear={() => setPicked(new Set())}
      />
      <ActionToast toast={toast} onClear={() => setToast(null)} />
    </div>
  );
}
