"use client";

import "@/components/leads/leads.css";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  activityRows,
  applyLeadView,
  draftEmail,
  heatColor,
  judgePill,
  leadExcerpt,
  leadInitials,
  leadStatusFilterLabel,
  leadTitle,
  mailtoHref,
  outreachDraftOf,
  outreachRunFor,
  scoreReasons,
  sheetDate,
  type LeadSort,
  type LeadStatusFilter,
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
import { LEAD_STATUSES } from "@thalon/contracts";
import type { ImportReport, LeadCard, LeadsPayload } from "@/lib/leads/types";
import { composeEmail } from "@/lib/outreach/client";
import { timeAgo } from "@/lib/workspace/format";
import { LeadsBoard } from "@/components/leads/leads-board";
import { useListKeys } from "@/lib/workspace/keyboard";

type QueueStatus = "loading" | "error" | "success";
type Panel = "none" | "import" | "provenance";
type OutreachState =
  | { state: "loading" }
  | { state: "none" }
  /** THIS lead's drafts read failed. */
  | { state: "error" }
  /** The run FEED read failed, so nothing about this lead's drafts is known. */
  | { state: "feed-error" }
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
 *
 * THE BOARD TAB replaces the split rather than nesting inside it. The sheet
 * draws List and Board as mutually exclusive `seg-opt`s, and Board.dc.html
 * draws its column grammar at `flex: 1` across the whole content width — three
 * lifecycle columns inside this sheet's 480px list pane would be ~150px each,
 * which is a re-expression of that grammar rather than a port of it. So Board
 * owns the content width, and the dossier the split's right half carries stays
 * one click away: a board card opens its lead in the List tab.
 */
export function LeadsSurface() {
  const router = useRouter();
  const [status, setStatus] = useState<QueueStatus>("loading");
  const [payload, setPayload] = useState<LeadsPayload | null>(null);
  const [view, setView] = useState<"list" | "board">("list");
  // The view knobs (founder s77). `statusFilter` REPLACES the old
  // `showDismissed` boolean: as a named value in a labelled control the filter
  // states itself in resting chrome, which is what it never did before.
  const [statusFilter, setStatusFilter] = useState<LeadStatusFilter>("active");
  const [find, setFind] = useState("");
  const [sort, setSort] = useState<LeadSort>("fit");
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>("none");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [lastImport, setLastImport] = useState<ImportReport | null>(null);
  const [readAt, setReadAt] = useState(0);
  // The run feed is the ONLY way to reach a lead's drafted outreach without a
  // new route: compose stamps `params.leadId` on the run it creates.
  // `"error"` when that read FAILED — an empty array would make a broken read
  // indistinguishable from a lead that has no draft (s77 finding, leads:118).
  const [runs, setRuns] = useState<FeedRun[] | "error" | null>(null);
  // The run the compose door just handed back. The feed is bounded (newest 50
  // runs), so a lead whose compose run has aged out is invisible to a feed scan
  // while the door's own answer names it exactly — and the door returns
  // `alreadyComposed` for an existing draft, so this resolves the older draft
  // rather than spending anything (s77 finding, leads:147). Keyed by lead: one
  // lead's compose answer must never resolve another lead's band.
  const [composedRun, setComposedRun] = useState<{ leadId: string; runId: string } | null>(null);
  /** The drafts of the selected lead's newest compose run — `"error"` when that read failed. */
  const [runDrafts, setRunDrafts] = useState<{
    runId: string;
    drafts: GridDraft[] | "error";
  } | null>(null);
  // The failure belongs to the lead it happened on. Unkeyed, lead A's
  // compose failure stays on screen in lead B's dossier, in the error
  // channel, describing work never attempted on B (keyed-by-entity
  // sweep, s78).
  const [outreachError, setOutreachError] = useState<{ leadId: string; message: string } | null>(
    null,
  );
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
        // and it says "couldn't read" there. `[]` would have said "no draft
        // yet", which is a DIFFERENT fact: broken must never render as empty.
        .catch(() => setRuns("error")),
    [],
  );

  useEffect(() => {
    void loadLeads();
    void loadRuns();
  }, [loadLeads, loadRuns]);

  const leads = payload?.leads ?? [];
  const visible = applyLeadView(leads, { status: statusFilter, find, sort });
  /** The operator narrowed the view themselves — an empty result must say so. */
  const narrowed = statusFilter !== "active" || find.trim() !== "";
  // Selection is DERIVED: when the picked lead leaves the list (dismissed),
  // the head of the queue takes over rather than stranding the detail card.
  const selected: LeadCard | null =
    visible.find((lead) => lead.id === pickedId) ?? visible[0] ?? null;
  const selectedId = selected?.id ?? null;

  // The lead's drafted outreach: one run-feed match, then ONE drafts read for
  // that run. Only the READ lives in the effect — every other state here is
  // derived below, so the effect never sets state synchronously (the B1.4
  // cascading-render lesson, react-hooks/set-state-in-effect).
  const feedRun =
    runs === null || runs === "error" || selectedId === null
      ? null
      : outreachRunFor(runs, selectedId);
  // The compose door's own answer outranks a scan of the bounded feed — it is
  // the same run, named exactly, and it survives the 50-run window.
  const composedRunId =
    composedRun !== null && composedRun.leadId === selectedId ? composedRun.runId : null;
  const outreachRunId = composedRunId ?? feedRun?.id ?? null;
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
      : outreachRunId === null
        ? // A failed feed read cannot claim "no draft yet" — with nothing to
          // scan, the honest answer is that it is unresolved.
          runs === "error"
          ? { state: "feed-error" }
          : { state: "none" }
        : runDrafts === null || runDrafts.runId !== outreachRunId
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
          // The filter chip in the header now carries this state, so the panel
          // no longer has to be open for the operator to see where they are.
          onClick: () => setStatusFilter("dismissed"),
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
        // Hold the run the door named. Without it the band re-derives from the
        // bounded feed and can contradict this very toast.
        setComposedRun({ leadId: lead.id, runId: result.runId });
        return {
          message:
            result.status === "blocked"
              ? `The judge blocked this draft (${result.blockedReason ?? "see Approve for the gate trail"}) — it’s parked for triage.`
              : result.alreadyComposed
                ? "This lead already had a draft — showing the existing one, nothing re-spent."
                : "Draft composed and judged — read it below, then send it yourself.",
        };
      } catch (err) {
        setOutreachError({
          leadId: lead.id,
          message: err instanceof Error ? err.message : "Couldn’t compose a draft.",
        });
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
        {/* The view knobs (founder s77), in Approve's own `.sel-ctl` grammar and
            LEFT of the sheet's List/Board seg so that control keeps the slot it
            is drawn in. The status chip is also the fix for the Dismissed view
            having no on-screen cue: the filter now names itself at rest. */}
        {view === "list" && (
          <>
            <input
              className="find-input"
              type="search"
              aria-label="Find a lead"
              placeholder="Find name, company, email…"
              value={find}
              onChange={(event) => setFind(event.target.value)}
            />
            <div className="btn btn-ghost btn-sm sel-ctl">
              {leadStatusFilterLabel(statusFilter)}
              <span className="chev" />
              <select
                className="sel-native"
                aria-label="Status filter"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as LeadStatusFilter)}
              >
                <option value="active">Active leads</option>
                {/* Contract-derived, never hand-listed: a lifecycle value added
                    to LEAD_STATUSES becomes a filter option for free. */}
                {LEAD_STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {leadStatusFilterLabel(value)}
                  </option>
                ))}
              </select>
            </div>
            <div className="btn btn-ghost btn-sm sel-ctl">
              {sort === "fit" ? "Best fit first" : "Newest first"}
              <span className="chev" />
              <select
                className="sel-native"
                aria-label="Sort order"
                value={sort}
                onChange={(event) => setSort(event.target.value as LeadSort)}
              >
                <option value="fit">Best fit first</option>
                <option value="newest">Newest first</option>
              </select>
            </div>
          </>
        )}
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
          aria-expanded={view === "list" && panel === "import"}
          // The intake panel lives under the list (the sheet's own chrome), so
          // from the Board tab this is a door back to it rather than a control
          // that silently does nothing.
          onClick={() => {
            const open = view === "board" || panel !== "import";
            setView("list");
            setPanel(open ? "import" : "none");
          }}
        >
          Import contacts
        </button>
      </div>

      {view === "board" ? (
        <LeadsBoard
          status={status}
          leads={leads}
          selectedId={selectedId}
          // A card is a door to the dossier, which lives in the List tab. The
          // board only ever draws non-terminal leads, so landing there must
          // clear any narrowing that would hide the pick — the status filter and
          // the find box both would.
          onOpen={(id) => {
            setStatusFilter("active");
            setFind("");
            setPickedId(id);
            setView("list");
          }}
          onRetry={() => {
            setStatus("loading");
            void loadLeads();
          }}
        />
      ) : (
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
              ) : visible.length === 0 ? (
                <div className="row">
                  <span className="t-label">
                    {/* Three different facts, never one line: the operator's own
                        filter emptied it · the dismissed shelf is genuinely
                        empty · there are no leads at all. */}
                    {narrowed && leads.length > 0
                      ? statusFilter === "dismissed" && find.trim() === ""
                        ? "Nothing dismissed yet — every dismiss is a verdict the ranking learns from."
                        : `No leads match this view — ${leadStatusFilterLabel(statusFilter).toLowerCase()}${find.trim() === "" ? "" : ` matching “${find.trim()}”`}. Widen it with the filter or the find box.`
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
                    // Still a door — it now drives the same filter the header
                    // chip shows, so the two controls can never disagree.
                    onClick={() =>
                      setStatusFilter(statusFilter === "dismissed" ? "active" : "dismissed")
                    }
                  >
                    {statusFilter === "dismissed"
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
                  {/*
                   * POINTER PARITY for the two triage verbs (s77 blocker,
                   * leads:340). `d` and `h` were the ONLY way to reach dismiss
                   * and mark-hot, and their legend sits one disclosure deep, so
                   * a mouse-only operator could not triage at all — and on the
                   * Board tab the keys are gated off entirely. This restores the
                   * parity the peer surface already has (Approve binds a/r AND
                   * draws Approve/Reject buttons), and it is a REGRESSION being
                   * closed: the pre-rebuild lead-card.tsx drew both verbs.
                   * They ride the sheet's own card-head beside the #id stamp —
                   * a state the card HAS, not a new band.
                   */}
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={busy}
                    title={
                      selected.pinned
                        ? "Clear the hot pick — that verdict tunes the ranking too (key: h)"
                        : "Float this lead to the top and teach the ranking (key: h)"
                    }
                    onClick={() => onToggleHot(selected)}
                  >
                    {selected.pinned ? "Clear hot" : "Mark hot"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={busy || selected.status === "dismissed"}
                    title={
                      selected.status === "dismissed"
                        ? "Already dismissed — the lifecycle has no route back from dismissed"
                        : "Dismiss this lead — that verdict tunes the ranking (key: d)"
                    }
                    onClick={() => onDismiss(selected)}
                  >
                    Dismiss
                  </button>
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
                        // EVERY FACT IS A DOOR: a judge verdict with no route to
                        // its reasons is the whole of the VISIBLE PROVENANCE
                        // doctrine unmet. Approve consumes a mount-time
                        // `?draft=` and opens the gate trail on that draft.
                        <Link
                          className={judgePill(outreach.draft.status).className}
                          href={`/app/approve?draft=${encodeURIComponent(outreach.draft.id)}`}
                          title="Open this draft in Approve — the judge's verdicts, verbatim"
                        >
                          {judgePill(outreach.draft.status).text} →
                        </Link>
                      )}
                    </div>

                    {outreach.state === "ready" ? (
                      (() => {
                        const email = draftEmail(outreach.draft);
                        // THE JUDGE GATES — a blocked draft must not leave this
                        // surface. Approve's state machine has no blocked →
                        // approved path, so handing over Copy body and a
                        // prefilled mailto was the one route by which ungated
                        // copy could reach a real recipient. It fails closed
                        // here, in the same honest-refusal grammar as `Log a
                        // call`: the control still says what it would do, and
                        // says why it won't (s77 finding, leads:780).
                        const blocked = outreach.draft.status === "blocked";
                        const blockedWhy =
                          "The judge blocked this draft — fix it in Approve and re-judge; nothing blocked leaves this surface.";
                        return (
                          <>
                            {blocked && (
                              <span
                                className="t-label"
                                role="alert"
                                style={{ color: "var(--err)" }}
                              >
                                {blockedWhy} Its reasons are on the draft — the verdict above is the
                                door.
                              </span>
                            )}
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
                                className={blocked ? "btn btn-quiet btn-sm" : "btn btn-primary btn-sm"}
                                disabled={blocked}
                                title={blocked ? blockedWhy : undefined}
                                onClick={() => copy(email.body, "Body")}
                              >
                                Copy body
                              </button>
                              <button
                                type="button"
                                className={blocked ? "btn btn-quiet btn-sm" : "btn btn-ghost btn-sm"}
                                disabled={blocked}
                                title={blocked ? blockedWhy : undefined}
                                onClick={() => copy(email.subject, "Subject")}
                              >
                                Copy subject
                              </button>
                              {blocked ? (
                                // An <a> cannot be disabled; the sheet-faithful
                                // unarmed treatment is the Runs surface's own
                                // aria-disabled span with its reason.
                                <span
                                  className="btn btn-quiet btn-sm"
                                  aria-disabled
                                  style={{ cursor: "default" }}
                                  title={blockedWhy}
                                >
                                  Open in your mail client
                                </span>
                              ) : (
                                <a
                                  className="btn btn-ghost btn-sm"
                                  href={mailtoHref(selected.email, email)}
                                >
                                  Open in your mail client
                                </a>
                              )}
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
                          <span
                            className="t-label"
                            role={outreach.state === "feed-error" ? "alert" : undefined}
                            style={
                              outreach.state === "feed-error" ? { color: "var(--err)" } : undefined
                            }
                          >
                            {outreach.state === "loading"
                              ? "Reading this lead’s drafts…"
                              : outreach.state === "error"
                                ? "Couldn’t read this lead’s drafts — a read failure, not an empty history."
                                : outreach.state === "feed-error"
                                  ? // The feed is what resolves a lead to its run,
                                    // so with that read broken the honest answer is
                                    // "unknown", never "none".
                                    "Couldn’t read the run feed, so this lead’s drafts are unresolved — this is a read failure, not an empty history."
                                  : "No draft yet. Compose one from this lead’s own context — role, company and the pain point above ride into the brief, the judge gates it, and it waits for you."}
                          </span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          {outreach.state === "feed-error" ? (
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={() => {
                                setRuns(null);
                                void loadRuns();
                              }}
                            >
                              Try again
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              disabled={busy || outreach.state === "loading"}
                              onClick={() => onCompose(selected)}
                            >
                              {busy ? "Composing + judging…" : "Draft outreach"}
                            </button>
                          )}
                          <Link className="btn btn-ghost btn-sm" href="/app/approve">
                            Open Approve
                          </Link>
                          <div style={{ flex: 1 }} />
                          <span className="t-label">you send it — from your own mailbox</span>
                        </div>
                      </>
                    )}
                    {outreachError && outreachError.leadId === selectedId && (
                      <span className="t-label" role="alert" style={{ color: "var(--err)" }}>
                        {outreachError.message}
                      </span>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      <ActionToast toast={toast} onClear={() => setToast(null)} />
    </div>
  );
}
