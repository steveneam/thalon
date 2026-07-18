"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { ApprovePanel, type PanelStatus } from "@/components/approve/approve-panel";
import { QueueList, type QueueItem, type QueueStatus } from "@/components/approve/queue-list";
import { StagedFlow } from "@/components/staged/staged-flow";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import { useListKeys } from "@/lib/workspace/keyboard";
import { isStagedDraftFormat } from "@/lib/staged-flow/types";
import type { GridDraft, PanelJudgeResult } from "@/lib/approve-queue/types";
import { cn } from "@/lib/utils";

/** ?run=/?draft= from the mount-time URL — SSR-safe, router-free (see deepLinkRef below). */
function readDeepLink(): { runId: string | null; draftId: string | null } {
  const params =
    typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  return { runId: params?.get("run") ?? null, draftId: params?.get("draft") ?? null };
}

/**
 * The flat FIFO queue: every draft of every feed run, oldest first (triage
 * order — the design's list reads top-down from the longest-waiting item).
 * Ties (fixture-shaped data) break on platform then id for a stable walk.
 */
function flattenQueue(perRun: QueueItem[][]): QueueItem[] {
  return perRun.flat().sort((a, b) => {
    const at = new Date(a.draft.createdAt).getTime();
    const bt = new Date(b.draft.createdAt).getTime();
    return at - bt || a.draft.platform.localeCompare(b.draft.platform) || a.draft.id.localeCompare(b.draft.id);
  });
}

/** Waiting on the operator = judge-passed (queued) or judge-blocked. */
function isWaiting(draft: GridDraft): boolean {
  return draft.status === "queued" || draft.status === "blocked";
}

/**
 * Default selection honors the dashboard's promise (critique P1, s39): "N
 * drafts wait on you" must land ON waiting work — the oldest waiting draft,
 * scoped to runs whose server-derived `waiting` count claims operator work
 * (the staged demo run deliberately reports waiting: 0 so the fixture flow
 * never hijacks the mount — the count-agreement invariant).
 */
function defaultSelection(items: QueueItem[]): string | null {
  const waiting = items.find((item) => item.run.waiting > 0 && isWaiting(item.draft));
  return (waiting ?? items[0])?.draft.id ?? null;
}

/** Composes the Approve surface (Phase I): flat queue list + informed-consent detail. */
export function ApproveQueue() {
  const [queueStatus, setQueueStatus] = useState<QueueStatus>("loading");
  const [items, setItems] = useState<QueueItem[]>([]);
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);
  // Mirrors selectedDraftId so an in-flight panel fetch can tell, once it
  // resolves, whether the operator has since selected something else — a
  // stale fetch discards itself instead of clobbering the panel. This is
  // also what makes refreshAfterAction's post-action re-fetch reliably land
  // as the panel's true latest state rather than racing an earlier fetch.
  const selectedDraftIdRef = useRef<string | null>(null);

  // One-shot deep-link targets (?run= / ?draft= — provenance links land on
  // the ENTITY, not just the surface): consumed by the first queue load,
  // after which normal selection owns the state. Read from location rather
  // than useSearchParams — the value is only ever consumed once at mount, and
  // this keeps the component mountable outside a Next router (tests).
  const deepLinkRef = useRef(readDeepLink());

  const [panelStatus, setPanelStatus] = useState<PanelStatus>("idle");
  const [panelDraft, setPanelDraft] = useState<GridDraft | null>(null);
  const [judgeResults, setJudgeResults] = useState<PanelJudgeResult[]>([]);
  const [busy, setBusy] = useState(false);
  // Approve/reject/edit/re-judge run the judge lane synchronously
  // server-side (judge-runner.ts) — a thrown failure (no gateway key, a
  // budget halt) must fail LOUDLY here rather than vanish, since the draft
  // itself honestly stays `judging` with nothing else to signal it happened.
  const [actionError, setActionError] = useState<string | null>(null);
  // Terminal-verb confirmation (s40): after approve/reject the only other
  // feedback is a badge quietly changing — essential under keyboard triage.
  // True undo rides the queued B-crm approve/reject contract change.
  const [toast, setToast] = useState<ToastState | null>(null);

  const selectDraft = useCallback((draftId: string | null) => {
    selectedDraftIdRef.current = draftId;
    setSelectedDraftId(draftId);
    setPanelStatus(draftId ? "loading" : "idle");
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

  useEffect(() => {
    let cancelled = false;
    loadQueue()
      .then((data) => {
        if (cancelled) return;
        setItems(data);
        setQueueStatus("success");
        if (data.length === 0) return;
        const { runId, draftId } = deepLinkRef.current;
        deepLinkRef.current = { runId: null, draftId: null };
        const linkedDraft = draftId && data.some((i) => i.draft.id === draftId) ? draftId : null;
        // A ?run= link lands on that run's own waiting work first.
        const runItems = runId ? data.filter((i) => i.run.id === runId) : [];
        const linkedRunDraft = (runItems.find((i) => isWaiting(i.draft)) ?? runItems[0])?.draft.id ?? null;
        selectDraft(linkedDraft ?? linkedRunDraft ?? defaultSelection(data));
      })
      .catch(() => {
        if (!cancelled) setQueueStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [loadQueue, selectDraft]);

  // Awaitable so refreshAfterAction can wait for the panel's post-action
  // data to actually land before it resolves; guarded by selectedDraftIdRef
  // rather than a closure-scoped cancellation flag so ANY caller is
  // protected from a stale-selection clobber.
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

  // A stage-artifact draft (storyboard/direction_doc, B5.4) swaps the detail
  // pane for the staged-flow surface, which fetches its own flow state — the
  // panel's detail fetch would be dead weight for it.
  const selectedItem = items.find((i) => i.draft.id === selectedDraftId) ?? null;
  const stagedSelected = selectedItem !== null && isStagedDraftFormat(selectedItem.draft.format);

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
    setItems(await loadQueue());
  }

  // Inside the workspace shell the needs-you badge counts queued+blocked —
  // nudge it after every operator action so it never lies (no-op when the
  // queue renders outside the shell, e.g. component tests).
  const pulse = usePulseSafe();

  // Always refreshes — even when `action` throws — so the panel/queue reflect
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

  // Reject's NAMED confirm (the consent design: "reject asks for a named
  // confirm") — shared by the button and the `r` key, so keyboard triage
  // never skips it.
  function requestReject(draft: GridDraft) {
    const confirmed = window.confirm(
      `Reject this ${draft.platform} draft? The rejection is recorded and the draft closes.`,
    );
    if (!confirmed) return;
    void withBusy(() => rejectDraft(draft.id), { message: "Draft rejected." });
  }

  // Batch approve: every QUEUED draft across the queue, in queue order,
  // sequentially through the same single-draft endpoint (each approve still
  // records its own approval row). One named confirm with the count (the
  // bulk-bar convention). Stops loudly on the first failure — the refresh
  // then shows exactly how far it got. Stage artifacts advance through
  // their own staged surface — a batch approve must never skip that walk.
  const queuedItems = items.filter(
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
  // selection, a/r act on the selected QUEUED draft ('e' lives in the panel,
  // which owns edit state; r goes through the named confirm). useListKeys
  // guards typing targets and modifiers; the staged surface owning the
  // detail disables the whole grammar.
  const moveSelection = (delta: 1 | -1) => (event: KeyboardEvent) => {
    if (items.length === 0) return;
    event.preventDefault();
    const current = items.findIndex((i) => i.draft.id === selectedDraftId);
    const next = current === -1 ? 0 : Math.min(Math.max(current + delta, 0), items.length - 1);
    selectDraft(items[next].draft.id);
  };
  const actOnSelected = (verb: "approve" | "reject") => (event: KeyboardEvent) => {
    const selected = items.find((i) => i.draft.id === selectedDraftId)?.draft;
    if (!selected || selected.status !== "queued") return;
    event.preventDefault();
    if (verb === "reject") {
      requestReject(selected);
      return;
    }
    void withBusy(() => approveDraft(selected.id), { message: "Draft approved." });
  };
  useListKeys({
    enabled: !busy && !stagedSelected,
    bindings: {
      j: moveSelection(1),
      k: moveSelection(-1),
      a: actOnSelected("approve"),
      r: actOnSelected("reject"),
    },
  });

  // Zero-inbox ([+]): the shell pulse knows whether ANYTHING waits across
  // all runs — celebrate it instead of showing an ambiguous quiet queue.
  const zeroInbox = queueStatus === "success" && pulse?.status === "success" && pulse.pulse?.needsYou === 0;

  const waitingCount = items.filter((i) => i.draft.status === "queued").length;
  const blockedCount = items.filter((i) => i.draft.status === "blocked").length;

  return (
    // min-h-0 (not min-h-screen): the queue fills the workspace shell's main
    // area; the shell owns the viewport height.
    <div className="flex min-h-0 flex-1 flex-col gap-3 p-4 lg:p-6">
      {/* j/k selection is a silent context change for screen readers without
          this: announce what the detail now shows (critique, Sam persona). */}
      <p aria-live="polite" className="sr-only">
        {selectedItem ? `Selected ${selectedItem.draft.platform} draft, status ${selectedItem.draft.status}` : ""}
      </p>
      {zeroInbox && (
        <p className="rounded-lg border border-primary/25 bg-primary/5 px-4 py-2 text-sm">
          <span className="font-medium text-primary">Inbox zero.</span>{" "}
          <span className="text-muted-foreground">
            Nothing waits on you — new drafts land here the moment the judge passes them.
          </span>
        </p>
      )}
      <Card className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden py-0">
        <div className="flex flex-wrap items-center gap-2.5 border-b border-border px-4 py-3 lg:px-5">
          <h1 className="text-lg font-semibold tracking-tight">Approve</h1>
          {waitingCount > 0 && <Badge variant="signal">{waitingCount} waiting</Badge>}
          {blockedCount > 0 && <Badge variant="secondary">{blockedCount} blocked</Badge>}
          <div className="flex-1" />
          <Button
            variant="outline"
            size="sm"
            disabled={busy || queuedItems.length === 0}
            title={
              queuedItems.length === 0
                ? "No waiting drafts — batch approve acts on judge-passed drafts only."
                : "Approve every waiting draft in the queue (each records its own approval)."
            }
            onClick={batchApprove}
          >
            Approve all waiting ({queuedItems.length})
          </Button>
          <span className="u-eyebrow text-muted-foreground">
            keys · j/k row · a approve · r reject · e edit · confirms intact
          </span>
        </div>

        <div className="grid min-h-0 flex-1 md:grid-cols-[1fr_1.5fr]">
          <div className={cn("min-h-0 flex-col", selectedDraftId ? "hidden md:flex" : "flex")}>
            <QueueList
              status={queueStatus}
              items={items}
              selectedDraftId={selectedDraftId}
              onSelect={selectDraft}
            />
          </div>
          <div className={cn("min-h-0 flex-col", selectedDraftId ? "flex" : "hidden md:flex")}>
            {stagedSelected && selectedDraftId ? (
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="border-b border-border px-3 py-1.5 md:hidden">
                  <Button variant="ghost" size="sm" onClick={() => selectDraft(null)}>
                    <ArrowLeft aria-hidden data-icon="inline-start" />
                    Queue
                  </Button>
                </div>
                {/* Keyed remount per anchor draft so the surface never shows a stale flow. */}
                <StagedFlow key={selectedDraftId} draftId={selectedDraftId} />
              </div>
            ) : (
              <ApprovePanel
                status={panelStatus}
                draft={panelDraft}
                run={selectedItem?.run ?? null}
                judgeResults={judgeResults}
                busy={busy}
                actionError={actionError}
                onApprove={() =>
                  selectedDraftId &&
                  withBusy(() => approveDraft(selectedDraftId), { message: "Draft approved." })
                }
                onReject={() => panelDraft && requestReject(panelDraft)}
                onEditSave={(body) => selectedDraftId && withBusy(() => editDraft(selectedDraftId, body))}
                onReJudge={() => selectedDraftId && withBusy(() => reJudgeDraft(selectedDraftId))}
                onPublish={() => selectedDraftId && withBusy(() => publishDraft(selectedDraftId))}
                onBack={() => selectDraft(null)}
              />
            )}
          </div>
        </div>
      </Card>
      <ActionToast toast={toast} onClear={() => setToast(null)} />
    </div>
  );
}
