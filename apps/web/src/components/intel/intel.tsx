"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DossierCard, type DossierPick } from "@/components/intel/dossier-card";
import {
  sweepStamp,
  toDossierView,
  toRisingView,
  toWatchViews,
} from "@/components/intel/intel-model";
import { RisingCard } from "@/components/intel/rising-card";
import { SearchTab } from "@/components/intel/search-tab";
import { WatchChips } from "@/components/intel/watch-chips";
import {
  createArea,
  dismissTrend,
  fetchTrends,
  promoteTrend,
  sweepNow,
  updateArea,
} from "@/lib/intel/client";
import { useListKeys } from "@/lib/workspace/keyboard";
import type { TrendsPayload } from "@/lib/intel/types";

export type IntelTab = "trends" | "search";

type Status = "loading" | "error" | "success";

/**
 * The Intel surface, rebuilt exactly from Intel.dc.html (DOCTRINE 0 — the
 * sheet is the blueprint): the header band with its tabs and the honest
 * sweep stamp, the watching chips, ONE expanded dossier card, and the
 * bounded "More rising" list.
 *
 * What the sheet draws is what the read actually knows. The stamp names the
 * demo era while the fake-driver dataset is on screen and names the swept
 * platforms once real bundles exist (the merged multi-source read, B-learn
 * L2 slice 1 — per-source stamps ride in its hover title). Media is shown
 * when a driver captured it and left as the sheet's striped placeholder when
 * it honestly didn't. Every card action records its capture through the
 * unchanged `lib/intel` doors: promote hands Create a capture id (context is
 * never retyped), dismiss is signal rather than deletion.
 *
 * Search keeps its shipped surface behind the sheet's second tab until its
 * own sheet exists — the mock draws the tab, not the panel.
 */
export function Intel({ initialTab = "trends" }: { initialTab?: IntelTab }) {
  const router = useRouter();
  const [tab, setTab] = useState<IntelTab>(initialTab);
  const [status, setStatus] = useState<Status>("loading");
  const [payload, setPayload] = useState<TrendsPayload | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [cursorId, setCursorId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  // The clock is stamped when the read LANDS, not per render: every "3h ago"
  // on screen is "as of this read", and re-renders (typing in the add-area
  // form, moving the cursor) never shuffle the stamps underneath the operator.
  const [readAt, setReadAt] = useState(0);

  const load = useCallback(
    () =>
      fetchTrends()
        .then((data) => {
          setPayload(data);
          setReadAt(Date.now());
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

  async function withBusy(action: () => Promise<unknown>) {
    setBusy(true);
    setActionError(null);
    try {
      await action();
    } catch (err) {
      // A driver refusal surfaces VERBATIM — never a fake spinner.
      setActionError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  function selectTab(next: IntelTab) {
    setTab(next);
    // Deep links keep working (?tab=search) without a useSearchParams dance.
    window.history.replaceState(null, "", next === "trends" ? "/app/intel" : `/app/intel?tab=${next}`);
  }

  const now = readAt;
  // The read arrives score-ordered (merged across sources); the sort keeps
  // that true for the demo dataset too, so the dossier is always the top card.
  const cards = [...(payload?.cards ?? [])].sort((a, b) => b.score - a.score);
  const expanded = cards.find((c) => c.id === expandedId) ?? cards.at(0);
  const rising = cards.filter((c) => c.id !== expanded?.id);
  const stamp = payload ? sweepStamp(payload, now) : null;

  // The ONE list keyboard grammar: j/k move the selection through the rising
  // rows, ↵ opens the selected one into the dossier above.
  const moveCursor = (delta: 1 | -1) => (event: KeyboardEvent) => {
    if (rising.length === 0) return;
    event.preventDefault();
    const at = rising.findIndex((c) => c.id === cursorId);
    const next = at === -1 ? 0 : Math.min(Math.max(at + delta, 0), rising.length - 1);
    setCursorId(rising[next].id);
  };
  useListKeys({
    enabled: tab === "trends" && status === "success" && !busy,
    bindings: {
      j: moveCursor(1),
      k: moveCursor(-1),
      Enter: (event) => {
        // A focused button/link keeps its native Enter — the open shortcut
        // only claims the key when nothing interactive holds it.
        if (!cursorId) return;
        if (event.target instanceof HTMLElement && event.target.closest("button, a")) return;
        event.preventDefault();
        setExpandedId(cursorId);
      },
    },
  });

  function dismiss(cardId: string) {
    // Hand the dossier to the next card before the list reloads.
    const next = rising.at(0);
    void withBusy(async () => {
      await dismissTrend(cardId);
      setExpandedId(next ? next.id : null);
      if (cursorId === cardId) setCursorId(null);
      await load();
    });
  }

  function promote(cardId: string, pick: DossierPick) {
    void withBusy(async () => {
      const { createHref } = await promoteTrend(cardId, pick);
      router.push(createHref);
    });
  }

  return (
    <div className="content intel-surface" style={{ gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <h1 className="t-headline">Intel</h1>
        {tab === "trends" && status === "success" && (
          <span className="pill pill-idle">
            <span className="dot" style={{ background: "var(--heat-rising)" }} />
            {cards.length} rising
          </span>
        )}
        <div style={{ display: "flex", marginLeft: 10 }}>
          <button
            type="button"
            className={tab === "trends" ? "tab on" : "tab"}
            onClick={() => selectTab("trends")}
          >
            Trends
          </button>
          <button
            type="button"
            className={tab === "search" ? "tab on" : "tab"}
            onClick={() => selectTab("search")}
          >
            Search
          </button>
        </div>
        <div style={{ flex: 1 }} />
        {tab === "trends" && (
          <>
            <span className="t-label" title={stamp?.title}>
              {status === "success" && stamp ? stamp.text : "reading the sweep…"}
            </span>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={busy || status !== "success"}
              onClick={() =>
                withBusy(async () => {
                  await sweepNow();
                  await load();
                })
              }
            >
              Sweep now
            </button>
          </>
        )}
      </div>

      {tab === "search" ? (
        <SearchTab />
      ) : (
        <>
          {/* j/k moves the selection silently for screen readers without this
              (the approve queue's live-region precedent). */}
          <p aria-live="polite" className="sr-only">
            {cursorId ? `Selected: ${rising.find((c) => c.id === cursorId)?.text ?? ""}` : ""}
          </p>

          {status === "success" && payload && (
            <WatchChips
              areas={toWatchViews(payload.areas)}
              busy={busy}
              onCreate={async (input) => {
                await createArea(input);
                await load();
              }}
              onSetPaused={(areaId, paused) =>
                void withBusy(async () => {
                  await updateArea(areaId, { status: paused ? "paused" : "active" });
                  await load();
                })
              }
              onDescribe={async (areaId, description) => {
                await updateArea(areaId, { description });
                await load();
              }}
            />
          )}

          {actionError && (
            <section className="card" style={ALERT_CARD} role="alert">
              <span className="t-label" style={{ color: "var(--err)" }}>
                {actionError}
              </span>
            </section>
          )}

          {status === "loading" && (
            <section className="card" style={{ padding: "14px 16px" }} aria-label="Loading trends">
              <span className="t-label">Reading the sweep…</span>
            </section>
          )}

          {status === "error" && (
            <section className="card" style={ALERT_CARD} role="alert">
              <p className="t-title">Couldn’t read the sweep</p>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 6 }}>
                <span className="t-label">
                  This is a read failure, not a quiet watch — nothing was swept away.
                </span>
                <button type="button" className="btn btn-ghost btn-sm" onClick={retry}>
                  Try again
                </button>
              </div>
            </section>
          )}

          {status === "success" && !expanded && (
            <section className="card" style={{ padding: "14px 16px" }}>
              <p className="t-title">No cards right now — the watch is on.</p>
              <span className="t-label">
                {payload?.demo
                  ? "The demo dataset is empty once every card is dismissed. Sweep now runs the real drivers."
                  : "The last sweep found nothing above the bar. Add an area or widen one to catch more."}
              </span>
            </section>
          )}

          {status === "success" && expanded && (
            <DossierCard
              /*
                KEYED BY CARD, and this is a correctness fix, not tidiness.
                Without it React reuses one DossierCard instance across cards,
                so its titleIndex/angleIndex survive the switch: card B opens
                showing a pick the operator never made, and when B has FEWER
                titles than A the stale index is out of range — nothing renders
                checked while the label still says one always rides, and the
                promote payload carries an index the card does not have.
                Founder-reported s77; reproduced across the demo cards (4/3 vs
                3/2) before this fix.
              */
              key={expanded.id}
              card={toDossierView(expanded, now)}
              busy={busy}
              onDismiss={dismiss}
              onPromote={promote}
            />
          )}

          {status === "success" && expanded && (
            <RisingCard
              rows={rising.map((card) => toRisingView(card, now))}
              selectedId={cursorId}
              onOpen={(cardId) => {
                setExpandedId(cardId);
                setCursorId(cardId);
              }}
              onSelect={setCursorId}
            />
          )}
        </>
      )}
    </div>
  );
}

/** The honesty-card dress: the sheet's card, edged in the error channel. */
const ALERT_CARD: React.CSSProperties = {
  padding: "14px 16px",
  borderColor: "color-mix(in oklab, var(--err) 40%, var(--n-400))",
};
