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
import { HORIZON_SIGNALS, horizonRead } from "@/components/intel/horizon-read";
import { isGenerable } from "@/lib/create/families";
import type { CreateFamily, HorizonCard, HorizonPayload, TargetRow } from "@/lib/intel/types";

type TabStatus = "loading" | "error" | "success";

/**
 * The family a targeted search hands Create — the route's own default
 * (app/api/intel/search/target-this), named here so the button can say what
 * waits at the other end.
 */
const TARGET_FAMILY: CreateFamily = "page";

/** Provenance labels for the origin pill — first origin wins, so the label is durable. */
const ORIGIN_LABEL: Record<TargetRow["origin"], string> = {
  profile_seed: "profile seed",
  ai_expansion: "ai expansion",
  operator: "operator",
};

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
 *    `.input` for the add field — so Search wears the Trends tab's grammar,
 *    not a second dialect;
 *  - the horizon card leads with the END-POINT SIGNIFICANCE (founder s74:
 *    position/CTR/snapshots "don't mean much to the general user — they just
 *    want to know the end point significance"): a verdict, the reasons in
 *    plain words, one exit. Every number and the ranker's verbatim sentences
 *    live behind "the numbers →" and the clause tooltips — see horizon-read.
 *
 * Honesty rules carried from the ported surfaces: numbers are real or say
 * "unknown", never a fabricated zero; the ranker's reasons stay VERBATIM and
 * reachable (the plain clause is a reading of them, never a replacement);
 * the demo era is named in the band itself rather than implied live; and no
 * magnitude bar appears anywhere, because position and CTR have no honest
 * 0–1 scale to draw one from. The signal score is the engine's OWN count of
 * rules that fired, not a re-derived guess.
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
 * One (query × page) series, read END-POINT FIRST (founder s74): the query,
 * a plain verdict with the reasons in the operator's terms, one exit — and
 * every number plus the ranker's verbatim sentences behind "the numbers →".
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
  const [open, setOpen] = useState(false);
  const read = horizonRead(card);

  return (
    <div className="card" data-testid={`horizon-${card.query}`}>
      <div className="card-head">
        <span className="t-data" style={{ fontSize: 13, color: "var(--n-1000)" }}>
          “{card.query}”
        </span>
        <div style={{ flex: 1 }} />
        <span className={card.isOpportunity ? "pill pill-ok" : "pill pill-idle"}>
          {read.signals} of {HORIZON_SIGNALS} signals
        </span>
      </div>

      <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 6 }}>
        <span className="t-title">{read.verdict}</span>
        {read.clauses.length > 0 ? (
          <span className="t-label" style={{ color: "var(--n-1000)" }}>
            {read.clauses.map((clause, i) => (
              <span key={clause.verbatim} title={clause.verbatim}>
                {i > 0 ? " · " : ""}
                {clause.text}
              </span>
            ))}
          </span>
        ) : (
          <span className="t-label">
            None of the horizon rules fired on this query yet.
          </span>
        )}
      </div>

      {open && (
        <div style={{ padding: "0 16px 12px", display: "flex", flexDirection: "column", gap: 4 }}>
          <span className="sec-label">The numbers</span>
          {read.metrics.map((metric) => (
            <span key={metric} className="t-data" style={{ color: "var(--n-1000)" }}>
              {metric}
            </span>
          ))}
          {card.reasons.length > 0 && (
            <>
              <span className="sec-label" style={{ marginTop: 6 }}>
                What the ranker wrote
              </span>
              {card.reasons.map((reason) => (
                <span key={reason} className="t-data">
                  {reason}
                </span>
              ))}
            </>
          )}
        </div>
      )}

      <div className="row">
        {/* The exit stays available on every card — the operator may target
            whatever they like — but it only SHOUTS where the verdict says it
            is worth acting on. A primary button on "too far back to target
            yet" would argue with the sentence above it. */}
        <button
          type="button"
          className={card.isOpportunity ? "btn btn-primary btn-sm" : "btn btn-ghost btn-sm"}
          disabled={busy}
          onClick={() => onTarget(card.query)}
        >
          Target this
        </button>
        <button
          type="button"
          className="btn btn-quiet btn-sm"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "hide the numbers" : "the numbers →"}
        </button>
        <div style={{ flex: 1 }} />
        {/* The capture records the query's natural family — a targeted search
            wants a page — and Create's picker stays changeable. But `page`
            generation is not wired there, so "no retyping at Create" was the
            whole truth about the handoff and none of the truth about what
            happens next: the most opportune card's primary button landed on
            a disabled Generate (s77 finding, reproduced live s79). Stated
            here, from the same seam Create's own refusal reads. */}
        <span className="t-label">
          the query rides along — no retyping at Create
          {!isGenerable(TARGET_FAMILY) &&
            ` · ${TARGET_FAMILY} generation isn’t wired there yet, so the capture waits with your brief`}
        </span>
      </div>
    </div>
  );
}
