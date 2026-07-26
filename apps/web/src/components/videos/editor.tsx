"use client";

import "@/components/videos/editor.css";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { VIDEO_DERIVE_ASPECTS, type Edl, type VideoCutAttribution, type VideoDeriveAspect } from "@thalon/contracts";
import { EditorInspector } from "@/components/videos/editor-inspector";
import { EditorTimeline, type Selection } from "@/components/videos/editor-timeline";
import { aspectOf, proposalMarks, takeCaption } from "@/components/videos/editor-model";
import { timecode } from "@/components/videos/videos-model";
import {
  approveCut,
  deriveCut,
  fetchCutDetail,
  fetchProjectDetail,
  fetchRenderJob,
  mediaUrl,
  proposeDiff,
  rejectProposal,
  saveCut,
  startRender,
  type CaptionRefusal,
  type DiffProposal,
} from "@/lib/videos/client";
import { nextVersionFor, splitLane, swapBeatSource, swapCandidatesFor } from "@/lib/videos/editor";
import type { CutDetail, ProjectDetail, RenderJobView } from "@/lib/videos/types";
import { useListKeys } from "@/lib/workspace/keyboard";

type ReadStatus = "loading" | "error" | "missing" | "ready";

/** The sheet's copilot chips, as asks the propose door actually receives. */
const CHIPS = ["Tighten to 30s", "Recut 9:16", "Swap music", "Retake a beat"];

/**
 * Video editor — STEP 2 of the two-step rebuild: the byte-true port of
 * Videos.dc.html with the real cut behind it. The sheet owns every band,
 * class and copy grammar; this layer only decides what is TRUE to render:
 *
 *  - the COPILOT is the real B-ve.4 propose door: the agent answers with a
 *    diff, the diff lands on the timeline as the sheet's `.prop` marks and
 *    in the proposal row, and NOTHING applies until the operator says so.
 *    Dismiss takes the reason with it — the correction becomes an eval row,
 *    exactly like a rejected take carries its reason;
 *  - the TIMELINE is the EDL: three lanes, magnetic reorder, edge trims,
 *    caption plates at their real fade windows, the music cue with its
 *    measured offset. The sheet's crescendo diamonds are NOT drawn — an
 *    AudioCue records offset, gain and tail easing, and nothing measures
 *    crescendos, so drawing them would be an invented fact;
 *  - the ASPECT LENS switches to an existing derived cut or derives one
 *    (measured seeds, 0 credits, lineage stamped server-side);
 *  - the PRIMARY BUTTON is the next real step for this cut — Save as vN+1
 *    while the working copy is dirty, then Render, then Send cut to
 *    Approve. The sheet draws one primary button and this is the one it
 *    draws, in whichever state the cut is actually in;
 *  - the TAKES strip is the slot-scoped swap: keepers first, rejects
 *    VISIBLE with their reasons — the learning material is part of the
 *    picker.
 *
 * Keepers re-entered as STATE behind the sheet's own chrome (never as extra
 * chrome): the knobs (trim, caption text/plate, music offset/gain/tail) and
 * the B-ve.5/7 reframe live in the inspector a selected block opens;
 * nothing is selected at rest.
 */
export function VideoEditor({ projectId, cutId }: { projectId: string; cutId: string | null }) {
  const router = useRouter();
  const [status, setStatus] = useState<ReadStatus>("loading");
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [cut, setCut] = useState<CutDetail | null>(null);
  const [edl, setEdl] = useState<Edl | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [refusals, setRefusals] = useState<CaptionRefusal[]>([]);
  const [job, setJob] = useState<RenderJobView | null>(null);
  const [selection, setSelection] = useState<Selection>(null);
  const [playhead, setPlayhead] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [ask, setAsk] = useState("");
  const [proposal, setProposal] = useState<DiffProposal | null>(null);
  const [diffOpen, setDiffOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState<string | null>(null);
  // An applied agent proposal rides the next save as its attribution; any
  // MANUAL edit after Apply clears it — the EDL is no longer base + diff and
  // the save door would (rightly) refuse the replay check.
  const [pending, setPending] = useState<VideoCutAttribution | null>(null);
  const askRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const load = useCallback(
    () =>
      fetchProjectDetail(projectId)
        .then((project) => {
          if (project === null) {
            setStatus("missing");
            return;
          }
          setDetail(project);
          const target = cutId ?? project.cuts[0]?.id ?? null;
          if (target === null) {
            setCut(null);
            setStatus("ready");
            return;
          }
          return fetchCutDetail(projectId, target).then((found) => {
            setCut(found);
            setEdl(found?.edl ?? null);
            setStatus("ready");
          });
        })
        .catch(() => setStatus("error")),
    [projectId, cutId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  // Fire-and-poll: a render is minutes of local x264 (0 credits, A17).
  useEffect(() => {
    if (job?.status !== "running") return;
    const timer = setInterval(() => {
      void fetchRenderJob(projectId, job.id).then((next) => {
        if (next === null) return;
        setJob(next);
        if (next.status === "done") {
          setCut((current) =>
            current ? { ...current, status: "rendered", outputRef: next.outputRef } : current,
          );
        }
      });
    }, 4000);
    return () => clearInterval(timer);
  }, [job, projectId]);

  /** The ONE manual edit funnel — one dirty bit, one working copy. */
  const apply = useCallback((fn: (edl: Edl) => Edl) => {
    setEdl((current) => (current === null ? current : fn(current)));
    setDirty(true);
    setPending(null);
  }, []);

  const beats = useMemo(() => (edl === null ? [] : splitLane(edl).beats), [edl]);
  const marks = useMemo(
    () => proposalMarks(proposal?.diff ?? null),
    [proposal],
  );

  // j/k walk the beat lane — the one list keyboard grammar, on the surface's
  // own list (the beats rail is that list here).
  const move = (delta: 1 | -1) => (event: KeyboardEvent) => {
    if (beats.length === 0) return;
    if ((event.target as HTMLElement | null)?.closest("input, textarea")) return;
    event.preventDefault();
    const current = selection?.kind === "beat" ? selection.index : -1;
    const next = current === -1 ? 0 : Math.min(Math.max(current + delta, 0), beats.length - 1);
    setSelection({ kind: "beat", index: next });
  };
  useListKeys({ enabled: status === "ready" && edl !== null, bindings: { j: move(1), k: move(-1) } });

  function run(work: () => Promise<string | null>) {
    setBusy(true);
    setNotice(null);
    setRefusals([]);
    work()
      .then((message) => setNotice(message))
      .catch((err: unknown) => setNotice(err instanceof Error ? err.message : "that door refused"))
      .finally(() => setBusy(false));
  }

  function onSave() {
    if (cut === null || edl === null) return;
    run(async () => {
      const { cut: saved } = await saveCut(projectId, {
        name: cut.name,
        edl,
        ...(pending ? { attribution: pending } : {}),
        // A derived cut's new versions carry the parent pin forward.
        ...(cut.lineage
          ? { meta: { lineage: { parentCutId: cut.lineage.parentCutId, aspect: cut.lineage.aspect } } }
          : {}),
      });
      setCut(saved);
      setEdl(saved.edl);
      setDirty(false);
      setJob(null);
      setPending(null);
      router.replace(`/app/videos/${projectId}/edit?cut=${saved.id}`, { scroll: false });
      void fetchProjectDetail(projectId).then((p) => p && setDetail(p));
      return `Saved as ${saved.name} v${saved.version} — the previous version is untouched.`;
    });
  }

  function onRender() {
    if (cut === null) return;
    run(async () => {
      const { job: fired } = await startRender(projectId, cut.id);
      setJob(fired);
      return "Rendering locally (0 credits) — minutes of x264; this page polls until it lands.";
    });
  }

  function onApprove() {
    if (cut === null) return;
    run(async () => {
      const outcome = await approveCut(projectId, cut.id);
      if (outcome.ok) {
        setCut(outcome.cut);
        return `${outcome.cut.name} v${outcome.cut.version} passed the gate.`;
      }
      setRefusals(outcome.failures);
      return outcome.error;
    });
  }

  function onAspect(aspect: VideoDeriveAspect) {
    if (cut === null || detail === null) return;
    const existing = detail.cuts.find((c) => c.lineage?.aspect === aspect);
    if (existing) {
      router.push(`/app/videos/${projectId}/edit?cut=${existing.id}`);
      return;
    }
    run(async () => {
      const { cut: derived } = await deriveCut(projectId, cut.id, aspect);
      router.push(`/app/videos/${projectId}/edit?cut=${derived.id}`);
      return `Derived ${derived.name} for ${aspect} — measured seeds, 0 credits.`;
    });
  }

  function onPropose() {
    if (cut === null) return;
    setProposal(null);
    setDiffOpen(false);
    setRejectReason(null);
    run(async () => {
      setProposal(await proposeDiff(projectId, cut.id, ask));
      return null;
    });
  }

  function onDismissProposal() {
    if (cut === null || proposal === null || rejectReason === null || rejectReason.trim() === "") return;
    run(async () => {
      await rejectProposal(projectId, cut.id, {
        diff: proposal.diff,
        reason: rejectReason.trim(),
        ...(ask.trim() ? { ask: ask.trim() } : {}),
      });
      setProposal(null);
      setRejectReason(null);
      return "Dismissed — the correction is now an eval row.";
    });
  }

  if (status !== "ready" || detail === null) {
    return (
      <div className="content editor-surface" style={{ gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link className="card-link" href="/app/videos">
            ← Videos
          </Link>
          <h1 className="t-headline">Editor</h1>
        </div>
        <div className="card">
          <div className="row" role={status === "error" ? "alert" : undefined}>
            <span className="t-label" style={{ flex: 1 }}>
              {status === "loading"
                ? "Reading this cut…"
                : status === "missing"
                  ? "This project doesn’t exist, or belongs to another tenant."
                  : "Couldn’t read the editor — a read failure, not an empty cut."}
            </span>
            {status === "error" && (
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
            )}
          </div>
        </div>
      </div>
    );
  }

  if (cut === null || edl === null) {
    return (
      <div className="content editor-surface" style={{ gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link className="card-link" href={`/app/videos/${projectId}`}>
            ← {detail.name}
          </Link>
          <h1 className="t-headline">Editor</h1>
        </div>
        <div className="card">
          <div className="row">
            <span className="t-label">
              No cut to edit yet — a cut’s EDL is what the editor works on. The one-prompt run
              writes the first one; the import script registers takes, not cuts.
            </span>
          </div>
        </div>
      </div>
    );
  }

  const currentAspect = aspectOf(edl.output.width, edl.output.height);
  const nextVersion = nextVersionFor(detail.cuts, cut.name);
  const selectedClip = selection?.kind === "beat" ? beats[selection.index] : undefined;
  const candidates =
    selectedClip === undefined
      ? []
      : swapCandidatesFor(detail.takes, selectedClip.source.ref).filter(
          (take) => take.ref !== selectedClip.source.ref,
        );
  const keeperRefs = new Set(
    detail.takes.filter((t) => t.disposition === "keeper").map((t) => t.ref),
  );
  const rejectRefs = new Set(
    detail.takes.filter((t) => t.disposition === "reject").map((t) => t.ref),
  );

  /** The sheet draws ONE primary button; this is it, in the state the cut is actually in. */
  const primary = dirty
    ? { label: `Save as v${nextVersion}`, onClick: onSave, disabled: false }
    : cut.status === "draft"
      ? {
          label: job?.status === "running" ? "Rendering…" : "Render",
          onClick: onRender,
          disabled: job?.status === "running",
        }
      : cut.status === "rendered"
        ? { label: "Send cut to Approve", onClick: onApprove, disabled: false }
        : { label: "Approved", onClick: () => {}, disabled: true };

  return (
    <div className="content editor-surface" style={{ gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Link className="card-link" href={`/app/videos/${projectId}`}>
          ← {detail.name}
        </Link>
        <h1 className="t-headline">
          {cut.name} v{cut.version}
        </h1>
        <span className="pill pill-idle">
          {dirty ? `unsaved · ${edl.output.duration}s` : `${cut.status} · ${edl.output.duration}s`}
        </span>
        <span className="pill pill-ok">
          {detail.takes.length} take{detail.takes.length === 1 ? "" : "s"} on record
        </span>
        {pending?.authoredBy === "agent" && (
          <span className="pill pill-warn">agent proposal applied</span>
        )}
        <div style={{ flex: 1 }} />
        <div className="seg" role="group" aria-label="Aspect">
          <span className={currentAspect === "16:9" ? "seg-opt on" : "seg-opt"} aria-hidden>
            16:9
          </span>
          {VIDEO_DERIVE_ASPECTS.map((aspect) => (
            <button
              key={aspect}
              type="button"
              className={currentAspect === aspect ? "seg-opt on" : "seg-opt"}
              aria-pressed={currentAspect === aspect}
              disabled={dirty || busy || currentAspect === aspect}
              title={
                dirty
                  ? "Save first — a derive reads the stored EDL"
                  : `Switch to the ${aspect} cut, or derive one (measured seeds, 0 credits)`
              }
              onClick={() => onAspect(aspect)}
            >
              {aspect}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => askRef.current?.focus()}
        >
          Propose edits
        </button>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={busy || primary.disabled}
          onClick={primary.onClick}
        >
          {busy ? "Working…" : primary.label}
        </button>
      </div>

      <div className="copilot">
        <input
          ref={askRef}
          className="cop-box"
          value={ask}
          aria-label="Direct the edit"
          placeholder="Direct the edit — “clear the second caption off the falcon, land the tail easing on the close” — the agent answers with a proposal on the timeline, never a silent change."
          onChange={(event) => setAsk(event.target.value)}
        />
        {CHIPS.map((chip) => (
          <button key={chip} type="button" className="chipbtn" onClick={() => setAsk(chip)}>
            {chip}
          </button>
        ))}
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={busy || dirty}
          title={dirty ? "Save your manual edits first — the agent proposes against the stored cut" : undefined}
          onClick={onPropose}
        >
          {busy ? "Proposing…" : "Propose"}
        </button>
      </div>

      {(notice !== null || refusals.length > 0) && (
        <div className={refusals.length > 0 ? "card notice-band refused" : "card notice-band"} role="status">
          {notice !== null && <span className="t-label">{notice}</span>}
          {refusals.map((refusal) => (
            <span key={refusal.line} className="t-label">
              line {refusal.line} “{refusal.text}” — {refusal.matches.join("; ")}
            </span>
          ))}
          {job?.status === "error" && <span className="t-label">Render failed: {job.error}</span>}
        </div>
      )}

      <div className="ed-grid">
        <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
          <div className="player">
            {playing && cut.outputRef !== null ? (
              <video
                ref={videoRef}
                className="player-video"
                controls
                autoPlay
                preload="metadata"
                src={mediaUrl(projectId, cut.outputRef)}
              />
            ) : (
              <>
                <div className="player-rest">
                  <button
                    type="button"
                    className="play-btn"
                    aria-label={`Play ${cut.name} v${cut.version}`}
                    disabled={!detail.playable || cut.outputRef === null}
                    onClick={() => setPlaying(true)}
                  >
                    <div className="play-tri" />
                  </button>
                  {(cut.outputRef === null || !detail.playable) && (
                    <span className="t-data">
                      {cut.outputRef === null
                        ? `no render yet for v${cut.version} — the primary button renders it, locally, 0 credits`
                        : "no media root configured on this box — refs on record, playback off"}
                    </span>
                  )}
                </div>
                <div className="scrub">
                  <span className="t-data" style={{ color: "var(--n-1000)" }}>
                    {timecode((playhead ?? 0) * edl.output.duration)}
                  </span>
                  <div className="bar-trough" style={{ flex: 1, height: 5 }}>
                    <div
                      className="bar-fill"
                      style={{ width: `${(playhead ?? 0) * 100}%`, background: "var(--act)" }}
                    />
                  </div>
                  <span className="t-data">{timecode(edl.output.duration)}</span>
                </div>
              </>
            )}
          </div>

          <div className="card">
            {proposal !== null && (
              <div className="prop-row">
                <span className="pill pill-warn">proposal</span>
                <span style={{ flex: 1 }}>
                  {proposal.diff.summary} · nothing applies until you say so
                </span>
                <button
                  type="button"
                  className="card-link as-text-btn"
                  aria-expanded={diffOpen}
                  onClick={() => setDiffOpen((open) => !open)}
                >
                  {diffOpen ? "Hide diff ←" : "Review diff →"}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    // Deliberately NOT the manual funnel: Apply carries its
                    // attribution, and the save door replay-verifies it.
                    setEdl(proposal.preview);
                    setDirty(true);
                    setPending(proposal.attribution);
                    setProposal(null);
                    setNotice("Applied to the working copy — Save records it as agent-authored.");
                  }}
                >
                  Apply
                </button>
                <button
                  type="button"
                  className="btn btn-quiet btn-sm"
                  onClick={() => setRejectReason(rejectReason === null ? "" : null)}
                >
                  Dismiss
                </button>
              </div>
            )}

            {proposal !== null && diffOpen && (
              <div className="diff-panel">
                {proposal.diff.ops.map((op, i) => (
                  <div key={i} className="diff-op">
                    <span className="pill pill-idle">{op.op}</span>
                    <span style={{ flex: 1 }}>{op.why}</span>
                  </div>
                ))}
                <span className="t-data">
                  {proposal.attribution.proposal?.model ?? "model unrecorded"} ·{" "}
                  {proposal.tokens.in}/{proposal.tokens.out} tokens
                </span>
              </div>
            )}

            {proposal !== null && rejectReason !== null && (
              <div className="diff-panel">
                <label className="numfield" style={{ flex: 1 }}>
                  why this proposal is wrong (required — it becomes the eval row)
                  <input
                    value={rejectReason}
                    autoFocus
                    onChange={(event) => setRejectReason(event.target.value)}
                  />
                </label>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={busy || rejectReason.trim() === ""}
                  onClick={onDismissProposal}
                >
                  Record the correction
                </button>
              </div>
            )}

            <EditorTimeline
              edl={edl}
              selection={selection}
              onSelect={setSelection}
              onEdl={apply}
              playhead={playhead}
              onPlayhead={(fraction) => {
                setPlayhead(fraction);
                const video = videoRef.current;
                if (video && Number.isFinite(video.duration)) {
                  video.currentTime = Math.min(fraction * video.duration, video.duration);
                }
              }}
              propBeats={marks.beats}
              propCaptions={marks.captions}
              propMusic={marks.music}
            />

            {selection !== null && (
              <EditorInspector
                projectId={projectId}
                edl={edl}
                selection={selection}
                playable={detail.playable}
                onEdl={apply}
                onSelect={setSelection}
                onClose={() => setSelection(null)}
              />
            )}

            <div className="tl-foot">
              <span className="t-label">
                Every edit is a recorded EDL change — the agent proposes, you approve · cuts are
                versioned, so an edit never overwrites v{cut.version}
              </span>
              <div style={{ flex: 1 }} />
              <Link className="card-link" href={`/app/videos/${projectId}`}>
                Cut history →
              </Link>
            </div>
          </div>

          <div className="card">
            <div className="card-head" style={{ padding: "9px 16px" }}>
              <span className="t-title">
                {selectedClip === undefined ? "Takes" : `Takes — ${selectedClip.name}`}
              </span>
              <span className="t-label">
                {selectedClip === undefined
                  ? "pick a beat on the timeline to see what auditions for it"
                  : candidates.length === 0
                    ? "no other take auditions for this beat’s slot"
                    : `${candidates.length} other take${candidates.length === 1 ? "" : "s"} · every reject carries its reason`}
              </span>
              <div style={{ flex: 1 }} />
              <Link className="card-link" href={`/app/videos/${projectId}`}>
                All takes →
              </Link>
            </div>
            <div className="strip">
              {selectedClip === undefined ? (
                <span className="t-label">Nothing selected.</span>
              ) : (
                <>
                  <div className="take on">
                    <div className="thumb-md">
                      <span>in the cut</span>
                    </div>
                    <span className="take-cap">
                      {clipTakeCaption(selectedClip.source.ref, keeperRefs, rejectRefs)}
                    </span>
                  </div>
                  {candidates.map((take) => (
                    <button
                      key={take.id}
                      type="button"
                      className="take"
                      title={`swap this beat to ${take.ref}`}
                      onClick={() =>
                        apply((current) =>
                          swapBeatSource(current, selection?.kind === "beat" ? selection.index : 0, take.ref),
                        )
                      }
                    >
                      <div className="thumb-md">
                        <span>{take.disposition}</span>
                      </div>
                      <span className="take-cap">{takeCaption(take)}</span>
                    </button>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>

        <div className="card" style={{ display: "flex", flexDirection: "column" }}>
          <div className="card-head">
            <span className="t-title">Beats</span>
            <span className="t-label">
              {beats.length} · {edl.output.duration}s planned
            </span>
          </div>
          <div className="beats-scroll">
            {beats.map((clip, i) => {
              const keeper = keeperRefs.has(clip.source.ref);
              const reject = rejectRefs.has(clip.source.ref);
              return (
                <button
                  key={`${clip.name}-${i}`}
                  type="button"
                  className={
                    selection?.kind === "beat" && selection.index === i ? "beat-row on" : "beat-row"
                  }
                  aria-pressed={selection?.kind === "beat" && selection.index === i}
                  onClick={() => setSelection({ kind: "beat", index: i })}
                >
                  <div className="beat-thumb" />
                  <span style={{ flex: 1, minWidth: 0 }} className="beat-name">
                    {String(i + 1).padStart(2, "0")} · {clip.name}
                  </span>
                  <span className="t-data">{clip.duration}s</span>
                  <span
                    style={{ color: keeper ? "var(--ok)" : reject ? "var(--warn)" : "var(--n-700)" }}
                    title={
                      keeper
                        ? "this beat rides a keeper take"
                        : reject
                          ? "this beat rides a REJECTED take — its reason is in the takes strip"
                          : "this source has no take row (a cut layer or an unregistered file)"
                    }
                  >
                    {keeper ? "✓" : reject ? "!" : "·"}
                  </span>
                </button>
              );
            })}
          </div>
          <div style={{ padding: "10px 14px", borderTop: "1px solid var(--n-400)" }}>
            <span className="t-label">
              Every take’s reason is on record · a beat marked ! rides a reject, and the strip says
              why
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** What the beat's CURRENT source is, in the takes strip's own caption slot. */
function clipTakeCaption(
  ref: string,
  keepers: ReadonlySet<string>,
  rejects: ReadonlySet<string>,
): string {
  if (keepers.has(ref)) return "keeper";
  if (rejects.has(ref)) return "a rejected take — swap it below";
  return "no take row for this source";
}
