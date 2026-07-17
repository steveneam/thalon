"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Clapperboard } from "lucide-react";
import {
  VIDEO_DERIVE_ASPECTS,
  type Edl,
  type VideoCutAttribution,
  type VideoDeriveAspect,
} from "@thalon/contracts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorNotice } from "@/components/workspace/error-notice";
import { cn } from "@/lib/utils";
import {
  approveCut,
  deriveCut,
  fetchCutDetail,
  fetchProjectDetail,
  fetchRenderJob,
  mediaUrl,
  saveCut,
  startRender,
  type CaptionRefusal,
} from "@/lib/videos/client";
import { patchClipCrop } from "@/lib/videos/frame";
import {
  laneDuration,
  nextVersionFor,
  patchCaptionLine,
  patchMusic,
  reorderBeat,
  setOutputDuration,
  setOverlayAt,
  splitLane,
  swapBeatSource,
  swapCandidatesFor,
  trimBeat,
} from "@/lib/videos/editor";
import type { CutDetail, ProjectDetail, RenderJobView } from "@/lib/videos/types";
import { useListKeys } from "@/lib/workspace/keyboard";
import { AssistPanel } from "./assist-panel";
import { VideosSubnav } from "./videos-subnav";
import { FrameComposer } from "./frame-composer";
import { MusicLane } from "./music-lane";
import { NumField } from "./num-field";
import { TrackView } from "./track-view";

type ViewStatus = "loading" | "error" | "missing" | "ready";

function baseName(ref: string): string {
  return ref.split("/").at(-1) ?? ref;
}

/**
 * B-ve.3 timeline editor MVP (manual first, ADR 0010): the five ops —
 * reorder · trim · take-swap (slot-scoped, rejects visible with reasons) ·
 * caption moves + text edits · music offset — as pure EDL transforms over a
 * working copy. Save is ALWAYS a new version through the frozen create door;
 * Render is fire-and-poll local ffmpeg (0cr, A17 invariant). No AI diffs,
 * no approve door — those bind at B-ve.4 behind the judge gate.
 */
export function CutEditor({ projectId, cutId }: { projectId: string; cutId: string | null }) {
  const router = useRouter();
  const [status, setStatus] = useState<ViewStatus>("loading");
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [cut, setCut] = useState<CutDetail | null>(null);
  const [edl, setEdl] = useState<Edl | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [job, setJob] = useState<RenderJobView | null>(null);
  const [selected, setSelected] = useState(0);
  // B-ve.4: an applied agent proposal rides the next save as its attribution.
  // Any MANUAL edit after Apply clears it — the EDL is no longer base + diff,
  // and the save door would (rightly) refuse the replay check.
  const [pendingAttribution, setPendingAttribution] = useState<VideoCutAttribution | null>(null);
  const [approving, setApproving] = useState(false);
  const [approveFailures, setApproveFailures] = useState<CaptionRefusal[]>([]);
  /** The Preview card's video — the track view's playhead scrubs it. */
  const previewRef = useRef<HTMLVideoElement | null>(null);

  const load = useCallback(
    () =>
      fetchProjectDetail(projectId)
        .then(async (project) => {
          if (!project) {
            setStatus("missing");
            return;
          }
          const targetCutId = cutId ?? project.cuts[0]?.id ?? null;
          const target = targetCutId ? await fetchCutDetail(projectId, targetCutId) : null;
          setDetail(project);
          if (!target) {
            setCut(null);
            setStatus("ready");
            return;
          }
          setCut(target);
          setEdl(target.edl);
          setStatus("ready");
        })
        .catch(() => {
          setStatus("error");
        }),
    [projectId, cutId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  /** Every MANUAL edit op funnels through here — one dirty bit, one working copy; a manual edit ends any pending agent attribution. */
  const apply = (fn: (edl: Edl) => Edl) => {
    setEdl((current) => (current ? fn(current) : current));
    setDirty(true);
    setPendingAttribution(null);
  };

  const clips = edl?.video ?? [];
  const lane = edl ? splitLane(edl) : { beats: [], overlay: null };
  const moveSelection = (delta: 1 | -1) => (event: KeyboardEvent) => {
    if (clips.length === 0) return;
    event.preventDefault();
    setSelected((s) => Math.min(Math.max(s + delta, 0), clips.length - 1));
  };
  useListKeys({
    enabled: status === "ready" && edl !== null,
    bindings: { j: moveSelection(1), k: moveSelection(-1) },
  });

  // Fire-and-poll: the render is minutes of local x264 — poll until it settles.
  useEffect(() => {
    if (job?.status !== "running") return;
    const timer = setInterval(() => {
      void fetchRenderJob(projectId, job.id).then((next) => {
        if (!next) return;
        setJob(next);
        if (next.status === "done") {
          setCut((c) => (c ? { ...c, status: "rendered", outputRef: next.outputRef } : c));
        }
      });
    }, 4000);
    return () => clearInterval(timer);
  }, [job, projectId]);

  const onSave = async () => {
    if (!cut || !edl) return;
    setSaving(true);
    setNotice(null);
    try {
      const { cut: saved } = await saveCut(projectId, {
        name: cut.name,
        edl,
        ...(pendingAttribution ? { attribution: pendingAttribution } : {}),
        // B-ve.5: a derived cut's new versions carry the parent pin forward.
        ...(cut.lineage
          ? {
              meta: {
                lineage: { parentCutId: cut.lineage.parentCutId, aspect: cut.lineage.aspect },
              },
            }
          : {}),
      });
      setCut(saved);
      setEdl(saved.edl);
      setDirty(false);
      setJob(null);
      setPendingAttribution(null);
      setApproveFailures([]);
      router.replace(`/app/videos/${projectId}/edit?cut=${saved.id}`, { scroll: false });
      // The version rail (save → vN) reads from the project's cut list — refresh it.
      void fetchProjectDetail(projectId).then((p) => p && setDetail(p));
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "save failed");
    } finally {
      setSaving(false);
    }
  };

  const onRender = async () => {
    if (!cut) return;
    setNotice(null);
    try {
      const { job: fired } = await startRender(projectId, cut.id);
      setJob(fired);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "render failed to start");
    }
  };

  const [deriving, setDeriving] = useState<VideoDeriveAspect | null>(null);
  const onDerive = async (aspect: VideoDeriveAspect) => {
    if (!cut) return;
    setDeriving(aspect);
    setNotice(null);
    try {
      const { cut: derived } = await deriveCut(projectId, cut.id, aspect);
      router.push(`/app/videos/${projectId}/edit?cut=${derived.id}`);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "derive failed");
    } finally {
      setDeriving(null);
    }
  };

  const onApprove = async () => {
    if (!cut) return;
    setApproving(true);
    setNotice(null);
    setApproveFailures([]);
    try {
      const outcome = await approveCut(projectId, cut.id);
      if (outcome.ok) {
        setCut(outcome.cut);
        void fetchProjectDetail(projectId).then((p) => p && setDetail(p));
      } else {
        setNotice(outcome.error);
        setApproveFailures(outcome.failures);
      }
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "approve failed");
    } finally {
      setApproving(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="flex flex-col gap-3 p-4 lg:p-6" aria-label="Loading editor">
        <Skeleton className="h-24" />
        <Skeleton className="h-64" />
      </div>
    );
  }
  if (status === "error") {
    return (
      <div className="p-4 lg:p-6">
        <ErrorNotice
          message="Couldn’t load the editor."
          onRetry={() => {
            setStatus("loading");
            void load();
          }}
        />
      </div>
    );
  }
  if (status === "missing" || !detail) {
    return (
      <div className="p-4 lg:p-6">
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            This project doesn’t exist (or belongs to another tenant).
          </CardContent>
        </Card>
      </div>
    );
  }
  if (!cut || !edl) {
    return (
      <div className="flex flex-col gap-4 p-4 lg:p-6">
        <VideosSubnav projectId={projectId} />
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            No cuts to edit yet — a cut’s EDL is what the editor works on. Import or save one
            first.
          </CardContent>
        </Card>
      </div>
    );
  }

  const selectedClip = clips[selected] ?? null;
  const selectedIsOverlay = selectedClip != null && lane.overlay === selectedClip;
  const nextVersion = nextVersionFor(detail.cuts, cut.name);
  const assembled = laneDuration(edl);

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      <p aria-live="polite" className="sr-only">
        {selectedClip ? `Selected ${selectedClip.name}` : ""}
      </p>
      <VideosSubnav projectId={projectId} cutId={cut.id} />

      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            <Clapperboard aria-hidden className="size-4 text-muted-foreground" />
            {cut.name}
            <Badge variant="outline" className="u-tabular">
              v{cut.version}
            </Badge>
            <Badge variant={cut.status === "draft" ? "outline" : "secondary"}>{cut.status}</Badge>
            {cut.lineage && (
              <Badge variant="outline" className="u-tabular">
                {cut.lineage.aspect} · from {cut.lineage.parentName ?? "?"} v
                {cut.lineage.parentVersion ?? "?"}
              </Badge>
            )}
            {cut.lineage &&
              cut.lineage.parentVersion !== null &&
              cut.lineage.parentLatestVersion !== null &&
              cut.lineage.parentLatestVersion > cut.lineage.parentVersion && (
                <Badge variant="signal">parent now v{cut.lineage.parentLatestVersion}</Badge>
              )}
            {dirty && <Badge variant="signal">unsaved edits</Badge>}
            {pendingAttribution?.authoredBy === "agent" && (
              <Badge variant="signal">agent proposal applied</Badge>
            )}
            <span className="ml-auto flex items-center gap-2">
              {VIDEO_DERIVE_ASPECTS.map((aspect) => (
                <Button
                  key={aspect}
                  variant="outline"
                  onClick={() => void onDerive(aspect)}
                  disabled={dirty || deriving !== null}
                  title={
                    dirty
                      ? "Save first — derive reads the stored EDL"
                      : `New ${aspect} cut derived from this one (measured seeds, 0 credits)`
                  }
                >
                  {deriving === aspect ? "Deriving…" : `Derive ${aspect}`}
                </Button>
              ))}
              <Button onClick={() => void onSave()} disabled={!dirty || saving}>
                {saving ? "Saving…" : `Save as v${nextVersion}`}
              </Button>
              {cut.status === "draft" && (
                <Button
                  variant="outline"
                  onClick={() => void onRender()}
                  disabled={dirty || job?.status === "running"}
                >
                  {job?.status === "running" ? "Rendering…" : "Render"}
                </Button>
              )}
              {cut.status === "rendered" && (
                <Button
                  variant="outline"
                  onClick={() => void onApprove()}
                  disabled={dirty || approving}
                >
                  {approving ? "Judging…" : "Approve"}
                </Button>
              )}
            </span>
          </CardTitle>
          <CardDescription className="flex flex-wrap items-baseline gap-x-3">
            <span>
              {detail.name} — an edit is always a new version; the saved EDL is immutable.
            </span>
            <span className="u-eyebrow whitespace-nowrap text-muted-foreground">
              keys · j/k move clip
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 pt-0">
          {dirty && cut.status === "draft" && (
            <p className="text-xs text-muted-foreground">Save before rendering — the render replays the stored EDL.</p>
          )}
          {notice && (
            <p role="alert" className="rounded-md bg-destructive/10 px-2.5 py-1.5 text-sm text-destructive">
              {notice}
            </p>
          )}
          {job?.status === "error" && (
            <p role="alert" className="rounded-md bg-destructive/10 px-2.5 py-1.5 text-sm text-destructive">
              Render failed: {job.error}
            </p>
          )}
          {approveFailures.length > 0 && (
            <ul role="alert" className="flex flex-col gap-1 rounded-md bg-destructive/10 px-2.5 py-1.5">
              {approveFailures.map((f) => (
                <li key={f.line} className="text-sm text-destructive">
                  <span className="font-medium">line {f.line}</span> “{f.text}” —{" "}
                  {f.matches.join("; ")}
                </li>
              ))}
            </ul>
          )}
          {job?.status === "running" && (
            <p className="text-sm text-muted-foreground">
              Rendering locally (0 credits) — minutes of x264; this page polls until it lands.
            </p>
          )}
        </CardContent>
      </Card>

      {/* The NLE geometry (founder direction s50): preview + inspector on
          top, then the timeline as a FULL-WIDTH band — the protagonist. */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Preview</CardTitle>
            <CardDescription>
              {cut.status !== "draft" && cut.outputRef
                ? "The rendered cut — the ruler's playhead scrubs it."
                : "Save and render to preview this cut (local, 0 credits)."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-1">
            {cut.status !== "draft" && cut.outputRef ? (
              <>
                <p className="break-all font-mono text-xs text-muted-foreground">
                  {cut.outputRef}
                </p>
                {detail.playable && (
                  <video
                    ref={previewRef}
                    controls
                    preload="metadata"
                    src={mediaUrl(projectId, cut.outputRef)}
                    className="max-h-[420px] w-full rounded-lg border border-border bg-muted object-contain"
                  />
                )}
              </>
            ) : (
              <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
                No render yet for v{cut.version}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="min-w-0 self-start">
          <CardHeader>
            <CardTitle>Clip</CardTitle>
            <CardDescription>
              {selectedClip
                ? selectedIsOverlay
                  ? "The endcard overlay — trim boundary and hold."
                  : "Trim, reorder, or swap the take behind this beat."
                : "Select a clip to edit it."}
            </CardDescription>
          </CardHeader>
          {selectedClip && (
            <CardContent className="flex flex-col gap-3">
              <p className="break-all font-mono text-xs text-muted-foreground">
                {selectedClip.source.ref}
              </p>
              <div className="flex flex-wrap items-end gap-3">
                {selectedIsOverlay ? (
                  <NumField
                    label="freeze at (s)"
                    value={selectedClip.at ?? 0}
                    min={0}
                    onCommit={(at) => apply((e) => setOverlayAt(e, at))}
                  />
                ) : (
                  <>
                    <NumField
                      label="in (s)"
                      value={selectedClip.in}
                      min={0}
                      onCommit={(v) => apply((e) => trimBeat(e, selected, { in: v }))}
                    />
                    <NumField
                      label="duration (s)"
                      value={selectedClip.duration}
                      min={0.1}
                      onCommit={(v) => apply((e) => trimBeat(e, selected, { duration: v }))}
                    />
                    <span className="ml-auto flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon-sm"
                        aria-label="Move clip earlier"
                        disabled={selected === 0}
                        onClick={() => {
                          apply((e) => reorderBeat(e, selected, selected - 1));
                          setSelected((s) => s - 1);
                        }}
                      >
                        <ArrowUp aria-hidden />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon-sm"
                        aria-label="Move clip later"
                        disabled={selected >= lane.beats.length - 1}
                        onClick={() => {
                          apply((e) => reorderBeat(e, selected, selected + 1));
                          setSelected((s) => s + 1);
                        }}
                      >
                        <ArrowDown aria-hidden />
                      </Button>
                    </span>
                  </>
                )}
              </div>
              {selectedClip.crop && (
                <FrameComposer
                  projectId={projectId}
                  sourceRef={selectedClip.source.ref}
                  playable={detail.playable}
                  crop={selectedClip.crop}
                  onPatch={(crop) => apply((e) => patchClipCrop(e, selected, crop))}
                />
              )}
              {!selectedIsOverlay && (
                <SwapPicker
                  detail={detail}
                  currentRef={selectedClip.source.ref}
                  onSwap={(ref) => apply((e) => swapBeatSource(e, selected, ref))}
                />
              )}
            </CardContent>
          )}
        </Card>
      </div>

      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>Timeline</CardTitle>
          <CardDescription>
            {lane.beats.length} beat{lane.beats.length === 1 ? "" : "s"}
            {lane.overlay ? " + endcard overlay" : ""} · assembled {assembled}s · output{" "}
            {edl.output.duration}s
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TrackView
            edl={edl}
            selected={selected}
            onSelect={setSelected}
            onEdl={apply}
            onPlayhead={(sec) => {
              const video = previewRef.current;
              if (video && Number.isFinite(video.duration)) {
                video.currentTime = Math.min(sec, video.duration);
              }
            }}
            posterFor={
              detail.playable
                ? (i) => (edl.video[i] ? mediaUrl(projectId, edl.video[i].source.ref) : null)
                : null
            }
          />
          <div className="mt-3">
            <NumField
              label="output duration (s)"
              value={edl.output.duration}
              min={0.1}
              onCommit={(d) => apply((e) => setOutputDuration(e, d))}
            />
            {!lane.overlay && Math.abs(assembled - edl.output.duration) > 0.01 && (
              <p className="mt-1 text-xs text-muted-foreground">
                Assembled lane is {assembled}s but the output -t is {edl.output.duration}s —
                confirm this is deliberate.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>Captions</CardTitle>
          <CardDescription>
            Plate center coordinates + fade windows — placement dodges each beat’s focal object.
            Text is content: the judge gate binds at the approve door (B-ve.4).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!edl.captions || edl.captions.lines.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">No caption lane on this cut.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {edl.captions.lines.map((line, i) => (
                <li
                  key={i}
                  className="flex flex-wrap items-end gap-3 rounded-lg border border-border p-2.5"
                >
                  <label className="flex min-w-48 flex-1 flex-col gap-0.5 text-xs text-muted-foreground">
                    text
                    <input
                      value={line.text}
                      onChange={(e) =>
                        apply((edl2) => patchCaptionLine(edl2, i, { text: e.target.value }))
                      }
                      className="rounded-md border border-border bg-background p-1.5 text-sm text-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                    />
                  </label>
                  <NumField label="x" value={line.x} step={10} className="w-20"
                    onCommit={(x) => apply((e) => patchCaptionLine(e, i, { x: Math.round(x) }))} />
                  <NumField label="y" value={line.y} step={10} className="w-20"
                    onCommit={(y) => apply((e) => patchCaptionLine(e, i, { y: Math.round(y) }))} />
                  <NumField label="fade in (s)" value={line.fadeIn} min={0} className="w-24"
                    onCommit={(v) => apply((e) => patchCaptionLine(e, i, { fadeIn: v }))} />
                  <NumField label="fade out (s)" value={line.fadeOut} min={0} className="w-24"
                    onCommit={(v) => apply((e) => patchCaptionLine(e, i, { fadeOut: v }))} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <MusicLane
        projectId={projectId}
        edl={edl}
        playable={detail.playable}
        onPatch={(patch) => apply((e) => patchMusic(e, patch))}
      />

      <AssistPanel
        projectId={projectId}
        cutId={cut.id}
        baseEdl={cut.edl}
        dirty={dirty}
        onApply={(preview, attribution) => {
          // Deliberately NOT the manual-op funnel: Apply carries its attribution.
          setEdl(preview);
          setDirty(true);
          setPendingAttribution(attribution);
        }}
      />
    </div>
  );
}

/** Slot-scoped take swap: keepers first, rejects VISIBLE with their reasons — the learning material is part of the picker. */
function SwapPicker({
  detail,
  currentRef,
  onSwap,
}: {
  detail: ProjectDetail;
  currentRef: string;
  onSwap: (ref: string) => void;
}) {
  const candidates = swapCandidatesFor(detail.takes, currentRef).filter(
    (t) => t.ref !== currentRef,
  );
  if (candidates.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No other takes audition for this clip’s slot.
      </p>
    );
  }
  return (
    <div>
      <p className="u-eyebrow mb-1 text-muted-foreground">swap take</p>
      <ul className="flex flex-col gap-1">
        {candidates.map((take) => (
          <li key={take.id}>
            <button
              type="button"
              onClick={() => onSwap(take.ref)}
              className="flex w-full flex-wrap items-center gap-2 rounded-lg border border-border p-2 text-left hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate font-mono text-xs">{baseName(take.ref)}</span>
                {take.disposition === "reject" && take.reason && (
                  <span className="block truncate text-xs text-muted-foreground">
                    {take.reason}
                  </span>
                )}
              </span>
              <Badge variant={take.disposition === "reject" ? "destructive" : "secondary"}>
                {take.disposition}
              </Badge>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
