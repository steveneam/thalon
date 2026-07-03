"use client";

import { useCallback, useEffect, useState } from "react";
import { ApprovePanel, type PanelStatus } from "@/components/approve/approve-panel";
import { FanoutGrid, type GridStatus } from "@/components/approve/fanout-grid";
import { FeedPanel, type FeedStatus } from "@/components/approve/feed-panel";
import {
  approveDraft,
  editDraft,
  fetchDraftDetail,
  fetchRunDrafts,
  fetchRunsFeed,
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

  const [panelStatus, setPanelStatus] = useState<PanelStatus>("idle");
  const [panelDraft, setPanelDraft] = useState<GridDraft | null>(null);
  const [judgeResults, setJudgeResults] = useState<PanelJudgeResult[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchRunsFeed()
      .then((data) => {
        if (cancelled) return;
        setRuns(data);
        setFeedStatus("success");
        if (data.length > 0) setSelectedRunId(data[0].id);
      })
      .catch(() => {
        if (!cancelled) setFeedStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedRunId) return;
    let cancelled = false;
    setGridStatus("loading");
    setSelectedDraftId(null);
    fetchRunDrafts(selectedRunId)
      .then((data) => {
        if (cancelled) return;
        setDrafts(data);
        setGridStatus("success");
        if (data.length > 0) setSelectedDraftId(data[0].id);
      })
      .catch(() => {
        if (!cancelled) setGridStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [selectedRunId]);

  const loadDraftDetail = useCallback((draftId: string) => {
    let cancelled = false;
    setPanelStatus("loading");
    fetchDraftDetail(draftId)
      .then((data) => {
        if (cancelled) return;
        if (!data) {
          setPanelStatus("error");
          return;
        }
        setPanelDraft(data.draft);
        setJudgeResults(data.judgeResults);
        setPanelStatus("success");
      })
      .catch(() => {
        if (!cancelled) setPanelStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedDraftId) {
      setPanelStatus("idle");
      return;
    }
    return loadDraftDetail(selectedDraftId);
  }, [selectedDraftId, loadDraftDetail]);

  async function refreshAfterAction() {
    if (selectedDraftId) loadDraftDetail(selectedDraftId);
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
      <FeedPanel status={feedStatus} runs={runs} selectedRunId={selectedRunId} onSelect={setSelectedRunId} />
      <FanoutGrid status={gridStatus} drafts={drafts} selectedDraftId={selectedDraftId} onSelect={setSelectedDraftId} />
      <ApprovePanel
        status={panelStatus}
        draft={panelDraft}
        judgeResults={judgeResults}
        busy={busy}
        onApprove={() => selectedDraftId && withBusy(() => approveDraft(selectedDraftId))}
        onReject={() => selectedDraftId && withBusy(() => rejectDraft(selectedDraftId))}
        onEditSave={(body) => selectedDraftId && withBusy(() => editDraft(selectedDraftId, body))}
      />
    </div>
  );
}
