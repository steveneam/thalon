"use client";

import { useCallback, useEffect, useState } from "react";
import {
  directionDocDraftMetaSchema,
  storyboardDraftMetaSchema,
  type DirectionDoc,
} from "@thalon/contracts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { JudgeBadge } from "@/components/approve/judge-badge";
import { CandidatePicker } from "@/components/staged/candidate-picker";
import { CaptureLog } from "@/components/staged/capture-log";
import { DirectionEditor } from "@/components/staged/direction-editor";
import { StagePreview, type PreviewScene } from "@/components/staged/stage-preview";
import { StageRail } from "@/components/staged/stage-rail";
import { StoryboardCards } from "@/components/staged/storyboard-cards";
import { advanceStage, fetchStagedFlow, pickCandidate, sendStagedEdit } from "@/lib/staged-flow/client";
import type { Rfc6902Op } from "@/lib/staged-flow/patch";
import type { FlowStage, StagedEditKind, StagedFlowState, StoryboardContent } from "@/lib/staged-flow/types";

interface StagedFlowProps {
  /** Any stage draft of the chain (the grid's selected draft) — the flow anchors on it. */
  draftId: string;
}

type FlowStatus = "loading" | "error" | "success";

/** Fake-driver fallback mirroring the store's, for storyboard scenes without a duration hint (preview only). */
const PREVIEW_FALLBACK_DURATION_MS = 4000;

/**
 * The advanced-mode staged-flow surface (B5.4): replaces the grid+panel
 * zones when a stage-artifact draft is selected. The operator always reacts
 * to visible artifacts — storyboard cards, candidate takes, the direction
 * document, a per-stage preview — never a chain of blank prompt boxes.
 * Every interaction round-trips through the staged seam as a verbatim
 * RFC-6902 patch and lands in the capture log.
 */
export function StagedFlow({ draftId }: StagedFlowProps) {
  const [status, setStatus] = useState<FlowStatus>("loading");
  const [flow, setFlow] = useState<StagedFlowState | null>(null);
  const [viewIndex, setViewIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  // Accepted beats are UI state per artifact VERSION: keyed by draftId+bodyHash,
  // so a tweak (new hash) honestly clears the "reviewed as-is" chips.
  const [acceptedByArtifact, setAcceptedByArtifact] = useState<Record<string, number[]>>({});

  useEffect(() => {
    // Promise-chain form on purpose: every setState sits inside .then/.catch
    // (the set-state-in-effect rule can't see through async fn boundaries —
    // see loadDraftDetail in approve-queue.tsx). The cancelled flag guards
    // against a stale fetch landing after the operator moved on (the parent
    // additionally remounts this surface per anchor draft via key).
    let cancelled = false;
    fetchStagedFlow(draftId)
      .then((data) => {
        if (cancelled) return;
        setFlow(data);
        setViewIndex(data.currentIndex);
        setStatus("success");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [draftId]);

  // Mutations return the refreshed flow — no refetch; busy only clears once
  // the surface reflects the outcome. A failed action surfaces loudly and
  // leaves the last good state visible.
  const withBusy = useCallback(
    (action: () => Promise<StagedFlowState>, onSuccess?: (next: StagedFlowState) => void) => {
      setBusy(true);
      setActionError(null);
      return action()
        .then((next) => {
          setFlow(next);
          onSuccess?.(next);
        })
        .catch((err) => {
          setActionError(err instanceof Error ? err.message : "Action failed");
        })
        .finally(() => setBusy(false));
    },
    [],
  );

  if (status !== "success" || !flow) {
    return (
      <section aria-label="Staged video flow" className="flex flex-1 flex-col gap-2 p-3">
        {status === "loading" && <p className="text-sm text-muted-foreground">Loading staged flow…</p>}
        {status === "error" && <p className="text-sm text-destructive">Couldn&rsquo;t load this staged flow.</p>}
      </section>
    );
  }

  const stage = flow.stages[Math.min(viewIndex, flow.stages.length - 1)];
  const isCurrent = viewIndex === flow.currentIndex;
  const isFinal = viewIndex === flow.stages.length - 1;
  const stageDraft = stage.draft;
  const acceptedKey = stageDraft ? `${stageDraft.id}:${stageDraft.bodyHash}` : "";
  const accepted: ReadonlySet<number> = new Set(acceptedByArtifact[acceptedKey] ?? []);

  const onEdit = (kind: StagedEditKind, patch: Rfc6902Op[], note?: string) => {
    if (!stageDraft) return;
    void withBusy(() => sendStagedEdit(stageDraft.id, kind, patch, note));
  };

  const onAccept = (sceneIndex: number) => {
    if (!stageDraft) return;
    void withBusy(
      () => sendStagedEdit(stageDraft.id, "accept", [], `scene ${sceneIndex + 1}`),
      () =>
        setAcceptedByArtifact((prev) => ({
          ...prev,
          [acceptedKey]: [...(prev[acceptedKey] ?? []), sceneIndex],
        })),
    );
  };

  const canAdvance =
    isCurrent && !isFinal && !!stageDraft && (stageDraft.status === "queued" || stageDraft.status === "approved");

  return (
    <section aria-label="Staged video flow" className="flex flex-1 flex-col gap-3 overflow-y-auto p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">
          Staged video — advanced mode
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            {flow.family} plan · {flow.plan.stages.length} stages · fake drivers (B5.4)
          </span>
        </h2>
        {stageDraft && <JudgeBadge results={stage.judgeResults} bodyHash={stageDraft.bodyHash} />}
      </div>
      <StageRail stages={flow.stages} viewIndex={viewIndex} onView={setViewIndex} />
      {actionError && (
        <p className="text-xs text-destructive" role="alert">
          {actionError}
        </p>
      )}
      <StageContent
        stage={stage}
        presets={flow.presets}
        busy={busy}
        accepted={accepted}
        onPick={(candidateId) =>
          void withBusy(
            () => pickCandidate(draftId, candidateId),
            (next) => setViewIndex(next.currentIndex),
          )
        }
        onEdit={onEdit}
        onAccept={onAccept}
      />
      <div className="mt-auto flex flex-wrap items-center gap-2">
        {isCurrent && !isFinal && (
          <>
            <Button
              size="sm"
              disabled={busy || !canAdvance}
              aria-label={`Generate ${flow.stages[viewIndex + 1]?.def.title ?? "next stage"}`}
              onClick={() =>
                void withBusy(
                  () => advanceStage(draftId),
                  (next) => setViewIndex(next.currentIndex),
                )
              }
            >
              Generate {flow.stages[viewIndex + 1]?.def.title ?? "next stage"} →
            </Button>
            {!canAdvance && (
              <span className="text-xs text-muted-foreground">
                {stageDraft
                  ? "A stage advances only after its draft passes the judge (queued/approved)."
                  : "Pick a candidate to continue."}
              </span>
            )}
          </>
        )}
        {!isCurrent && (
          <span className="text-xs text-muted-foreground">
            Stage done — the flow is at {flow.stages[flow.currentIndex].def.title}. Tweaks here still capture and
            re-judge this artifact.
          </span>
        )}
        {isCurrent && isFinal && stageDraft && (
          <Badge variant="outline">
            Final stage — export to timeline/SRT/render manifest is deterministic core (render lands with B5.1)
          </Badge>
        )}
      </div>
      <CaptureLog captures={flow.captures} />
    </section>
  );
}

interface StageContentProps {
  stage: FlowStage;
  presets: StagedFlowState["presets"];
  busy: boolean;
  accepted: ReadonlySet<number>;
  onPick: (candidateId: string) => void;
  onEdit: (kind: StagedEditKind, patch: Rfc6902Op[], note?: string) => void;
  onAccept: (sceneIndex: number) => void;
}

function StageContent({ stage, presets, busy, accepted, onPick, onEdit, onAccept }: StageContentProps) {
  if (stage.candidates) {
    return <CandidatePicker stageTitle={stage.def.title} candidates={stage.candidates} busy={busy} onPick={onPick} />;
  }
  if (!stage.draft) {
    return <p className="text-sm text-muted-foreground">Locked — advance the prior stage first.</p>;
  }

  if (stage.draft.format === "storyboard") {
    const parsed = storyboardDraftMetaSchema.safeParse(stage.draft.meta);
    if (!parsed.success) {
      return (
        <p className="text-sm text-destructive" role="alert">
          This storyboard&rsquo;s meta no longer parses against the pinned contract schema.
        </p>
      );
    }
    const content: StoryboardContent = {
      title: parsed.data.title,
      scenes: parsed.data.scenes,
      cta: parsed.data.cta,
    };
    return (
      <div className="grid items-start gap-3 xl:grid-cols-[1fr_minmax(280px,380px)]">
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-medium text-foreground">{content.title}</h3>
          <StoryboardCards content={content} busy={busy} accepted={accepted} onEdit={onEdit} onAccept={onAccept} />
        </div>
        <StagePreview
          aspect="16:9"
          scenes={content.scenes.map(
            (scene): PreviewScene => ({
              heading: scene.heading,
              onScreenText: scene.onScreenText ?? null,
              visual: scene.visualHint ?? null,
              motion: null,
              durationMs: scene.durationHintMs ?? PREVIEW_FALLBACK_DURATION_MS,
            }),
          )}
          note="Aspect/fps/pacing are prefilled from the active profile at the scenes stage."
        />
      </div>
    );
  }

  const parsed = directionDocDraftMetaSchema.safeParse(stage.draft.meta);
  if (!parsed.success) {
    return (
      <p className="text-sm text-destructive" role="alert">
        This direction document&rsquo;s meta no longer parses against the pinned contract schema.
      </p>
    );
  }
  const doc: DirectionDoc = parsed.data.doc;
  return (
    <div className="grid items-start gap-3 xl:grid-cols-[1fr_minmax(280px,380px)]">
      <DirectionEditor
        doc={doc}
        docKey={stage.draft.bodyHash}
        presets={presets}
        busy={busy}
        accepted={accepted}
        onEdit={onEdit}
        onAccept={onAccept}
      />
      <StagePreview
        aspect={doc.aspect}
        scenes={doc.scenes.map(
          (scene): PreviewScene => ({
            heading: scene.heading,
            onScreenText: scene.onScreenText,
            visual: scene.visual,
            motion: scene.motion,
            durationMs: scene.durationMs,
          }),
        )}
      />
    </div>
  );
}
