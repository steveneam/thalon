"use client";

import "@/components/leads/leads.css";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  activityRows,
  draftEmail,
  heatColor,
  judgePill,
  leadExcerpt,
  leadInitials,
  leadTitle,
  mailtoHref,
  outreachDraftOf,
  outreachRunFor,
  scoreReasons,
  sheetDate,
} from "@/components/leads/leads-model";
import { ActionToast, type ToastState } from "@/components/workspace/action-toast";
import { fetchRunDrafts, fetchRunsFeed } from "@/lib/approve-queue/client";
import type { FeedRun, GridDraft } from "@/lib/approve-queue/types";
import type { CreateFamily } from "@/lib/intel/types";
import {
  fetchLeads,
  importLeadsCsv,
  learnWeightsNow,
  promoteLeadTo,
  scoreLeadsNow,
  syncWaitlist,
  triageLeads,
} from "@/lib/leads/client";
import { compareLeadCards } from "@/lib/leads/serialize";
import type { ImportReport, LeadCard, LeadsPayload } from "@/lib/leads/types";
import { composeEmail } from "@/lib/outreach/client";
import { timeAgo } from "@/lib/workspace/format";
import { useListKeys } from "@/lib/workspace/keyboard";

type QueueStatus = "loading" | "error" | "success";
type Panel = "none" | "import" | "provenance";
type OutreachState =
  | { state: "loading" }
  | { state: "none" }
  | { state: "error" }
  | { state: "ready"; draft: GridDraft };

/** Render order matches the scorer's own signal order — stable, never alphabetized. */
const SIGNAL_ORDER = ["relevance", "fit", "completeness", "recency"] as const;

/**
 * Leads — STEP 2 of the two-step rebuild: the byte-true port of
 * Leads.dc.html with the real queue behind it. The sheet owns every band,
 * class and copy grammar; this layer only decides what is TRUE to render:
 *
 *  - rows are the real ranked queue (best fit first, `compareLeadCards`),
 *    each score bar painted by the same thermal band the workspace grades by;
 *    an unscored lead says "–" rather than showing an invented grade;
 *  - "Why this score" renders the scorer's OWN reason lines — signal, value,
 *    magnitude bar, and the reason itself, with the untouched line on the
 *    row's title (the lead-score provenance keeper's front half);
 *  - the weights behind those numbers (learned state, evidence, per-signal
 *    multipliers, drift) live one disclosure behind the footer's ordering
 *    line, with Learn/Score/dismissed there too — the keeper re-enters as a
 *    STATE behind byte-true chrome, never as a new band;
 *  - Activity carries the events the spine actually records (intake, scoring)
 *    and names the ones nothing stores yet;
 *  - "Drafted outreach" reads the lead's own composed draft through the
 *    existing run clients; with none, the band offers the compose door
 *    instead of four dead buttons. Nothing is ever sent from here.
 */
export function LeadsSurface() {
  const router = useRouter();
  const [status, setStatus] = useState<QueueStatus>("loading");
  const [payload, setPayload] = useState<LeadsPayload | null>(null);
  const [view, setView] = useState<"list" | "board">("list");
  const [showDismissed, setShowDismissed] = useState(false);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>("none");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [lastImport, setLastImport] = useState<ImportReport | null>(null);
  const [readAt, setReadAt] = useState(0);
  // The run feed is the ONLY way to reach a lead's drafted outreach without a
  // new route: compose stamps `params.leadId` on the run it creates.
  const [runs, setRuns] = useState<FeedRun[] | null>(null);
  /** The drafts of the selected lead's newest compose run — `"error"` when that read failed. */
  const [runDrafts, setRunDrafts] = useState<{
    runId: string;
    drafts: GridDraft[] | "error";
  } | null>(null);
  const [outreachError, setOutreachError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const loadLeads = useCallback(
    () =>
      fetchLeads()
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

  const loadRuns = useCallback(
    () =>
      fetchRunsFeed()
        .then((feed) => setRuns(feed))
        // An unread run feed only costs the outreach band, never the queue —
        // it says so there rather than pretending the lead has no draft.
        .catch(() => setRuns([])),
    [],
  );

  useEffect(() => {
    void loadLeads();
    void loadRuns();
  }, [loadLeads, loadRuns]);

  const leads = payload?.leads ?? [];
  const visible = [...leads]
    .filter((lead) => (showDismissed ? lead.status === "dismissed" : lead.status !== "dismissed"))
    .sort(compareLeadCards);
  // Selection is DERIVED: when the picked lead leaves the list (dismissed),
  // the head of the queue takes over rather than stranding the detail card.
  const selected: LeadCard | null =
    visible.find((lead) => lead.id === pickedId) ?? visible[0] ?? null;
  const selectedId = selected?.id ?? null;

  // The lead's drafted outreach: one run-feed match, then ONE drafts read for
  // that run. Only the READ lives in the effect — every other state here is
  // derived below, so the effect never sets state synchronously (the B1.4
  // cascading-render lesson, react-hooks/set-state-in-effect).
  const outreachRun = runs === null || selectedId === null ? null : outreachRunFor(runs, selectedId);
  const outreachRunId = outreachRun?.id ?? null;
  useEffect(() => {
    if (outreachRunId === null) return;
    let cancelled = false;
    fetchRunDrafts(outreachRunId)
      .then((drafts) => {
        if (!cancelled) setRunDrafts({ runId: outreachRunId, drafts });
      })
      .catch(() => {
        if (!cancelled) setRunDrafts({ runId: outreachRunId, drafts: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [outreachRunId]);

  const outreach: OutreachState =
    selectedId === null || runs === null
      ? { state: "loading" }
      : outreachRun === null
        ? { state: "none" }
        : runDrafts === null || runDrafts.runId !== outreachRun.id
          ? { state: "loading" }
          : runDrafts.drafts === "error"
            ? { state: "error" }
            : (() => {
                const draft = outreachDraftOf(runDrafts.drafts, selectedId);
                return draft === null ? { state: "none" } : { state: "ready", draft };
              })();

  async function run(work: () => Promise<ToastState | null>) {
    setBusy(true);
    try {
      const result = await work();
      await loadLeads();
      if (result) setToast(result);
    } catch (err) {
      // Engine/gateway refusals surface verbatim — an honest error beats a
      // silent no-op under keyboard triage.
      setToast({ message: err instanceof Error ? err.message : "Something went wrong." });
    } finally {
      setBusy(false);
    }
  }

  function onDismiss(lead: LeadCard) {
    const neighbour = visible[visible.findIndex((l) => l.id === lead.id) + 1] ?? null;
    void run(async () => {
      const result = await triageLeads("dismiss", [lead.id]);
      if (result.failed.length > 0) return { message: result.failed[0].error };
      setPickedId(neighbour?.id ?? null);
      return {
        message: "Lead dismissed — that verdict tunes the ranking.",
        action: {
          label: "View dismissed",
          onClick: () => {
            setShowDismissed(true);
            setPanel("provenance");
          },
        },
      };
    });
  }

  function onToggleHot(lead: LeadCard) {
    void run(async () => {
      const result = await triageLeads(lead.pinned ? "unpin" : "pin", [lead.id]);
      return result.failed.length > 0
        ? { message: result.failed[0].error }
        : {
            message: lead.pinned
              ? "Hot pick cleared — that verdict tunes the ranking too."
              : "Marked hot — it floats to the top and teaches the ranking.",
          };
    });
  }

  /**
   * The lead → Create door (B-crm.2): the promote records a capture and hands
   * back the Create href, so the lead's own context grounds the brief instead
   * of being retyped. The sheet draws no band for it — it re-enters as state
   * behind the footer disclosure, per the keeper re-entry rule.
   */
  function onPromote(lead: LeadCard, family: CreateFamily) {
    void run(async () => {
      const { createHref } = await promoteLeadTo(lead.id, family);
      router.push(createHref);
      return { message: "Opening Create with this lead’s context…" };
    });
  }

  function onScoreNow() {
    void run(async () => {
      const scoring = await scoreLeadsNow();
      if (!scoring.armed) return { message: scoring.reason ?? "Scoring is not armed." };
      return {
        message:
          scoring.candidates === 0
            ? "Nothing to score — every lead is current."
            : `Scored ${scoring.scored} lead${scoring.scored === 1 ? "" : "s"} (${scoring.rescored} re-scored after the ICP change).`,
      };
    });
  }

  function onLearn() {
    void run(async () => {
      const report = await learnWeightsNow();
      if (!report.armed) return { message: report.reason ?? "Learning is not armed." };
      if (report.verdicts === 0) {
        return {
          message:
            "Nothing to learn from yet — dismiss or mark a few scored leads hot; every verdict teaches the ranking.",
        };
      }
      if (!report.created) {
        return { message: "No change — the learned weights already reflect every verdict." };
      }
      return {
        message: `Learned new weights from ${report.verdicts} verdict${report.verdicts === 1 ? "" : "s"} — Score now applies them.`,
      };
    });
  }

  function onImportCsv(csv: string) {
    void run(async () => {
      const { report, scoring } = await importLeadsCsv(csv);
      setLastImport(report);
      const scored = scoring.armed ? ` · ${scoring.scored} scored` : " · scoring not armed (add an ICP)";
      return {
        message: `Imported ${report.added} of ${report.rows} rows (${report.duplicates} duplicate, ${report.invalid} invalid)${scored}.`,
      };
    });
  }

  function onSyncWaitlist() {
    void run(async () => {
      const { sync, scoring } = await syncWaitlist();
      const scored = scoring.armed ? ` · ${scoring.scored} scored` : "";
      return {
        message: `Waitlist synced: ${sync.added} new lead${sync.added === 1 ? "" : "s"} (${sync.existing} already bridged)${scored}.`,
      };
    });
  }

  function onCompose(lead: LeadCard) {
    setOutreachError(null);
    void run(async () => {
      try {
        const result = await composeEmail({
          leadId: lead.id,
          context: {
            contact: lead.name ?? undefined,
            company: lead.company ?? undefined,
            role: lead.role ?? undefined,
            painPoint: lead.painPoint ?? undefined,
            notes: lead.notes ?? undefined,
            sourceUrl: lead.website ?? undefined,
          },
        });
        await loadRuns();
        return {
          message:
            result.status === "blocked"
              ? `The judge blocked this draft (${result.blockedReason ?? "see Approve for the gate trail"}) — it’s parked for triage.`
              : result.alreadyComposed
                ? "This lead already had a draft — showing the existing one, nothing re-spent."
                : "Draft composed and judged — read it below, then send it yourself.",
        };
      } catch (err) {
        setOutreachError(err instanceof Error ? err.message : "Couldn’t compose a draft.");
        return null;
      }
    });
  }

  function copy(text: string, what: string) {
    void navigator.clipboard?.writeText(text).then(
      () => setToast({ message: `${what} copied — paste it into your own mail client.` }),
      () => setToast({ message: `Couldn’t reach the clipboard — select the ${what.toLowerCase()} and copy it.` }),
    );
  }

  // The ONE list keyboard grammar (lib/workspace/keyboard.ts): j/k move, and
  // this surface's own verbs — d dismiss, h hot. The legend lives in the
  // provenance panel; the sheet's footer draws j/k, so j/k is what it draws.
  const move = (delta: 1 | -1) => (event: KeyboardEvent) => {
    if (visible.length === 0) return;
    event.preventDefault();
    const current = visible.findIndex((lead) => lead.id === selectedId);
    const next = current === -1 ? 0 : Math.min(Math.max(current + delta, 0), visible.length - 1);
    setPickedId(visible[next].id);
  };
  useListKeys({
    enabled: !busy && view === "list" && status === "success",
    bindings: {
      j: move(1),
      k: move(-1),
      d: (event) => {
        if (!selected || selected.status === "dismissed") return;
        event.preventDefault();
        onDismiss(selected);
      },
      h: (event) => {
        if (!selected) return;
        event.preventDefault();
        onToggleHot(selected);
      },
    },
  });

  const counts = payload?.counts ?? { new: 0, scored: 0, dismissed: 0 };
  const hot = leads.filter((lead) => lead.pinned && lead.status !== "dismissed").length;
  const weights = payload?.learnedWeights;
  const scoredLeads = leads.filter((lead) => lead.status === "scored" && lead.score !== null);
  const lagging = weights?.state
    ? scoredLeads.filter((lead) => lead.weightStateId !== weights.state?.id).length
    : 0;
  const stale =
    selected !== null &&
    selected.profileHash !== null &&
    payload?.currentProfileHash != null &&
    selected.profileHash !== payload.currentProfileHash;

  return (
    <div className="content leads-surface">
      {/* j/k selection is a silent context change for screen readers without this. */}
      <p aria-live="polite" className="sr-only">
        {selected ? `Selected lead ${leadTitle(selected)}` : ""}
      </p>

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <h1 className="t-headline">Leads</h1>
        {status === "success" && (
          <span className="pill pill-idle">{`${counts.scored} scored`}</span>
        )}
        {status === "success" && hot > 0 && (
          <span className="pill pill-warn">{`${hot} hot · follow up`}</span>
        )}
        <div style={{ flex: 1 }} />
        <div className="seg" role="group" aria-label="Lead views">
          <button
            type="button"
            className={view === "list" ? "seg-opt on" : "seg-opt"}
            aria-pressed={view === "list"}
            onClick={() => setView("list")}
          >
            List
          </button>
          <button
            type="button"
            className={view === "board" ? "seg-opt on" : "seg-opt"}
            aria-pressed={view === "board"}
            onClick={() => setView("board")}
          >
            Board
          </button>
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          aria-expanded={panel === "import"}
          onClick={() => setPanel(panel === "import" ? "none" : "import")}
        >
          Import contacts
        </button>
      </div>

      <div className="split">
        <div className="card" style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div className="lead-scroll">
            {status === "error" ? (
              <div className="row" role="alert">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span className="t-label">
                    Couldn’t read your leads — this is a read failure, not an empty queue.
                  </span>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setStatus("loading");
                    void loadLeads();
                  }}
                >
                  Try again
                </button>
              </div>
            ) : status === "loading" ? (
              <div className="row">
                <span className="t-label">Reading your leads…</span>
              </div>
            ) : view === "board" ? (
              <div className="row">
                <span className="t-label">
                  The mock draws this tab but no board for it yet — every lead is in the list, best
                  fit first.
                </span>
              </div>
            ) : visible.length === 0 ? (
              <div className="row">
                <span className="t-label">
                  {showDismissed
                    ? "Nothing dismissed yet — every dismiss is a verdict the ranking learns from."
                    : "No leads yet — import a CSV (any CRM export works), sync your waitlist, or let the API deliver them. With an ICP on your profile each one is scored against who you actually sell to, reasons spelled out."}
                </span>
              </div>
            ) : (
              visible.map((lead) => (
                <button
                  type="button"
                  key={lead.id}
                  data-testid={`lead-row-${lead.id}`}
                  className={lead.id === selectedId ? "row lead-row sel" : "row lead-row"}
                  aria-pressed={lead.id === selectedId}
                  onClick={() => setPickedId(lead.id)}
                >
                  <div className="mono-badge">{leadInitials(lead)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="lead-name">{leadTitle(lead)}</div>
                    <div className="excerpt">{leadExcerpt(lead)}</div>
                  </div>
                  <div className="score-chip">
                    <div className="bar-trough" style={{ width: 44 }}>
                      {lead.score !== null && (
                        <div
                          className="bar-fill"
                          style={{
                            width: `${Math.round(lead.score * 100)}%`,
                            background: heatColor(lead.score),
                          }}
                        />
                      )}
                    </div>
                    <span
                      className="t-data"
                      title={lead.score === null ? "not scored yet" : `score ${lead.score} of 1`}
                    >
                      {lead.score === null ? "–" : lead.score.toFixed(2)}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>

          {panel === "import" && (
            <div className="lead-panel">
              <div className="lead-panel-row">
                <span className="t-label">Import contacts</span>
                <div style={{ flex: 1 }} />
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={busy}
                  onClick={onSyncWaitlist}
                >
                  Sync waitlist
                </button>
              </div>
              <span>
                Standard CRM headers work out of the box — HubSpot, Salesforce and Pipedrive
                exports, or{" "}
                <a href="/leads-template.csv" download>
                  our minimal template
                </a>
                . Email is required; unknown columns stay on the lead. The file is parsed and
                discarded — never stored.
              </span>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                aria-label="CSV file"
                disabled={busy}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void file.text().then(onImportCsv);
                }}
              />
              {lastImport && lastImport.reasons.length > 0 && (
                <details>
                  <summary>
                    {lastImport.invalid} invalid row{lastImport.invalid === 1 ? "" : "s"} from the
                    last import
                  </summary>
                  <dl>
                    {lastImport.reasons.map((reason) => (
                      <span key={`${reason.row}-${reason.reason}`} style={{ display: "contents" }}>
                        <dt>row {reason.row}</dt>
                        <dd>{reason.reason}</dd>
                      </span>
                    ))}
                  </dl>
                </details>
              )}
            </div>
          )}

          {panel === "provenance" && (
            <div className="lead-panel" data-testid="weights-provenance">
              <div className="lead-panel-row">
                <span className="t-label">
                  {weights?.state ? "Learned weights" : "Base weights"}
                </span>
                {weights?.state && (
                  <span className="t-data">
                    state {weights.state.id.slice(0, 8)} · {timeAgo(weights.state.computedAt, readAt)}{" "}
                    · from {weights.state.verdicts} verdict
                    {weights.state.verdicts === 1 ? "" : "s"} ({weights.state.rows} triage row
                    {weights.state.rows === 1 ? "" : "s"})
                  </span>
                )}
                <div style={{ flex: 1 }} />
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={busy}
                  onClick={onLearn}
                >
                  Learn from feedback
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={busy || !payload?.scoringArmed}
                  title={
                    payload?.scoringArmed
                      ? "Re-score every lead with the weights above"
                      : "Add an ICP block to your profile first"
                  }
                  onClick={onScoreNow}
                >
                  Score now
                </button>
              </div>
              {weights?.state && (
                <span>
                  {SIGNAL_ORDER.map((signal, i) => (
                    <span key={signal}>
                      {i > 0 && " · "}
                      {signal}{" "}
                      <span className="t-data">×{weights.state?.multipliers[signal].toFixed(2)}</span>
                    </span>
                  ))}
                </span>
              )}
              {weights?.state && scoredLeads.length > 0 && (
                <span style={lagging > 0 ? { color: "var(--warn)" } : undefined}>
                  {lagging === 0
                    ? `applied to all ${scoredLeads.length} scored lead${scoredLeads.length === 1 ? "" : "s"}`
                    : `${lagging} of ${scoredLeads.length} scored lead${scoredLeads.length === 1 ? "" : "s"} riding older weights — Score now refreshes them`}
                </span>
              )}
              {!weights?.state &&
                (weights?.staleForProfile ? (
                  <span style={{ color: "var(--warn)" }}>
                    The ICP changed since weights were last learned — scores ride base weights until
                    the loop re-runs.
                  </span>
                ) : (
                  <span>Every dismiss and hot pick is a verdict the loop can learn from.</span>
                ))}
              {payload && !payload.scoringArmed && (
                <span>
                  Scoring isn’t armed: add an <strong>ICP block</strong> to your{" "}
                  <Link href="/app/profiles">active profile</Link> and every lead gets a
                  deterministic score with its reasons.
                </span>
              )}
              {selected && (
                <div className="lead-panel-row">
                  <span>
                    {leadTitle(selected)} into Create — role, company and the pain point ride in:
                  </span>
                  {(["post", "video", "page"] as const).map((family) => (
                    <button
                      key={family}
                      type="button"
                      className="btn btn-ghost btn-sm"
                      disabled={busy}
                      onClick={() => onPromote(selected, family)}
                    >
                      {family === "post" ? "Post" : family === "video" ? "Video" : "Page"}
                    </button>
                  ))}
                </div>
              )}
              <div className="lead-panel-row">
                <span>
                  keys · <span className="kbd">j</span> <span className="kbd">k</span> move ·{" "}
                  <span className="kbd">d</span> dismiss · <span className="kbd">h</span> hot
                </span>
                <div style={{ flex: 1 }} />
                <button
                  type="button"
                  className="as-text-btn card-link"
                  onClick={() => setShowDismissed(!showDismissed)}
                >
                  {showDismissed
                    ? "Back to active leads →"
                    : `Dismissed (${counts.dismissed}) — the verdicts the loop learns from →`}
                </button>
              </div>
            </div>
          )}

          <div className="lead-foot">
            <button
              type="button"
              className="t-label as-text-btn"
              aria-expanded={panel === "provenance"}
              title="What the ranking applied, and what taught it"
              onClick={() => setPanel(panel === "provenance" ? "none" : "provenance")}
            >
              best fit first · reasons on every score
            </button>
            <div style={{ flex: 1 }} />
            <span className="kbd">j</span>
            <span className="kbd">k</span>
            <span className="t-label">move</span>
          </div>
        </div>

        <div className="card" style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
          {selected === null ? (
            <div className="lead-detail-scroll">
              <span className="t-label">
                {status === "success"
                  ? "No lead selected — the queue is empty."
                  : status === "error"
                    ? "The queue read failed — the retry sits in the list beside this."
                    : "Reading your leads…"}
              </span>
            </div>
          ) : (
            <>
              <div className="card-head">
                <span className="t-title">{leadTitle(selected)}</span>
                {selected.pinned && <span className="pill pill-warn">follow up</span>}
                <div style={{ flex: 1 }} />
                <span className="t-data" title={`lead ${selected.id}`}>
                  #{selected.id.slice(0, 8)}
                </span>
              </div>
              <div className="lead-detail-scroll">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <span className="sec-label">Why this score</span>
                    {selected.reasons.length === 0 ? (
                      <span className="t-label">
                        {payload?.scoringArmed
                          ? "Not scored yet — Score now applies your ICP and writes the reasons here."
                          : "Not scored: your profile has no ICP block yet, so scoring is disarmed."}
                      </span>
                    ) : (
                      scoreReasons(selected).map((reason) => (
                        <div className="reason" key={reason.verbatim} title={reason.verbatim}>
                          <span className="rname">{reason.name}</span>
                          <div className="bar-trough">
                            {reason.value !== null && (
                              <div
                                className="bar-fill"
                                style={{
                                  width: `${Math.round(reason.value * 100)}%`,
                                  background: heatColor(reason.value),
                                }}
                              />
                            )}
                          </div>
                          <span>{reason.detail}</span>
                        </div>
                      ))
                    )}
                    {stale && (
                      <span className="t-label" style={{ color: "var(--warn)" }}>
                        scored against an older ICP — Score now refreshes it
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <span className="sec-label">Activity</span>
                    {activityRows(selected).map((row) => (
                      <div className="act-row" key={`${row.text}-${row.at}`}>
                        <span
                          className="dot"
                          style={{ background: "var(--n-700)", marginTop: 5 }}
                        />
                        <span style={{ flex: 1 }}>
                          {row.text}
                          <br />
                          <span className="t-data">{sheetDate(row.at)}</span>
                        </span>
                      </div>
                    ))}
                    <span className="t-label">
                      intake and scoring are what the lead spine records — opens, clicks and replies
                      need an engagement store that doesn’t exist yet
                    </span>
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span className="sec-label">Drafted outreach — draft-only, never auto-sent</span>
                    <div style={{ flex: 1 }} />
                    {outreach.state === "ready" && (
                      <span className={judgePill(outreach.draft.status).className}>
                        {judgePill(outreach.draft.status).text}
                      </span>
                    )}
                  </div>

                  {outreach.state === "ready" ? (
                    (() => {
                      const email = draftEmail(outreach.draft);
                      return (
                        <>
                          <div className="mail">
                            <div>
                              <span style={{ color: "var(--n-900)" }}>To</span>&nbsp;{" "}
                              {selected.name ? `${selected.name} <${selected.email}>` : selected.email}
                            </div>
                            <div>
                              <span style={{ color: "var(--n-900)" }}>Subject</span>&nbsp;{" "}
                              {email.subject}
                            </div>
                            <div style={{ color: "var(--n-900)", lineHeight: 1.6 }}>{email.body}</div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              onClick={() => copy(email.body, "Body")}
                            >
                              Copy body
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={() => copy(email.subject, "Subject")}
                            >
                              Copy subject
                            </button>
                            <a
                              className="btn btn-ghost btn-sm"
                              href={mailtoHref(selected.email, email)}
                            >
                              Open in your mail client
                            </a>
                            <button
                              type="button"
                              className="btn btn-quiet btn-sm"
                              disabled
                              title="Call logging needs the engagement store the Activity column names — nothing records it yet"
                            >
                              Log a call
                            </button>
                            <div style={{ flex: 1 }} />
                            <span className="t-label">you send it — from your own mailbox</span>
                          </div>
                        </>
                      );
                    })()
                  ) : (
                    <>
                      <div className="mail">
                        <span className="t-label">
                          {outreach.state === "loading"
                            ? "Reading this lead’s drafts…"
                            : outreach.state === "error"
                              ? "Couldn’t read this lead’s drafts — a read failure, not an empty history."
                              : "No draft yet. Compose one from this lead’s own context — role, company and the pain point above ride into the brief, the judge gates it, and it waits for you."}
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          disabled={busy || outreach.state === "loading"}
                          onClick={() => onCompose(selected)}
                        >
                          {busy ? "Composing + judging…" : "Draft outreach"}
                        </button>
                        <Link className="btn btn-ghost btn-sm" href="/app/approve">
                          Open Approve
                        </Link>
                        <div style={{ flex: 1 }} />
                        <span className="t-label">you send it — from your own mailbox</span>
                      </div>
                    </>
                  )}
                  {outreachError && (
                    <span className="t-label" role="alert" style={{ color: "var(--err)" }}>
                      {outreachError}
                    </span>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      <ActionToast toast={toast} onClear={() => setToast(null)} />
    </div>
  );
}
