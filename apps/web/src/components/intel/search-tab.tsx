"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  addTarget,
  fetchHorizon,
  fetchTargets,
  setTargetStatus,
  targetThis,
} from "@/lib/intel/client";
import type { HorizonCard, HorizonPayload, TargetRow } from "@/lib/intel/types";

type TabStatus = "loading" | "error" | "success";

/** Provenance labels for the origin pill — first origin wins, so the label is durable. */
const ORIGIN_LABEL: Record<TargetRow["origin"], string> = {
  profile_seed: "profile seed",
  ai_expansion: "ai expansion",
  operator: "operator",
};

function fmt(value: number | null, digits = 2): string {
  return value === null ? "–" : value.toFixed(digits);
}

/**
 * Search (Intel's second half, A13): keyword targets + horizon opportunities.
 *
 * `Intel.dc.html` draws this TAB but no Search panel, so there is no sheet to
 * port (the intel lane flagged it, founder s74: "the search tab also needs a
 * consistent redesign"). This is therefore the one Intel surface DESIGNED
 * rather than ported — and it is built strictly out of the language the
 * sheets already established, so it reads as the same product:
 *
 *  - the shared shell classes (.card, .card-head, .row, .pill, .btn, the
 *    type roles) exactly as every ported surface uses them;
 *  - Intel's OWN ported atomics beside it — `.sec-label` for a band label,
 *    `.prov` for a provenance/metrics strip, `.input` for the add field —
 *    so Search wears the Trends tab's grammar, not a second dialect;
 *  - the horizon card is the dossier's shape applied to search demand: what
 *    it is, the numbers behind it, why the math flagged it, and one exit.
 *
 * Honesty rules carried from the ported surfaces: the metrics strip states
 * real numbers or "–", never a fabricated zero; every reason is VERBATIM
 * from the horizon math (never model vibes); the demo era is named in the
 * band itself rather than implied live; and no magnitude bar appears
 * anywhere, because position/CTR have no honest 0–1 scale to draw one from.
 */
export function SearchTab() {
  const router = useRouter();
  const [status, setStatus] = useState<TabStatus>("loading");
  const [targets, setTargets] = useState<TargetRow[]>([]);
  const [horizon, setHorizon] = useState<HorizonPayload | null>(null);
  const [keyword, setKeyword] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(
    () =>
      Promise.all([fetchTargets(), fetchHorizon()])
        .then(([targetRows, horizonPayload]) => {
          setTargets(targetRows);
          setHorizon(horizonPayload);
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

  async function submitAdd(event: React.FormEvent) {
    event.preventDefault();
    await withBusy(async () => {
      await addTarget(keyword);
      setKeyword("");
      setTargets(await fetchTargets());
    });
  }

  if (status === "loading") {
    return (
      <div className="card">
        <div className="row">
          <span className="t-label">Reading your targets and the horizon…</span>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="card" role="alert">
        <div className="row">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="t-title">Couldn’t read search intel</div>
            <div className="t-label">
              This is a read failure, not an empty horizon — nothing has been dismissed.
            </div>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setStatus("loading");
              void load();
            }}
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  const active = targets.filter((t) => t.status === "active");
  const cards = horizon?.cards ?? [];

  return (
    <>
      <div className="card">
        <div className="card-head">
          <span className="t-title">Keyword targets</span>
          <span className="pill pill-idle">{active.length} active</span>
          <div style={{ flex: 1 }} />
          <span className="t-label">
            the searches you deliberately target · a dismissal survives recompiles
          </span>
        </div>

        {targets.length === 0 ? (
          <div className="row">
            <span className="t-label">
              No targets yet — add the searches you want to win, e.g. “ai content automation for
              startups”.
            </span>
          </div>
        ) : (
          <div className="card-rows">
            {targets.map((target) => {
              const dismissed = target.status === "dismissed";
              return (
                <div key={target.id} className={dismissed ? "row target-off" : "row"}>
                  <span className="t-data" style={{ fontSize: 12.5, color: "var(--n-1000)" }}>
                    {target.keyword}
                  </span>
                  <span className="pill pill-idle">{ORIGIN_LABEL[target.origin]}</span>
                  {dismissed && <span className="pill pill-idle">dismissed</span>}
                  <div style={{ flex: 1 }} />
                  <button
                    type="button"
                    className="btn btn-quiet btn-sm"
                    disabled={busy}
                    // The visible word is short; the accessible name keeps the
                    // keyword so rows stay distinguishable when there are many.
                    aria-label={
                      dismissed
                        ? `Reactivate target ${target.keyword}`
                        : `Dismiss target ${target.keyword}`
                    }
                    onClick={() =>
                      withBusy(async () => {
                        await setTargetStatus(target.id, dismissed ? "active" : "dismissed");
                        setTargets(await fetchTargets());
                      })
                    }
                  >
                    {dismissed ? "Restore" : "Dismiss"}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <form className="row" onSubmit={submitAdd}>
          <input
            className="input"
            style={{ flex: 1 }}
            aria-label="New keyword target"
            placeholder="Add a keyword to target"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
          <button type="submit" className="btn btn-primary btn-sm" disabled={busy || !keyword.trim()}>
            Add target
          </button>
        </form>
        {actionError && (
          <div className="row" role="alert">
            <span className="t-label" style={{ color: "var(--err)" }}>
              {actionError}
            </span>
          </div>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span className="t-title">Peering over the horizon</span>
        <div style={{ flex: 1 }} />
        <span className="t-label">
          {horizon?.demo
            ? "demo dataset — Search Console polling arms once the site is deployed and verified"
            : "position 8–20 · impressions rising · CTR below what the position should earn"}
        </span>
      </div>

      {cards.length === 0 ? (
        <div className="card">
          <div className="row">
            <span className="t-label">
              Nothing on the horizon yet — queries appear here once there are enough snapshots to
              compare.
            </span>
          </div>
        </div>
      ) : (
        <div className="horizon-grid">
          {cards.map((card) => (
            <HorizonOpportunity
              key={`${card.query}:${card.page}`}
              card={card}
              busy={busy}
              onTarget={(query) =>
                withBusy(async () => {
                  const { createHref } = await targetThis(query);
                  router.push(createHref);
                })
              }
            />
          ))}
        </div>
      )}
    </>
  );
}

/**
 * One (query × page) series in the dossier's shape: the query, the numbers,
 * the math's own reasons, one exit. Every number is real or "–".
 */
function HorizonOpportunity({
  card,
  busy,
  onTarget,
}: {
  card: HorizonCard;
  busy: boolean;
  onTarget: (query: string) => void;
}) {
  return (
    <div className="card" data-testid={`horizon-${card.query}`}>
      <div className="card-head">
        <span className="t-data" style={{ fontSize: 13, color: "var(--n-1000)" }}>
          “{card.query}”
        </span>
        <div style={{ flex: 1 }} />
        <span className={card.isOpportunity ? "pill pill-ok" : "pill pill-idle"}>
          {card.isOpportunity
            ? "horizon opportunity"
            : card.reasons.length > 0
              ? "partial signal"
              : "no signal"}
        </span>
      </div>

      <div style={{ padding: "10px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
        <div className="prov">
          <span>position {fmt(card.position, 1)}</span>
          <span>·</span>
          <span>
            {card.latestImpressions ?? "–"} impressions
            {card.impressionsGrowth !== null && ` (${fmt(card.impressionsGrowth)}×)`}
          </span>
          <span>·</span>
          <span>
            CTR {fmt(card.ctr, 4)}
            {card.expectedCtr !== null && ` vs ${fmt(card.expectedCtr, 4)} expected`}
          </span>
          <span>·</span>
          <span>
            {card.snapshots} snapshot{card.snapshots === 1 ? "" : "s"}
          </span>
          {card.page && (
            <>
              <span>·</span>
              <span className="excerpt" style={{ maxWidth: 220 }}>
                {card.page}
              </span>
            </>
          )}
        </div>

        {card.reasons.length > 0 && (
          <>
            <span className="sec-label">Why it&rsquo;s on the horizon</span>
            {card.reasons.map((reason) => (
              <div
                key={reason}
                style={{ display: "flex", alignItems: "baseline", gap: 8, fontSize: 12.5 }}
              >
                <span
                  aria-hidden
                  className="dot"
                  style={{ background: "var(--act)", alignSelf: "center" }}
                />
                <span style={{ color: "var(--n-1000)" }}>{reason}</span>
              </div>
            ))}
          </>
        )}
      </div>

      <div className="row">
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={busy}
          onClick={() => onTarget(card.query)}
        >
          Target this
        </button>
        <div style={{ flex: 1 }} />
        <span className="t-label">the query rides along — no retyping at Create</span>
      </div>
    </div>
  );
}
