"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApprovePanel, type PanelStatus } from "@/components/approve/approve-panel";
import { FanoutGrid, type GridStatus } from "@/components/approve/fanout-grid";
import { FeedPanel, type FeedStatus } from "@/components/approve/feed-panel";
import { StagedFlow } from "@/components/staged/staged-flow";
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
import { isTypingTarget } from "@/lib/approve-queue/keyboard";
import { isStagedDraftFormat } from "@/lib/staged-flow/types";
import type { FeedRun, GridDraft, PanelJudgeResult } from "@/lib/approve-queue/types";

/** Composes the 3-zone Approve queue: feed selection drives the grid, grid selection drives the panel. */
export function ApproveQueue() {
  const [feedStatus, setFeedStatus] = useState<FeedStatus>("loading");
  const [runs, setRuns] = useState<FeedRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  const [gridStatus, setGridStatus] = useState<GridStatus>("idle");
  const [drafts, setDrafts] = useState<GridDraft[]>([]);
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);
  // Mirrors selectedDraftId so an in-flight panel fetch can tell, once it
  // resolves, whether the operator has since selected something else — a
  // stale fetch discards itself instead of clobbering the panel. This is
  // also what makes refreshAfterAction's post-action re-fetch reliably land
  // as the panel's true latest state rather than racing an earlier fetch.
  const selectedDraftIdRef = useRef<string | null>(null);

  const [panelStatus, setPanelStatus] = useState<PanelStatus>("idle");
  const [panelDraft, setPanelDraft] = useState<GridDraft | null>(null);
  const [judgeResults, setJudgeResults] = useState<PanelJudgeResult[]>([]);
  const [busy, setBusy] = useState(false);
  // Approve/reject/edit/re-judge now run the judge lane synchronously
  // server-side (judge-runner.ts) — a thrown failure (no gateway key, a
  // budget halt) must fail LOUDLY here rather than vanish, since the draft
  // itself honestly stays `judging` with nothing else to signal it happened.
  const [actionError, setActionError] = useState<string | null>(null);

  // Selection changes are EVENTS: every synchronous status/selection reset
  // lives in these handlers, never in an effect body
  // (react-hooks/set-state-in-effect) — the effects below only fetch and set
  // state asynchronously when data arrives.
  const selectDraft = useCallback((draftId: string | null) => {
    selectedDraftIdRef.current = draftId;
    setSelectedDraftId(draftId);
    setPanelStatus(draftId ? "loading" : "idle");
  }, []);

  const selectRun = useCallback(
    (runId: string | null) => {
      setSelectedRunId(runId);
      setGridStatus(runId ? "loading" : "idle");
      selectDraft(null);
    },
    [selectDraft],
  );

  useEffect(() => {
    let cancelled = false;
    fetchRunsFeed()
      .then((data) => {
        if (cancelled) return;
        setRuns(data);
        setFeedStatus("success");
        if (data.length > 0) selectRun(data[0].id);
      })
      .catch(() => {
        if (!cancelled) setFeedStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [selectRun]);

  useEffect(() => {
    if (!selectedRunId) return;
    let cancelled = false;
    fetchRunDrafts(selectedRunId)
      .then((data) => {
        if (cancelled) return;
        setDrafts(data);
        setGridStatus("success");
        if (data.length > 0) selectDraft(data[0].id);
      })
      .catch(() => {
        if (!cancelled) setGridStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [selectedRunId, selectDraft]);

  // Awaitable (unlike the old fire-and-forget version) so refreshAfterAction
  // can wait for the panel's post-action data to actually land before it
  // resolves; guarded by selectedDraftIdRef rather than a closure-scoped
  // cancellation flag so ANY caller of this function — the effect below or a
  // direct refresh call — is protected from a stale-selection clobber.
  // Promise-chain form (not async/await): every setState sits syntactically
  // inside a .then/.catch callback, matching the run-selection effect above —
  // the set-state-in-effect lint rule can't see through an async fn boundary
  // and would flag the effect below as a synchronous setState (B1.4 lesson).
  const loadDraftDetail = useCallback((draftId: string) => {
    return fetchDraftDetail(draftId)
      .then((data) => {
        if (selectedDraftIdRef.current !== draftId) return;
        if (!data) {
          setPanelStatus("error");
          return;
        }
        setPanelDraft(data.draft);
        setJudgeResults(data.judgeResults);
        setPanelStatus("success");
      })
      .catch(() => {
        if (selectedDraftIdRef.current === draftId) setPanelStatus("error");
      });
  }, []);

  // A stage-artifact draft (storyboard/direction_doc, B5.4) swaps zones 2+3
  // for the staged-flow surface, which fetches its own flow state — the
  // panel's detail fetch would be dead weight for it.
  const selectedDraft = drafts.find((d) => d.id === selectedDraftId) ?? null;
  const stagedSelected = selectedDraft !== null && isStagedDraftFormat(selectedDraft.format);

  useEffect(() => {
    if (!selectedDraftId || stagedSelected) return;
    void loadDraftDetail(selectedDraftId);
  }, [selectedDraftId, stagedSelected, loadDraftDetail]);

  // The refresh every operator action (approve/reject/edit/re-judge) needs:
  // waits for the panel's post-action, post-re-judge draft + judge results to
  // land before returning, so `busy` only clears once the panel reflects the
  // real outcome, never the pre-action state.
  async function refreshAfterAction() {
    if (selectedDraftId) await loadDraftDetail(selectedDraftId);
    if (selectedRunId) setDrafts(await fetchRunDrafts(selectedRunId));
  }

  // Inside the workspace shell the needs-you badge counts queued+blocked —
  // nudge it after every operator action so it never lies (no-op when the
  // queue renders outside the shell, e.g. component tests).
  const pulse = usePulseSafe();

  // Always refreshes — even when `action` throws — so the panel/grid reflect
  // the draft's TRUE current state (e.g. still `judging` after a failed
  // judge run) rather than stale pre-action data.
  async function withBusy(action: () => Promise<unknown>) {
    setBusy(true);
    setActionError(null);
    try {
      await action();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Action failed");
    }
    try {
      await refreshAfterAction();
      await pulse?.refresh();
    } finally {
      setBusy(false);
    }
  }

  // Batch approve (B6.2): every QUEUED draft in the selected run, in grid
  // order, sequentially through the same single-draft endpoint (each approve
  // still records its own approval row). Stops loudly on the first failure —
  // the refresh then shows exactly how far it got.
  const queuedDrafts = drafts.filter((d) => d.status === "queued");
  function batchApprove() {
    void withBusy(async () => {
      for (const draft of queuedDrafts) {
        await approveDraft(draft.id);
      }
    });
  }

  // Keyboard triage (B6.2 [+]): j/k move the grid selection, a/r act on the
  // selected QUEUED draft ('e' lives in the panel, which owns edit state).
  // Never fires while typing or while the staged surface owns the screen.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (busy || stagedSelected || isTypingTarget(event.target)) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key === "j" || event.key === "k") {
        if (drafts.length === 0) return;
        event.preventDefault();
        const current = drafts.findIndex((d) => d.id === selectedDraftId);
        const next =
          current === -1
            ? 0
            : Math.min(Math.max(current + (event.key === "j" ? 1 : -1), 0), drafts.length - 1);
        selectDraft(drafts[next].id);
      } else if (event.key === "a" || event.key === "r") {
        const selected = drafts.find((d) => d.id === selectedDraftId);
        if (!selected || selected.status !== "queued") return;
        event.preventDefault();
        void withBusy(() =>
          event.key === "a" ? approveDraft(selected.id) : rejectDraft(selected.id),
        );
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // withBusy is recreated per render; re-registering the listener is cheap
    // and keeps every closure fresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy, stagedSelected, drafts, selectedDraftId, selectDraft]);

  // Zero-inbox ([+]): the shell pulse knows whether ANYTHING waits across
  // all runs — celebrate it instead of showing an ambiguous quiet queue.
  const zeroInbox = feedStatus === "success" && pulse?.status === "success" && pulse.pulse?.needsYou === 0;

  return (
    // min-h-0 (not min-h-screen): the queue fills the workspace shell's main
    // area; the shell owns the viewport height.
    <div className="flex min-h-0 flex-1 flex-col">
      {zeroInbox && (
        <p className="border-b border-primary/25 bg-primary/5 px-4 py-2 text-sm">
          <span className="font-medium text-primary">Inbox zero.</span>{" "}
          <span className="text-muted-foreground">
            Nothing waits on you — new drafts land here the moment the judge passes them.
          </span>
        </p>
      )}
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <FeedPanel status={feedStatus} runs={runs} selectedRunId={selectedRunId} onSelect={selectRun} />
        {stagedSelected && selectedDraftId ? (
          // Keyed remount per anchor draft so the surface never shows a stale flow.
          <StagedFlow key={selectedDraftId} draftId={selectedDraftId} />
        ) : (
          <>
            <FanoutGrid
              status={gridStatus}
              drafts={drafts}
              selectedDraftId={selectedDraftId}
              onSelect={selectDraft}
              busy={busy}
              queuedCount={queuedDrafts.length}
              onBatchApprove={batchApprove}
            />
            <ApprovePanel
              status={panelStatus}
              draft={panelDraft}
              judgeResults={judgeResults}
              busy={busy}
              actionError={actionError}
              onApprove={() => selectedDraftId && withBusy(() => approveDraft(selectedDraftId))}
              onReject={() => selectedDraftId && withBusy(() => rejectDraft(selectedDraftId))}
              onEditSave={(body) => selectedDraftId && withBusy(() => editDraft(selectedDraftId, body))}
              onReJudge={() => selectedDraftId && withBusy(() => reJudgeDraft(selectedDraftId))}
              onPublish={() => selectedDraftId && withBusy(() => publishDraft(selectedDraftId))}
            />
          </>
        )}
      </div>
    </div>
  );
}
