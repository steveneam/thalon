"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  DIRECTION_MOTIONS,
  directionDocDraftMetaSchema,
  storyboardDraftMetaSchema,
  type DirectionDoc,
} from "@thalon/contracts";
import { JudgeBadge } from "@/components/approve/judge-badge";
import { reJudgeDraft } from "@/lib/approve-queue/client";
import { judgeReasons } from "@/lib/approve-queue/judge-reasons";
import { CandidatePicker } from "@/components/staged/candidate-picker";
import { CaptureLog } from "@/components/staged/capture-log";
import { DirectionFacts } from "@/components/staged/direction-editor";
import { SceneIndex, type IndexScene, type SceneEdit } from "@/components/staged/scene-index";
import { StagePreview, type PreviewScene } from "@/components/staged/stage-preview";
import { StageRail } from "@/components/staged/stage-rail";
import { formatMsAsClock } from "@/lib/approve-queue/formats/clip-plan";
import { advanceStage, fetchStagedFlow, pickCandidate, sendStagedEdit } from "@/lib/staged-flow/client";
import { buildFieldPatchOps, buildSceneReorderOps, pointer, type Rfc6902Op } from "@/lib/staged-flow/patch";
import type { FlowStage, StagedEditKind, StagedFlowState, StagedOrigin } from "@/lib/staged-flow/types";

interface StagedFlowProps {
  /** Any stage draft of the chain (the grid's selected draft) — the flow anchors on it. */
  draftId: string;
  /**
   * Fired when this pane changes a DRAFT the parent queue also renders (the
   * stalled re-judge). Without it the queue row keeps its old status chip
   * while this pane shows the new one — two views of the same draft
   * disagreeing on screen.
   */
  onDraftChanged?: () => void;
}

type FlowStatus = "loading" | "error" | "success";

/** Fake-driver fallback mirroring the store's, for storyboard scenes without a duration hint (preview only). */
const PREVIEW_FALLBACK_DURATION_MS = 4000;

/**
 * The staged-flow surface — REBUILT s101 to `docs/research/mock-sheets/Staged.dc.html`
 * (the founder's own call at the s100 close, after his report that "the layout
 * of it in the Approve section looks horrible"). It was the last surface in
 * the workspace still wearing wave-0 bridge styling.
 *
 * The root cause was one mistake made twice, nested: Tailwind `xl:` VIEWPORT
 * breakpoints deciding the layout of a CONTAINER that is 560px wide whatever
 * the viewport. Measured live before the rebuild — direction editor 182px vs
 * a 342px preview stub, an inner grid at three 46.7px columns, four clipped
 * elements, a 3219px pane in a 764px box, and 26 of 41 controls hard-disabled
 * on a live run. Every one of those is a fact in the sheet's header.
 *
 * The shape now: ONE column. Origin line · stage rail that says what each
 * stage PRODUCED · a pinned, bounded preview · the direction as chips · the
 * scenes as an index with one open at a time. The operator always reacts to
 * visible artifacts, and in advanced mode every interaction still round-trips
 * through the staged seam as a verbatim RFC-6902 patch into the capture log.
 */
export function StagedFlow({ draftId, onDraftChanged }: StagedFlowProps) {
  const [status, setStatus] = useState<FlowStatus>("loading");
  const [flow, setFlow] = useState<StagedFlowState | null>(null);
  const [viewIndex, setViewIndex] = useState(0);
  const [sceneIndex, setSceneIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  // Accepted beats are UI state per artifact VERSION: keyed by draftId+bodyHash,
  // so a tweak (new hash) honestly clears the "reviewed as-is" chips.
  const [acceptedByArtifact, setAcceptedByArtifact] = useState<Record<string, number[]>>({});

  useEffect(() => {
    // Promise-chain form on purpose: every setState sits inside .then/.catch
    // (the set-state-in-effect rule can't see through async fn boundaries).
    // The cancelled flag guards against a stale fetch landing after the
    // operator moved on (the parent additionally remounts per anchor draft).
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
      <section aria-label="Staged video flow" className="staged-pane">
        <div className="staged-scroll">
          {status === "loading" && <p className="t-label">Loading staged flow…</p>}
          {status === "error" && (
            <p className="t-label" style={{ color: "var(--err)" }}>
              Couldn&rsquo;t load this staged flow.
            </p>
          )}
        </div>
      </section>
    );
  }

  const stage = flow.stages[Math.min(viewIndex, flow.stages.length - 1)];
  const isCurrent = viewIndex === flow.currentIndex;
  const isFinal = viewIndex === flow.stages.length - 1;
  // A live flow is the s67 read-only projection of a REAL one-prompt chain —
  // pick/edit/advance are demo-store endpoints (they answer fixture ids only,
  // so calling them on a live draft would 404), and their affordances stay
  // absent rather than disabled: a form you cannot submit is a dead door.
  const readOnly = flow.source === "live";
  const stageDraft = stage.draft;
  /**
   * THE CHAIN HAS STOPPED AND THE RUNNER IS NOT COMING BACK (s100). A blocked
   * stage draft is terminal for an automated chain — the one-prompt runner
   * advances only from a queued/approved stage — so the operator is the only
   * thing that can move it, and they need the reason and a door. While a live
   * chain is merely mid-flight this stays null and the surface keeps its
   * hands off.
   */
  const stalledDraft =
    readOnly && flow.stages[flow.currentIndex]?.draft?.status === "blocked"
      ? flow.stages[flow.currentIndex].draft
      : null;
  const stalledStageTitle = flow.stages[flow.currentIndex]?.def.title ?? "this stage";
  const stalledReasons = stalledDraft
    ? judgeReasons(flow.stages[flow.currentIndex].judgeResults, stalledDraft.bodyHash)
    : [];
  const acceptedKey = stageDraft ? `${stageDraft.id}:${stageDraft.bodyHash}` : "";
  const accepted: ReadonlySet<number> = new Set(acceptedByArtifact[acceptedKey] ?? []);

  /**
   * The stalled chain's one door. Re-judge goes through the DRAFT's own route
   * (real repos, format-agnostic) rather than the staged demo store, which is
   * exactly why it works here where pick/edit/advance cannot. The flow is
   * re-fetched afterwards rather than patched: the re-judge may have moved the
   * stage's status, and the projection is the thing that knows.
   */
  const onReJudgeStalled = async (blockedDraftId: string) => {
    setBusy(true);
    setActionError(null);
    try {
      await reJudgeDraft(blockedDraftId);
      setFlow(await fetchStagedFlow(draftId));
      onDraftChanged?.();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Re-judge failed");
    } finally {
      setBusy(false);
    }
  };

  const onEdit = (kind: StagedEditKind, patch: Rfc6902Op[], note?: string) => {
    if (!stageDraft) return;
    void withBusy(() => sendStagedEdit(stageDraft.id, kind, patch, note));
  };

  const onAccept = (index: number) => {
    if (!stageDraft) return;
    void withBusy(
      () => sendStagedEdit(stageDraft.id, "accept", [], `scene ${index + 1}`),
      () =>
        setAcceptedByArtifact((prev) => ({
          ...prev,
          [acceptedKey]: [...(prev[acceptedKey] ?? []), index],
        })),
    );
  };

  const canAdvance =
    isCurrent && !isFinal && !!stageDraft && (stageDraft.status === "queued" || stageDraft.status === "approved");
  const content = readStage(stage);

  return (
    <section aria-label="Staged video flow" className="staged-pane">
      {/*
        The card head, the same one the plain draft detail wears — the two
        detail states are siblings, not aliens. It carries the anchor stage's
        state, what this thing IS, and the deep-link id; the judge's verdict
        for the stage being viewed rides the right, where the plain card puts
        its own. (Sheet AMENDED s101 in the same change: the first draw left
        the verdict off the head and it belongs there.)
      */}
      <div className="card-head">
        <span className={`pill ${statusPill(stageDraft?.status)}`}>{stageDraft?.status ?? "no draft"}</span>
        <span className="t-title">Staged video</span>
        <span className="t-label">
          {readOnly ? "one-prompt run" : "advanced mode · no spend"} · {flow.plan.stages.length} stages
        </span>
        <div style={{ flex: 1 }} />
        {stageDraft && (
          <span className="t-data" title={`Deep link · draft ${stageDraft.id}`}>
            #{stageDraft.id.slice(0, 8)}
          </span>
        )}
      </div>
      <div className="staged-scroll">
        <OriginLine origin={flow.origin} readOnly={readOnly} />

        <StageRail
          stages={flow.stages}
          viewIndex={viewIndex}
          onView={(i) => {
            setViewIndex(i);
            setSceneIndex(0);
          }}
          made={stageMade}
          stoppedIndex={stalledDraft ? flow.currentIndex : null}
        />

        {/*
          The judge's verdict for the stage BEING VIEWED, directly under the
          rail that selects it. It rode the card head in the first build and
          wrapped to three lines there — four gate chips need the column's
          full width, and this is the row where "which stage" was just
          answered. (Sheet amended to match, same change.)
        */}
        {stageDraft && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
            <JudgeBadge results={stage.judgeResults} bodyHash={stageDraft.bodyHash} />
          </div>
        )}

        {actionError && (
          <p className="t-label" style={{ color: "var(--err)" }} role="alert">
            {actionError}
          </p>
        )}

        {/*
          THE STALLED BAND (s100, the founder's own video run). A live chain
          that blocked has stopped for good — the runner advances only from a
          queued/approved stage — so this says which stage, WHY in the judge's
          own words, and offers the one door that genuinely reaches a live
          draft: re-judge, which re-runs the gates on the current body. Two
          gates disagreeing is precisely the case a second reading can settle.
        */}
        {stalledDraft && (
          <div className="notice-band refused" role="alert" aria-label="This run stopped">
            <span className="t-label">
              This run stopped at <b>{stalledStageTitle}</b> — the chain advances only from a stage
              that passed, so nothing further was generated.
            </span>
            {stalledReasons.length > 0 ? (
              stalledReasons.map((reason, i) => (
                <span key={`${reason.gate}-${i}`} className="t-label">
                  <span className="gate">{reason.gateLabel}</span> — {reason.line}
                </span>
              ))
            ) : (
              <span className="t-label">
                No claim-level detail was recorded for this block — a re-judge will produce a fresh
                verdict.
              </span>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 4, flexWrap: "wrap" }}>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                aria-disabled={busy}
                onClick={() => {
                  if (busy) return;
                  void onReJudgeStalled(stalledDraft.id);
                }}
              >
                {busy ? "Re-judging…" : "Re-judge this stage"}
              </button>
              <span className="t-label" style={{ color: "var(--n-900)" }}>
                Two gates disagreed on one sentence — a second reading can settle it.
              </span>
            </div>
          </div>
        )}

        {content.kind === "candidates" && (
          <CandidatePicker
            stageTitle={stage.def.title}
            candidates={content.candidates}
            busy={busy || readOnly}
            onPick={(candidateId) =>
              void withBusy(
                () => pickCandidate(draftId, candidateId),
                (next) => {
                  setViewIndex(next.currentIndex);
                  setSceneIndex(0);
                },
              )
            }
          />
        )}

        {content.kind === "locked" && (
          <p className="t-label">Locked — advance the prior stage first.</p>
        )}

        {content.kind === "unreadable" && (
          <p className="t-label" style={{ color: "var(--err)" }} role="alert">
            This {content.what}&rsquo;s meta no longer parses against the pinned contract schema.
          </p>
        )}

        {content.kind === "artifact" && (
          <>
            <StagePreview
              aspect={content.aspect}
              scenes={content.scenes.map(
                (scene): PreviewScene => ({
                  heading: scene.heading,
                  onScreenText: scene.onScreenText,
                  visual: scene.visual,
                  motion: scene.motion,
                  durationMs: scene.durationMs ?? PREVIEW_FALLBACK_DURATION_MS,
                }),
              )}
              sceneIndex={sceneIndex}
              onScene={setSceneIndex}
              note={content.previewNote}
              noteOverride={
                stalledDraft && viewIndex === flow.currentIndex
                  ? "the blocked claim lives in this artifact — read the scenes below against the judge’s words."
                  : undefined
              }
            />

            {content.doc && (
              <DirectionFacts
                doc={content.doc}
                docKey={stageDraft?.bodyHash ?? "none"}
                presets={flow.presets}
                editable={!readOnly}
                busy={busy}
                onEdit={onEdit}
              />
            )}

            <SceneIndex
              scenes={content.scenes}
              openIndex={sceneIndex}
              onOpen={setSceneIndex}
              editable={!readOnly}
              busy={busy}
              accepted={accepted}
              motions={content.doc ? DIRECTION_MOTIONS : []}
              onAccept={readOnly ? undefined : onAccept}
              onTweak={readOnly ? undefined : (index, next) => commitSceneTweak(content, index, next, onEdit)}
              onMove={
                readOnly
                  ? undefined
                  : (index, to) =>
                      onEdit(
                        "reorder",
                        buildSceneReorderOps(content.scenes.length, index, to),
                        `scene ${index + 1} → ${to + 1}`,
                      )
              }
            />

            {content.cta && (
              <p className="t-label">
                CTA: <span style={{ color: "var(--n-1000)" }}>{content.cta}</span>
              </p>
            )}
          </>
        )}

        {!readOnly && <CaptureLog captures={flow.captures} />}
      </div>

      <div className="foot">
        {readOnly ? (
          <>
            <span className="lede">
              {/* The honest refusal, in ONE sentence. The verbs a live chain
                  cannot run are ABSENT above rather than greyed, so this says
                  why they are missing instead of apologising for dead ones. */}
              Read-only — this chain ran itself. Stage editing reaches demo artifacts only.
            </span>
            <div style={{ flex: 1 }} />
            <Link className="card-link" href="/app/videos">
              Edit in Videos →
            </Link>
          </>
        ) : isFinal && isCurrent && stageDraft ? (
          <span className="lede">
            Final stage — export to timeline/SRT/render manifest is deterministic core (render lands
            with B5.1).
          </span>
        ) : isCurrent ? (
          <>
            <button
              type="button"
              className="btn btn-primary"
              aria-disabled={busy || !canAdvance}
              aria-label={`Generate ${flow.stages[viewIndex + 1]?.def.title ?? "next stage"}`}
              onClick={() => {
                if (busy || !canAdvance) return;
                void withBusy(
                  () => advanceStage(draftId),
                  (next) => {
                    setViewIndex(next.currentIndex);
                    setSceneIndex(0);
                  },
                );
              }}
            >
              Generate {flow.stages[viewIndex + 1]?.def.title ?? "next stage"} →
            </button>
            {!canAdvance && (
              <span className="lede">
                {stageDraft
                  ? "a stage advances only after its draft passes the judge"
                  : "Pick a candidate to continue."}
              </span>
            )}
          </>
        ) : (
          <span className="lede">
            Stage done — the flow is at {flow.stages[flow.currentIndex].def.title}. Tweaks here still
            capture and re-judge this artifact.
          </span>
        )}
      </div>
    </section>
  );
}

/** The draft's own lifecycle word in the shell's pill vocabulary — never a colour without its word. */
function statusPill(status: string | undefined): string {
  if (status === "blocked") return "pill-err";
  if (status === "approved" || status === "published") return "pill-ok";
  if (status === "queued") return "pill-warn";
  return "pill-idle";
}

/**
 * WHERE THIS CHAIN CAME FROM. The surface carried no answer to the operator's
 * first question anywhere on screen. Each fact renders only when it is on the
 * record: the one-prompt video runner persists no raw prompt, so on that path
 * the line leads with the grounding source instead of inventing an ask.
 */
function OriginLine({ origin, readOnly }: { origin?: StagedOrigin; readOnly: boolean }) {
  // Defended, not asserted: `origin` is a field this surface ADDED to the
  // projection, and a payload without it (an older server, a partial fixture)
  // must render a staged flow minus one line — never a white screen over the
  // operator's whole artifact.
  if (!origin) return null;
  const host = (() => {
    if (!origin.sourceUrl) return null;
    try {
      return new URL(origin.sourceUrl).host.replace(/^www\./, "");
    } catch {
      return origin.sourceUrl;
    }
  })();
  if (!origin.prompt && !host && !origin.runId) return null;
  return (
    <div className="ask">
      <span className="k">{origin.prompt ? "Asked" : "From"}</span>
      {origin.prompt ? (
        <span className="v" title={origin.prompt}>
          “{origin.prompt}”
        </span>
      ) : host ? (
        <span className="v plain">
          <a href={origin.sourceUrl ?? "#"} target="_blank" rel="noreferrer noopener">
            {host} ↗
          </a>
          {origin.kind ? ` · ${origin.kind.replace(/_/g, " ")}` : ""}
        </span>
      ) : (
        <span className="v plain">{origin.kind?.replace(/_/g, " ") ?? "origin not recorded"}</span>
      )}
      {readOnly && origin.runId && (
        <Link className="card-link" href="/app/runs">
          Run&nbsp;→
        </Link>
      )}
    </div>
  );
}

/** One stage's "what it produced" line for the rail — the Elicit pattern, read off the artifact. */
function stageMade(stage: FlowStage): string {
  if (stage.candidates) return `pick 1 of ${stage.candidates.length} takes`;
  if (!stage.draft) return "not generated yet";
  const read = readStage(stage);
  const status = stage.draft.status;
  if (read.kind !== "artifact") return status;
  const total = read.scenes.reduce((sum, s) => sum + (s.durationMs ?? 0), 0);
  const shape = total > 0 ? `${read.scenes.length} scenes · ${formatMsAsClock(total)}` : `${read.scenes.length} scenes`;
  return `${shape} · ${status}`;
}

type StageContent =
  | { kind: "candidates"; candidates: NonNullable<FlowStage["candidates"]> }
  | { kind: "locked" }
  | { kind: "unreadable"; what: string }
  | {
      kind: "artifact";
      scenes: IndexScene[];
      doc: DirectionDoc | null;
      aspect: "16:9" | "9:16" | "1:1";
      cta: string | null;
      previewNote?: string;
    };

/**
 * ONE reader for both artifact formats. The storyboard's `visualHint` /
 * `durationHintMs` and the direction doc's `visual` / `durationMs` normalise
 * to the same `IndexScene` here, which is what let the two scene components
 * collapse into one.
 */
function readStage(stage: FlowStage): StageContent {
  if (stage.candidates) return { kind: "candidates", candidates: stage.candidates };
  if (!stage.draft) return { kind: "locked" };

  if (stage.draft.format === "storyboard") {
    const parsed = storyboardDraftMetaSchema.safeParse(stage.draft.meta);
    if (!parsed.success) return { kind: "unreadable", what: "storyboard" };
    return {
      kind: "artifact",
      doc: null,
      aspect: "16:9",
      cta: parsed.data.cta,
      previewNote: "Aspect, fps and pacing are prefilled from the active profile at the scenes stage.",
      scenes: parsed.data.scenes.map(
        (scene): IndexScene => ({
          heading: scene.heading,
          narration: scene.narration,
          onScreenText: scene.onScreenText ?? null,
          visual: scene.visualHint ?? null,
          motion: null,
          durationMs: scene.durationHintMs ?? null,
        }),
      ),
    };
  }

  const parsed = directionDocDraftMetaSchema.safeParse(stage.draft.meta);
  if (!parsed.success) return { kind: "unreadable", what: "direction document" };
  const doc = parsed.data.doc;
  return {
    kind: "artifact",
    doc,
    aspect: doc.aspect,
    cta: doc.cta,
    scenes: doc.scenes.map(
      (scene): IndexScene => ({
        heading: scene.heading,
        narration: scene.narration,
        onScreenText: scene.onScreenText,
        visual: scene.visual,
        motion: scene.motion,
        durationMs: scene.durationMs,
      }),
    ),
  };
}

/** Scene tweaks patch the field names of whichever artifact is open — the one place the two shapes diverge again. */
function commitSceneTweak(
  content: Extract<StageContent, { kind: "artifact" }>,
  index: number,
  next: SceneEdit,
  onEdit: (kind: StagedEditKind, patch: Rfc6902Op[], note?: string) => void,
) {
  const scene = content.scenes[index];
  const duration = next.durationMs.trim() === "" ? undefined : Number(next.durationMs);
  const validDuration = Number.isInteger(duration) && (duration as number) > 0 ? duration : undefined;
  const path = pointer("scenes", index);
  const trimmedOrNull = (value: string) => (value.trim() === "" ? null : value.trim());
  const trimmedOrUndefined = (value: string) => (value.trim() === "" ? undefined : value.trim());

  const ops = content.doc
    ? buildFieldPatchOps(
        path,
        {
          heading: scene.heading,
          narration: scene.narration,
          onScreenText: scene.onScreenText,
          visual: scene.visual,
          motion: scene.motion,
          durationMs: scene.durationMs,
        },
        {
          heading: next.heading.trim(),
          narration: next.narration.trim(),
          onScreenText: trimmedOrNull(next.onScreenText),
          visual: trimmedOrNull(next.visual),
          motion: next.motion,
          durationMs: validDuration ?? scene.durationMs,
        },
      )
    : buildFieldPatchOps(
        path,
        {
          heading: scene.heading,
          narration: scene.narration,
          onScreenText: scene.onScreenText ?? undefined,
          visualHint: scene.visual ?? undefined,
          durationHintMs: scene.durationMs ?? undefined,
        },
        {
          heading: next.heading.trim(),
          narration: next.narration.trim(),
          onScreenText: trimmedOrUndefined(next.onScreenText),
          visualHint: trimmedOrUndefined(next.visual),
          durationHintMs: validDuration,
        },
      );
  if (ops.length > 0) onEdit("tweak", ops, `scene ${index + 1}`);
}
