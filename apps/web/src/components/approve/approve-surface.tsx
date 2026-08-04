"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  applyQueueView,
  batchScopeNote,
  defaultSelection,
  FAMILY_OPTIONS,
  flattenQueue,
  groupByRun,
  isWaiting,
  SORT_OPTIONS,
  type QueueFamily,
  type QueueFilter,
  type QueueItem,
  type QueueSort,
  type RunGroup,
} from "@/components/approve/approve-model";
import { DraftCard, type DetailStatus } from "@/components/approve/draft-card";
import { QueueCard, type QueueStatus } from "@/components/approve/queue-card";
import { StagedFlow } from "@/components/staged/staged-flow";
import { ActionToast, type ToastState } from "@/components/workspace/action-toast";
import { usePulseSafe } from "@/components/workspace/pulse-context";
import {
  approveDraft,
  editDraft,
  fetchDraftDetail,
  fetchRunDrafts,
  fetchRunsFeed,
  publishDraft,
  reJudgeDraft,
  rejectDraft,
} from "@/lib/approve-queue/client";
import { judgeReasons } from "@/lib/approve-queue/judge-reasons";
import { isStagedDraftFormat } from "@/lib/staged-flow/types";
import { useListKeys } from "@/lib/workspace/keyboard";
import type { GridDraft, PanelJudgeResult } from "@/lib/approve-queue/types";
import "@/components/approve/approve.css";

/** ?run=/?draft= from the mount-time URL — SSR-safe, router-free (see deepLinkRef below). */
function readDeepLink(): { runId: string | null; draftId: string | null } {
  const params =
    typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  return { runId: params?.get("run") ?? null, draftId: params?.get("draft") ?? null };
}

/**
 * How many blocked rows the queue reads reasons for. A blocked row quotes
 * its failing reason in the sheet's excerpt slot, which needs that draft's
 * judge evidence — one extra read per blocked draft through the SAME
 * detail client (no API change). Bounded so a pathological queue can never
 * fan out unboundedly; rows past the bound keep the honest neutral excerpt
 * and still carry their reason once selected.
 */
const BLOCKED_REASON_READS = 12;

/**
 * The Approve surface, rebuilt exactly from
 * `docs/research/mock-sheets/Approve.dc.html` (DOCTRINE 0 — the sheet is
 * the blueprint): the header band with its counts, view pickers and bulk
 * approve, over the sheet's `.split` — queue card × draft card.
 *
 * Step 2 of the two-step rebuild (old-design-keepers.md): real data through
 * the existing `lib/approve-queue` clients, honest states everywhere, and
 * the surface's keepers woven back in behind byte-true resting chrome —
 * the a/r/e keyboard grammar with its confirms intact, the one bulk action
 * behind one named confirm, the terminal-verb toast, and the judge-verdict
 * provenance with reasons verbatim.
 */
export function ApproveSurface() {
  const [queueStatus, setQueueStatus] = useState<QueueStatus>("loading");
  const [items, setItems] = useState<QueueItem[]>([]);
  // The operator's view knobs (founder s66): newest first by default,
  // switchable; the state filter lives on the queue card's tabs (W1) and
  // the family picker in the header. Presentation state only.
  const [sort, setSort] = useState<QueueSort>("newest");
  const [filter, setFilter] = useState<QueueFilter>("all");
  const [family, setFamily] = useState<QueueFamily>("all");
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);
  // Failing judge reasons per BLOCKED draft id — what the sheet's blocked
  // row quotes in red where a passing row quotes the body.
  const [reasons, setReasons] = useState<Record<string, string[]>>({});
  // Reasons stated on THIS session's rejects (the sheet's "your reason →
  // eval:" chip). Not re-read from the wire — the reason lives in the eval
  // row and the transition event, which no read exposes yet.
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({});
  // Mirrors selectedDraftId so an in-flight detail fetch can tell, once it
  // resolves, whether the operator has since selected something else — a
  // stale fetch discards itself instead of clobbering the card. This is
  // also what makes refreshAfterAction's post-action re-fetch reliably land
  // as the card's true latest state rather than racing an earlier fetch.
  const selectedDraftIdRef = useRef<string | null>(null);

  // One-shot deep-link targets (?run= / ?draft= — provenance links land on
  // the ENTITY, not just the surface): consumed by the first queue load,
  // after which normal selection owns the state. Read from location rather
  // than useSearchParams — the value is only ever consumed once at mount, and
  // this keeps the component mountable outside a Next router (tests).
  const deepLinkRef = useRef(readDeepLink());

  const [detailStatus, setDetailStatus] = useState<DetailStatus>("idle");
  const [detailDraft, setDetailDraft] = useState<GridDraft | null>(null);
  const [judgeResults, setJudgeResults] = useState<PanelJudgeResult[]>([]);
  const [busy, setBusy] = useState(false);
  /** A `?run=`/`?draft=` deep link that matched nothing in the queue — stated, never swallowed. */
  const [deepLinkMiss, setDeepLinkMiss] = useState<{ kind: "run" | "draft"; id: string } | null>(
    null,
  );
  // Approve/reject/edit/re-judge run the judge lane synchronously
  // server-side (judge-runner.ts) — a thrown failure (no gateway key, a
  // budget halt) must fail LOUDLY here rather than vanish, since the draft
  // itself honestly stays `judging` with nothing else to signal it happened.
  const [actionError, setActionError] = useState<string | null>(null);
  // Terminal-verb confirmation (s40): after approve/reject the only other
  // feedback is a pill quietly changing — essential under keyboard triage.
  const [toast, setToast] = useState<ToastState | null>(null);

  const selectDraft = useCallback((draftId: string | null) => {
    // Re-selecting the selected row is a no-op: setting "loading" here with
    // a same-value id would strand the card (React bails on the state set,
    // so the detail effect never re-fires — found s66 when newest-first
    // pre-selection made clicking the selected row possible).
    if (draftId !== null && draftId === selectedDraftIdRef.current) return;
    selectedDraftIdRef.current = draftId;
    setSelectedDraftId(draftId);
    setDetailStatus(draftId ? "loading" : "idle");
    // The failure belongs to the draft it happened on. Keying DraftCard
    // does NOT clear this one — it lives HERE, above the remount — so a
    // rejected approve on draft A would otherwise still be on screen,
    // in the error channel, under draft B (keyed-by-entity sweep, s78).
    setActionError(null);
  }, []);

  // The queue read: runs feed → each run's drafts → one flat FIFO list. The
  // wiring stays the existing two endpoints (contract frozen); the flattening
  // is presentation. Promise-chain form: every setState sits syntactically
  // inside a .then/.catch callback (react-hooks/set-state-in-effect — the
  // B1.4 lesson).
  const loadQueue = useCallback(() => {
    return fetchRunsFeed().then(async (runs) => {
      const perRun = await Promise.all(
        runs.map((run) => fetchRunDrafts(run.id).then((drafts) => drafts.map((draft) => ({ draft, run })))),
      );
      return flattenQueue(perRun);
    });
  }, []);

  /** Blocked rows' reasons — bounded, best-effort: a failed read leaves the row's neutral excerpt, never a fabricated reason. */
  const loadBlockedReasons = useCallback((queue: QueueItem[]) => {
    const blocked = queue
      .filter((i) => i.draft.status === "blocked" && !isStagedDraftFormat(i.draft.format))
      .slice(0, BLOCKED_REASON_READS);
    return Promise.all(
      blocked.map(({ draft }) =>
        fetchDraftDetail(draft.id)
          .then((detail) =>
            detail
              ? ([draft.id, judgeReasons(detail.judgeResults, detail.draft.bodyHash).map((r) => r.line)] as const)
              : null,
          )
          .catch(() => null),
      ),
    ).then((pairs) => Object.fromEntries(pairs.filter((p) => p !== null && p[1].length > 0) as [string, string[]][]));
  }, []);

  // No synchronous "loading" set here: the mount effect must not set state
  // in its own body (react-hooks/set-state-in-effect — the B1.4 lesson);
  // the initial state IS loading, and the retry handler below sets it from
  // an event, where it belongs.
  const loadSurface = useCallback(() => {
    return loadQueue()
      .then((data) => {
        setItems(data);
        setQueueStatus("success");
        return loadBlockedReasons(data).then((map) => {
          setReasons(map);
          return data;
        });
      })
      .catch(() => {
        setQueueStatus("error");
        return null;
      });
  }, [loadQueue, loadBlockedReasons]);

  useEffect(() => {
    let cancelled = false;
    loadSurface().then((data) => {
      // An EMPTY queue used to return before the deep-link check, so a
      // `?run=`/`?draft=` that missed said nothing at all — the one case
      // where the link is most obviously unresolvable was the one case with
      // no alert (the half lane 1's fix left, s78 WRAP cross-lane note).
      // `defaultSelection([])` is null and every miss branch below reads
      // correctly against an empty view, so the guard only needs to cover a
      // failed read — which the queue card reports itself.
      if (cancelled || !data) return;
      // Selection walks the DEFAULT view (newest first) — the mount-time
      // knobs, not whatever the state holds mid-render.
      const view = applyQueueView(data, "newest", "all");
      const { runId, draftId } = deepLinkRef.current;
      deepLinkRef.current = { runId: null, draftId: null };
      const linkedDraft = draftId && view.some((i) => i.draft.id === draftId) ? draftId : null;
      // A ?run= link lands on that run's own waiting work first.
      const runItems = runId ? view.filter((i) => i.run.id === runId) : [];
      const linkedRunDraft = (runItems.find((i) => isWaiting(i.draft)) ?? runItems[0])?.draft.id ?? null;
      // A deep link that matched NOTHING must say so. A failed run keeps its
      // `?run=` door (Runs rows are all doors, and the unarmed Retry's own
      // tooltip invites it), but a run that produced zero drafts has nothing
      // here — and falling silently through to defaultSelection put the
      // operator on an unrelated run's draft, under live Approve/Reject/Edit
      // controls, with no cue the request had missed (s77 finding,
      // runs-model.ts:133 — the half that lives on this surface).
      if (runId !== null && linkedDraft === null && linkedRunDraft === null) {
        setDeepLinkMiss({ kind: draftId !== null ? "draft" : "run", id: draftId ?? runId });
      } else if (draftId !== null && linkedDraft === null) {
        setDeepLinkMiss({ kind: "draft", id: draftId });
      }
      selectDraft(linkedDraft ?? linkedRunDraft ?? defaultSelection(view));
    });
    return () => {
      cancelled = true;
    };
  }, [loadSurface, selectDraft]);

  // Awaitable so refreshAfterAction can wait for the card's post-action
  // data to actually land before it resolves; guarded by selectedDraftIdRef
  // rather than a closure-scoped cancellation flag so ANY caller is
  // protected from a stale-selection clobber.
  const loadDraftDetail = useCallback((draftId: string) => {
    return fetchDraftDetail(draftId)
      .then((data) => {
        if (selectedDraftIdRef.current !== draftId) return;
        if (!data) {
          setDetailStatus("error");
          return;
        }
        setDetailDraft(data.draft);
        setJudgeResults(data.judgeResults);
        setDetailStatus("success");
      })
      .catch(() => {
        if (selectedDraftIdRef.current === draftId) setDetailStatus("error");
      });
  }, []);

  // The rendered view: tabs + family + direction over the stable flat list,
  // then grouped by consecutive run for the sheet's `.run-hd` bands.
  const view = useMemo(() => applyQueueView(items, sort, filter, family), [items, sort, filter, family]);
  const groups = useMemo(() => groupByRun(view), [view]);

  // A filter change can drop the selected draft out of the view — land the
  // selection back on the view's own default instead of a hidden row.
  useEffect(() => {
    if (!selectedDraftId || view.some((i) => i.draft.id === selectedDraftId)) return;
    selectDraft(defaultSelection(view));
  }, [view, selectedDraftId, selectDraft]);

  // A stage-artifact draft (storyboard/direction_doc, B5.4) swaps the detail
  // card for the staged-flow surface, which fetches its own flow state — the
  // card's detail fetch would be dead weight for it.
  const selectedItem = items.find((i) => i.draft.id === selectedDraftId) ?? null;
  const stagedSelected = selectedItem !== null && isStagedDraftFormat(selectedItem.draft.format);

  useEffect(() => {
    if (!selectedDraftId || stagedSelected) return;
    void loadDraftDetail(selectedDraftId);
  }, [selectedDraftId, stagedSelected, loadDraftDetail]);

  // The refresh every operator action (approve/reject/edit/re-judge) needs:
  // waits for the card's post-action, post-re-judge draft + judge results to
  // land before returning, so `busy` only clears once the card reflects the
  // real outcome, never the pre-action state.
  async function refreshAfterAction() {
    if (selectedDraftId) await loadDraftDetail(selectedDraftId);
    const queue = await loadQueue();
    setItems(queue);
    setReasons(await loadBlockedReasons(queue));
  }

  // Inside the workspace shell the needs-you badge counts queued+blocked —
  // nudge it after every operator action so it never lies (no-op when the
  // queue renders outside the shell, e.g. component tests).
  const pulse = usePulseSafe();

  // Always refreshes — even when `action` throws — so the card/queue reflect
  // the draft's TRUE current state (e.g. still `judging` after a failed
  // judge run) rather than stale pre-action data. `confirmToast` fires only
  // on success — a failed action must never read as a completed one.
  async function withBusy(action: () => Promise<unknown>, confirmToast?: ToastState) {
    setBusy(true);
    setActionError(null);
    let succeeded = true;
    try {
      await action();
    } catch (err) {
      succeeded = false;
      setActionError(err instanceof Error ? err.message : "Action failed");
    }
    try {
      await refreshAfterAction();
      await pulse?.refresh();
    } finally {
      setBusy(false);
    }
    if (succeeded && confirmToast) setToast(confirmToast);
  }

  // Reject ASKS FOR A REASON (the W1 grammar — Klaviyo's guidance pattern):
  // the stated reason becomes the eval_cases row in the same transaction as
  // queued→rejected (s90 window), which makes this control the learn loop's
  // front door. A blank reason is a bare decision — legal, recorded, no eval
  // row (the seat's own semantics); Cancel keeps the draft. Shared by the
  // button and the `r` key, so keyboard triage never skips the ask.
  function requestReject(draft: GridDraft) {
    const input = window.prompt(
      `Reject this ${draft.platform} draft?\n\nSay why and your words become an eval row the engine learns from. Leave blank to reject without one. Cancel keeps the draft.`,
      "",
    );
    if (input === null) return;
    const reason = input.trim();
    void withBusy(
      async () => {
        await rejectDraft(draft.id, reason || undefined);
        if (reason) setRejectReasons((prev) => ({ ...prev, [draft.id]: reason }));
      },
      { message: reason ? "Draft rejected — your reason became an eval row." : "Draft rejected." },
    );
  }

  /** The run band's batchable set — that group's queued, non-staged drafts. */
  function runBatchCount(group: RunGroup) {
    return group.items.filter(
      (i) => i.draft.status === "queued" && !isStagedDraftFormat(i.draft.format),
    ).length;
  }

  // The run band's "Approve run · N" (Deel): the same sequential
  // single-draft endpoint as the header's bulk verb, scoped to one run's
  // group, behind its own named confirm carrying the count.
  function approveRun(group: RunGroup) {
    const batch = group.items.filter(
      (i) => i.draft.status === "queued" && !isStagedDraftFormat(i.draft.format),
    );
    const count = batch.length;
    if (count === 0) return;
    if (
      !window.confirm(
        `Approve this run's ${count} waiting draft${count === 1 ? "" : "s"}? Each records its own approval.`,
      )
    ) {
      return;
    }
    void withBusy(
      async () => {
        for (const { draft } of batch) {
          await approveDraft(draft.id);
        }
      },
      { message: `Approved ${count} queued draft${count === 1 ? "" : "s"}.` },
    );
  }

  // Batch approve: every QUEUED draft in the CURRENT VIEW, in view order,
  // sequentially through the same single-draft endpoint (each approve still
  // records its own approval row) — the button's count and the acted-on set
  // always agree with what the operator sees. One named confirm with the
  // count (the bulk-bar convention). Stops loudly on the first failure —
  // the refresh then shows exactly how far it got. Stage artifacts advance
  // through their own staged surface — a batch approve must never skip that
  // walk.
  const queuedItems = view.filter(
    (i) => i.draft.status === "queued" && !isStagedDraftFormat(i.draft.format),
  );
  function batchApprove() {
    const count = queuedItems.length;
    if (!window.confirm(`Approve all ${count} waiting draft${count === 1 ? "" : "s"}? Each records its own approval.`)) {
      return;
    }
    void withBusy(
      async () => {
        for (const { draft } of queuedItems) {
          await approveDraft(draft.id);
        }
      },
      { message: `Approved ${count} queued draft${count === 1 ? "" : "s"}.` },
    );
  }

  // Keyboard triage (shared grammar since s40): j/k move the queue
  // selection, a/r act on the selected QUEUED draft ('e' lives in the draft
  // card, which owns edit state; r goes through the named confirm).
  // useListKeys guards typing targets and modifiers; the staged surface
  // owning the detail disables the whole grammar.
  // NAVIGATION IS NEVER OWNED BY THE DETAIL PANE. j/k used to ride the same
  // master gate as a/r, so selecting a staged row killed the whole grammar
  // while the footer still advertised five keys — the operator was stuck on
  // that row with no keyboard way off it (measured live s79: j moved 1→2 on
  // a plain row and did nothing at all on a staged one). StagedFlow binds no
  // keys of its own, and useListKeys already refuses while a typing target
  // has focus, so its form is unaffected.
  const moveSelection = (delta: 1 | -1) => (event: KeyboardEvent) => {
    if (view.length === 0) return;
    event.preventDefault();
    const current = view.findIndex((i) => i.draft.id === selectedDraftId);
    const next = current === -1 ? 0 : Math.min(Math.max(current + delta, 0), view.length - 1);
    selectDraft(view[next].draft.id);
  };
  const actOnSelected = (verb: "approve" | "reject") => (event: KeyboardEvent) => {
    // a/r stay gated on the staged branch: a stage artifact has no
    // approve/reject door on this surface at all, and a key that silently
    // did nothing would be the same lie one level down. The footer states it.
    if (stagedSelected) return;
    const selected = view.find((i) => i.draft.id === selectedDraftId)?.draft;
    if (!selected || selected.status !== "queued") return;
    event.preventDefault();
    if (verb === "reject") {
      requestReject(selected);
      return;
    }
    void withBusy(() => approveDraft(selected.id), { message: "Draft approved." });
  };
  useListKeys({
    enabled: !busy,
    bindings: {
      j: moveSelection(1),
      k: moveSelection(-1),
      a: actOnSelected("approve"),
      r: actOnSelected("reject"),
    },
  });

  // Zero-inbox: the shell pulse knows whether ANYTHING waits across all runs
  // — the queue card says so instead of showing an ambiguous quiet list.
  const inboxZero = queueStatus === "success" && pulse?.status === "success" && pulse.pulse?.needsYou === 0;

  const waitingCount = items.filter((i) => i.draft.status === "queued").length;
  const blockedCount = items.filter((i) => i.draft.status === "blocked").length;
  const stagedWaiting = items.filter(
    (i) => i.draft.status === "queued" && isStagedDraftFormat(i.draft.format),
  ).length;
  const scopeNote = batchScopeNote({
    waiting: waitingCount,
    batchable: queuedItems.length,
    stagedWaiting,
  });
  const sortLabel = SORT_OPTIONS.find((o) => o.value === sort)?.label ?? "";
  const familyLabel = FAMILY_OPTIONS.find((o) => o.value === family)?.label ?? "";

  return (
    // `approve-surface` is the anchor every rule in ./approve.css hangs off
    // — the sheets reuse helmet class names with different values across
    // surfaces, so a stylesheet that isn't anchored isn't scoped.
    <div className="content approve-surface">
      {/* j/k selection is a silent context change for screen readers without
          this: announce what the detail now shows (critique, Sam persona). */}
      <p aria-live="polite" className="sr-only">
        {selectedItem ? `Selected ${selectedItem.draft.platform} draft, status ${selectedItem.draft.status}` : ""}
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <h1 className="t-headline">Approve</h1>
        {waitingCount > 0 && <span className="pill pill-warn">{`${waitingCount} waiting`}</span>}
        {blockedCount > 0 && <span className="pill pill-err">{`${blockedCount} blocked`}</span>}
        {queueStatus === "success" && waitingCount === 0 && blockedCount === 0 && (
          <span className="pill pill-ok">Queue clear</span>
        )}
        <div style={{ flex: 1 }} />
        <div className="btn btn-ghost btn-sm sel-ctl">
          {sortLabel}
          <span className="chev" />
          <select
            className="sel-native"
            aria-label="Sort order"
            value={sort}
            onChange={(e) => setSort(e.target.value as QueueSort)}
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="btn btn-ghost btn-sm sel-ctl">
          {familyLabel}
          <span className="chev" />
          <select
            className="sel-native"
            aria-label="Family filter"
            value={family}
            onChange={(e) => setFamily(e.target.value as QueueFamily)}
          >
            {FAMILY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={busy || queuedItems.length === 0}
          title={
            queuedItems.length === 0
              ? "No waiting drafts — batch approve acts on judge-passed drafts only."
              : "Approve every waiting draft in the view (each records its own approval)."
          }
          onClick={batchApprove}
        >
          Approve all waiting ({queuedItems.length})
        </button>
      </div>
      {/* The two counts above describe different sets and both are true; this
          is the sentence that used to be missing between them. Absent when
          they agree. `.content` is a 20px-gap flex column, so the note is
          pulled up to read as part of the header band, not a stray line. */}
      {scopeNote !== null && (
        <span className="t-label" style={{ marginTop: -12 }}>
          {scopeNote}
        </span>
      )}
      {/* Absent entirely at rest — it exists only when a deep link missed. */}
      {deepLinkMiss !== null && (
        <div
          className="card"
          role="alert"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "11px 16px",
            borderColor: "color-mix(in oklab, var(--warn) 40%, var(--n-400))",
          }}
        >
          <span className="t-label">
            {deepLinkMiss.kind === "run"
              ? "That run has no drafts in this queue — a run can fail before it drafts anything. Nothing was selected for it; the queue's own default is showing instead."
              : "That draft isn’t in this queue — it may have been decided already. The queue’s own default is showing instead."}
          </span>
          <span className="t-data">{`${deepLinkMiss.kind} ${deepLinkMiss.id.slice(0, 8)}`}</span>
          <div style={{ flex: 1 }} />
          <Link className="btn btn-ghost btn-sm" href="/app/runs">
            Back to Runs
          </Link>
          <button
            type="button"
            className="btn btn-quiet btn-sm"
            onClick={() => setDeepLinkMiss(null)}
          >
            Dismiss
          </button>
        </div>
      )}
      <div className="split">
        <QueueCard
          status={queueStatus}
          groups={groups}
          allItems={items}
          filter={filter}
          onFilter={setFilter}
          selectedDraftId={selectedDraftId}
          reasons={reasons}
          rejectReasons={rejectReasons}
          inboxZero={inboxZero}
          actionsDisabled={stagedSelected}
          busy={busy}
          onSelect={selectDraft}
          onApproveRun={approveRun}
          runBatchCount={runBatchCount}
          onRetry={() => {
            setQueueStatus("loading");
            void loadSurface();
          }}
        />
        {stagedSelected && selectedDraftId ? (
          // The staged surface owns the detail card's inside AND its own
          // labelled region — the plain draft detail is honestly gone, not
          // wrapped around it.
          <section
            className="card"
            style={{ display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}
          >
            {/* Keyed remount per anchor draft so the surface never shows a stale flow. */}
            <StagedFlow
              key={selectedDraftId}
              draftId={selectedDraftId}
              onDraftChanged={() => void refreshAfterAction()}
            />
          </section>
        ) : (
          // Keyed remount per draft, exactly as StagedFlow above it. The
          // editor's body lives INSIDE this card, so without the key an
          // open editor survives the switch and "Save edit" writes draft
          // A's body onto draft B (keyed-by-entity sweep, s78).
          <DraftCard
            key={selectedDraftId ?? "none"}
            status={detailStatus}
            draft={detailDraft}
            run={selectedItem?.run ?? null}
            judgeResults={judgeResults}
            busy={busy}
            actionError={actionError}
            onApprove={() =>
              selectedDraftId && withBusy(() => approveDraft(selectedDraftId), { message: "Draft approved." })
            }
            onReject={() => detailDraft && requestReject(detailDraft)}
            onEditSave={(body) => selectedDraftId && withBusy(() => editDraft(selectedDraftId, body))}
            onReJudge={() => selectedDraftId && withBusy(() => reJudgeDraft(selectedDraftId))}
            onPublish={() => selectedDraftId && withBusy(() => publishDraft(selectedDraftId))}
          />
        )}
      </div>
      <ActionToast toast={toast} onClear={() => setToast(null)} />
    </div>
  );
}
