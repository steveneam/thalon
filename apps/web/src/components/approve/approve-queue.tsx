"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApprovePanel, type PanelStatus } from "@/components/approve/approve-panel";
import { FanoutGrid, type GridStatus } from "@/components/approve/fanout-grid";
import { FeedPanel, type FeedStatus } from "@/components/approve/feed-panel";
import {
  approveDraft,
  editDraft,
  fetchDraftDetail,
  fetchRunDrafts,
  fetchRunsFeed,
  reJudgeDraft,
  rejectDraft,
} from "@/lib/approve-queue/client";
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
  const loadDraftDetail = useCallback(async (draftId: string) => {
    try {
      const data = await fetchDraftDetail(draftId);
      if (selectedDraftIdRef.current !== draftId) return;
      if (!data) {
        setPanelStatus("error");
        return;
      }
      setPanelDraft(data.draft);
      setJudgeResults(data.judgeResults);
      setPanelStatus("success");
    } catch {
      if (selectedDraftIdRef.current === draftId) setPanelStatus("error");
    }
  }, []);

  useEffect(() => {
    if (!selectedDraftId) return;
    loadDraftDetail(selectedDraftId);
  }, [selectedDraftId, loadDraftDetail]);

  // The refresh every operator action (approve/reject/edit/re-judge) needs:
  // waits for the panel's post-action, post-re-judge draft + judge results to
  // land before returning, so `busy` only clears once the panel reflects the
  // real outcome, never the pre-action state.
  async function refreshAfterAction() {
    if (selectedDraftId) await loadDraftDetail(selectedDraftId);
    if (selectedRunId) setDrafts(await fetchRunDrafts(selectedRunId));
  }

  async function withBusy(action: () => Promise<unknown>) {
    setBusy(true);
    try {
      await action();
      await refreshAfterAction();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-1 flex-col md:flex-row">
      <FeedPanel status={feedStatus} runs={runs} selectedRunId={selectedRunId} onSelect={selectRun} />
      <FanoutGrid status={gridStatus} drafts={drafts} selectedDraftId={selectedDraftId} onSelect={selectDraft} />
      <ApprovePanel
        status={panelStatus}
        draft={panelDraft}
        judgeResults={judgeResults}
        busy={busy}
        onApprove={() => selectedDraftId && withBusy(() => approveDraft(selectedDraftId))}
        onReject={() => selectedDraftId && withBusy(() => rejectDraft(selectedDraftId))}
        onEditSave={(body) => selectedDraftId && withBusy(() => editDraft(selectedDraftId, body))}
        onReJudge={() => selectedDraftId && withBusy(() => reJudgeDraft(selectedDraftId))}
      />
    </div>
  );
}
