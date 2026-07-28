"use client";

import { useEffect, useRef, useState } from "react";
import type { Crop, Edl } from "@thalon/contracts";
import { takeCaption } from "@/components/videos/editor-model";
import type { Selection } from "@/components/videos/editor-timeline";
import { mediaUrl } from "@/lib/videos/client";
import {
  auditionVolume,
  deleteBeat,
  deleteCaptionLine,
  insertBeat,
  insertCaptionLine,
  musicCandidatesFor,
  patchCaptionLine,
  patchMusic,
  reorderBeat,
  setMusicSource,
  setOutputDuration,
  setOverlayAt,
  splitLane,
  trimBeat,
} from "@/lib/videos/editor";
import type { TakeView } from "@/lib/videos/types";
import {
  clampOrigin,
  displayToSource,
  dragCropAxis,
  panEndpoint,
  panModeOf,
  setCropAxisMode,
} from "@/lib/videos/frame";

/**
 * The selection inspector — the B-ve.3 knobs and the B-ve.5/7 reframe,
 * re-entering as a STATE behind the sheet's own timeline (the s74 keeper
 * rule: a keeper comes back as a behaviour behind resting chrome, never as
 * extra chrome). Nothing is selected at rest, so the surface renders exactly
 * as Videos.dc.html draws it until the operator picks a block.
 *
 * Every field commits on blur/Enter through the same pure EDL transforms the
 * drag gestures use, so a half-typed value never reaches the EDL.
 */

export function EditorInspector({
  projectId,
  edl,
  takes,
  selection,
  playable,
  onEdl,
  onSelect,
  onClose,
}: {
  projectId: string;
  edl: Edl;
  /** The project's takes — the beat picker's slots and the music lane's candidate beds. */
  takes: TakeView[];
  selection: Exclude<Selection, null>;
  playable: boolean;
  onEdl: (fn: (edl: Edl) => Edl) => void;
  onSelect: (selection: Selection) => void;
  onClose: () => void;
}) {
  const { beats, overlay } = splitLane(edl);
  const assembled = beats.reduce(
    (sum, clip) => sum + clip.duration - (clip.transitionIn?.duration ?? 0),
    0,
  );
  const drift = Math.abs(Math.round(assembled * 1e6) / 1e6 - edl.output.duration);

  return (
    <div className="inspector">
      <div className="inspector-head">
        <span className="t-title">
          {selection.kind === "beat"
            ? `Beat — ${beats[selection.index]?.name ?? "clip"}`
            : selection.kind === "caption"
              ? `Caption ${selection.index + 1}`
              : "Music cue"}
        </span>
        <div style={{ flex: 1 }} />
        <button type="button" className="btn btn-quiet btn-sm" onClick={onClose}>
          Close
        </button>
      </div>

      {selection.kind === "beat" && (
        <BeatFields
          projectId={projectId}
          edl={edl}
          index={selection.index}
          playable={playable}
          onEdl={onEdl}
          onSelect={onSelect}
        />
      )}
      {selection.kind === "caption" && (
        <CaptionFields edl={edl} index={selection.index} onEdl={onEdl} onSelect={onSelect} />
      )}
      {selection.kind === "music" && (
        <MusicFields
          projectId={projectId}
          edl={edl}
          takes={takes}
          playable={playable}
          onEdl={onEdl}
        />
      )}

      {overlay !== null && (
        <div className="inspector-row">
          <Field
            label="endcard freeze at (s)"
            value={overlay.at ?? 0}
            min={0}
            onCommit={(at) => onEdl((current) => setOverlayAt(current, at))}
          />
          <span className="t-label">
            where the prior timeline freezes for the endcard fade — measured, never auto-synced
          </span>
        </div>
      )}

      <div className="inspector-row">
        <Field
          label="output duration (s)"
          value={edl.output.duration}
          min={0.1}
          onCommit={(d) => onEdl((current) => setOutputDuration(current, d))}
        />
        {overlay === null && drift > 0.01 && (
          <span className="t-label" style={{ color: "var(--warn)" }}>
            the assembled lane is {Math.round(assembled * 100) / 100}s but the output −t is{" "}
            {edl.output.duration}s — confirm that is deliberate
          </span>
        )}
      </div>
    </div>
  );
}

function BeatFields({
  projectId,
  edl,
  index,
  playable,
  onEdl,
  onSelect,
}: {
  projectId: string;
  edl: Edl;
  index: number;
  playable: boolean;
  onEdl: (fn: (edl: Edl) => Edl) => void;
  onSelect: (selection: Selection) => void;
}) {
  const { beats } = splitLane(edl);
  const clip = beats[index];
  if (!clip) return null;
  return (
    <>
      <div className="inspector-row">
        <span className="t-data inspector-ref">{clip.source.ref}</span>
      </div>
      <div className="inspector-row">
        <Field
          label="in (s)"
          value={clip.in}
          min={0}
          onCommit={(v) => onEdl((current) => trimBeat(current, index, { in: v }))}
        />
        <Field
          label="duration (s)"
          value={clip.duration}
          min={0.1}
          onCommit={(v) => onEdl((current) => trimBeat(current, index, { duration: v }))}
        />
        <div style={{ flex: 1 }} />
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          disabled={index === 0}
          onClick={() => {
            onEdl((current) => reorderBeat(current, index, index - 1));
            onSelect({ kind: "beat", index: index - 1 });
          }}
        >
          ← earlier
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          disabled={index >= beats.length - 1}
          onClick={() => {
            onEdl((current) => reorderBeat(current, index, index + 1));
            onSelect({ kind: "beat", index: index + 1 });
          }}
        >
          later →
        </button>
      </div>
      {/*
        THE MISSING VERBS (s80, slice c). The lane could be reordered and
        trimmed but never CHANGED: no way to drop a beat that shouldn't be in
        the cut, and no way to bring one in from the takes pool. Insert copies
        this beat's source kind and duration rather than inventing them — a
        still is a loop-hold and a motion clip is not, and guessing wrong
        compiles into something nobody asked for.
      */}
      <div className="inspector-row">
        <button
          type="button"
          className="btn btn-quiet btn-sm"
          onClick={() => {
            onEdl((current) => insertBeat(current, index, clip.source.ref));
            onSelect({ kind: "beat", index: index + 1 });
          }}
          title="Insert a beat after this one, on the same source — then swap its take from the strip"
        >
          + Insert beat
        </button>
        <button
          type="button"
          className="btn btn-quiet btn-sm"
          disabled={beats.length <= 1}
          title={
            beats.length <= 1
              ? "the last beat can't be deleted — a cut with no beats can't be rendered"
              : "Delete this beat from the cut — ⌘Z brings it back"
          }
          onClick={() => {
            onEdl((current) => deleteBeat(current, index));
            onSelect(null);
          }}
        >
          Delete beat
        </button>
      </div>
      {clip.crop && (
        <Reframe
          projectId={projectId}
          sourceRef={clip.source.ref}
          playable={playable}
          crop={clip.crop}
          onPatch={(crop) =>
            onEdl((current) => ({
              ...current,
              video: current.video.map((c, i) => (i === index ? { ...c, crop } : c)),
            }))
          }
        />
      )}
    </>
  );
}

function CaptionFields({
  edl,
  index,
  onEdl,
  onSelect,
}: {
  edl: Edl;
  index: number;
  onEdl: (fn: (edl: Edl) => Edl) => void;
  onSelect: (selection: Selection) => void;
}) {
  const line = edl.captions?.lines[index];
  if (!line) return null;
  return (
    <>
      <div className="inspector-row">
        <label className="numfield" style={{ flex: 1 }}>
          text
          <input
            value={line.text}
            onChange={(event) =>
              onEdl((current) => patchCaptionLine(current, index, { text: event.target.value }))
            }
          />
        </label>
      </div>
      <div className="inspector-row">
        <Field
          label="x"
          value={line.x}
          step={10}
          onCommit={(x) => onEdl((current) => patchCaptionLine(current, index, { x: Math.round(x) }))}
        />
        <Field
          label="y"
          value={line.y}
          step={10}
          onCommit={(y) => onEdl((current) => patchCaptionLine(current, index, { y: Math.round(y) }))}
        />
        <Field
          label="fade in (s)"
          value={line.fadeIn}
          min={0}
          onCommit={(v) => onEdl((current) => patchCaptionLine(current, index, { fadeIn: v }))}
        />
        <Field
          label="fade out (s)"
          value={line.fadeOut}
          min={0}
          onCommit={(v) => onEdl((current) => patchCaptionLine(current, index, { fadeOut: v }))}
        />
      </div>
      {/*
        THE MISSING VERBS (s80, slice c). This inspector could only ever PATCH
        a line the generator had already written — there was no way to add a
        caption or delete one, on the surface whose whole job is the cut. Add
        lands the new plate after this one and selects it, so the operator is
        typing into the thing they just made rather than hunting for it.
      */}
      <div className="inspector-row">
        <button
          type="button"
          className="btn btn-quiet btn-sm"
          onClick={() => {
            onEdl((current) => insertCaptionLine(current, index, "new caption"));
            onSelect({ kind: "caption", index: index + 1 });
          }}
          title="Add a caption line after this one — it inherits this plate's placement"
        >
          + Add caption
        </button>
        <button
          type="button"
          className="btn btn-quiet btn-sm"
          onClick={() => {
            onEdl((current) => deleteCaptionLine(current, index));
            onSelect(null);
          }}
          title="Delete this caption line — ⌘Z brings it back"
        >
          Delete caption {index + 1}
        </button>
      </div>
      <div className="inspector-row">
        <span className="t-label">
          Plate coordinates dodge each beat’s focal object. Caption text is content: the gate binds
          at the approve door — it gates, it never rewrites.
        </span>
      </div>
    </>
  );
}

/**
 * THE BED PICKER — the "Swap music" verb, over the project's own candidates.
 *
 * It renders for a silent cut as well as a scored one, because the two are the
 * same act: a silent cut's music lane used to say "Silent cut — no music lane
 * on this EDL" as flat text, which is a true statement and a dead end. The
 * project ships seven candidate beds; nothing on the surface could reach them.
 */
function BedPicker({
  takes,
  currentRef,
  onEdl,
}: {
  takes: TakeView[];
  currentRef: string | null;
  onEdl: (fn: (edl: Edl) => Edl) => void;
}) {
  const candidates = musicCandidatesFor(takes);
  if (candidates.length === 0) {
    return (
      <div className="inspector-row">
        <span className="t-label">
          This project ships no music candidates — import beds under
          <code> music-candidates/</code> and they become choices here.
        </span>
      </div>
    );
  }
  return (
    <>
      <div className="inspector-row">
        <span className="t-label">
          {currentRef === null ? "Choose a bed" : "Swap the bed"} — {candidates.length} candidate
          {candidates.length === 1 ? "" : "s"} in this project
        </span>
      </div>
      <div className="strip">
        {candidates.map((take) => {
          const on = take.ref === currentRef;
          return (
            <button
              key={take.id}
              type="button"
              className={on ? "take on" : "take"}
              aria-pressed={on}
              disabled={on}
              /*
                The VERB is in the accessible name, not only in a title. A tile
                whose name is just the file tells a screen-reader user what the
                thing is called and nothing about what pressing it does — the
                audit's "the strip's only verb is stated only in a title".
              */
              aria-label={
                on
                  ? `${bedName(take.ref)} — already the music bed on this cut`
                  : `Swap the music bed to ${bedName(take.ref)}`
              }
              title={on ? `${take.ref} — already the bed on this cut` : `swap the bed to ${take.ref}`}
              onClick={() => onEdl((current) => setMusicSource(current, take.ref, take.kind === "audio" ? "audio" : "take"))}
            >
              <div className="thumb-md">
                <span>{on ? "in the cut" : bedName(take.ref)}</span>
              </div>
              <span className="take-cap">{on ? bedName(take.ref) : takeCaption(take)}</span>
            </button>
          );
        })}
      </div>
      <div className="inspector-row">
        <span className="t-label">
          A swapped bed is encoded, not stream-copied, so its offset, gain and tail easing become
          editable — and the offset resets, because seconds into one track mean nothing in another.
        </span>
      </div>
    </>
  );
}

/** The candidate's FILE NAME — the whole one, so eight cello takes can be told apart. */
function bedName(ref: string): string {
  return ref.split("/").pop() ?? ref;
}

function MusicFields({
  projectId,
  edl,
  takes,
  playable,
  onEdl,
}: {
  projectId: string;
  edl: Edl;
  takes: TakeView[];
  playable: boolean;
  onEdl: (fn: (edl: Edl) => Edl) => void;
}) {
  const cue = edl.audio[0];
  if (!cue) {
    return (
      <>
        <div className="inspector-row">
          <span className="t-label">This cut is silent — no music cue on its EDL.</span>
        </div>
        <BedPicker takes={takes} currentRef={null} onEdl={onEdl} />
      </>
    );
  }
  if (cue.mode === "copy") {
    return (
      <>
        <div className="inspector-row">
          <span className="t-data inspector-ref">{cue.source.ref}</span>
          <span className="t-label">
            Stream-copied verbatim from the source — no knobs, by contract.
          </span>
        </div>
        <BedPicker takes={takes} currentRef={cue.source.ref} onEdl={onEdl} />
      </>
    );
  }
  const fadeOut = cue.fadeOut;
  return (
    <>
      <div className="inspector-row">
        <span className="t-data inspector-ref">{cue.source.ref}</span>
      </div>
      <BedPicker takes={takes} currentRef={cue.source.ref} onEdl={onEdl} />
      {playable && (
        <div className="inspector-row">
          <Waveform
            src={mediaUrl(projectId, cue.source.ref)}
            offset={cue.offset}
            gainDb={cue.gainDb}
            onOffset={(offset) => onEdl((current) => patchMusic(current, { offset }))}
          />
        </div>
      )}
      <div className="inspector-row">
        <Field
          label="offset (s)"
          value={cue.offset}
          min={0}
          onCommit={(offset) => onEdl((current) => patchMusic(current, { offset }))}
        />
        <Field
          label="gain (dB)"
          value={cue.gainDb}
          step={0.5}
          onCommit={(gainDb) => onEdl((current) => patchMusic(current, { gainDb }))}
        />
        {fadeOut ? (
          <>
            <Field
              label="tail at (s)"
              value={fadeOut.start}
              min={0}
              onCommit={(start) =>
                onEdl((current) => patchMusic(current, { fadeOut: { ...fadeOut, start } }))
              }
            />
            <Field
              label="tail length (s)"
              value={fadeOut.duration}
              min={0.1}
              onCommit={(duration) =>
                onEdl((current) => patchMusic(current, { fadeOut: { ...fadeOut, duration } }))
              }
            />
            <button
              type="button"
              className="btn btn-quiet btn-sm"
              onClick={() => onEdl((current) => patchMusic(current, { fadeOut: undefined }))}
            >
              Remove easing
            </button>
          </>
        ) : (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() =>
              onEdl((current) =>
                patchMusic(current, {
                  fadeOut: { start: Math.max(0, current.output.duration - 2), duration: 1.5 },
                }),
              )
            }
          >
            Add tail easing
          </button>
        )}
      </div>
      <div className="inspector-row">
        <span className="t-label">
          The offset is measured, the gain is static and the tail eases — never ducking, never a
          manufactured ending.
        </span>
      </div>
    </>
  );
}

/** The wavesurfer surface this lane uses (v7); dynamic-imported so the editor bundle stays lean. */
interface WaveSurferHandle {
  destroy(): void;
  play(): Promise<void> | void;
  pause(): void;
  isPlaying(): boolean;
  setTime(seconds: number): void;
  setVolume(volume: number): void;
  on(event: "interaction" | "ready", cb: (value: number) => void): void;
}

/**
 * The measured-alignment keeper (s44 method): clicking the waveform sets the
 * in-point AND auditions from it — one gesture, measured, never estimated.
 * The amber marker shows where the cut enters the track.
 *
 * B-audio.1 piece 2: the audition is now the CUE's audition. Playback starts
 * at the cue's real offset and plays at the cue's real gain, so what the
 * operator hears is what the mux will write. A waveform that plays from zero
 * at full level is a drawing of a track, not a preview of a cut.
 */
function Waveform({
  src,
  offset,
  gainDb,
  onOffset,
}: {
  src: string;
  offset: number;
  gainDb: number;
  onOffset: (seconds: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const wsRef = useRef<WaveSurferHandle | null>(null);
  const [trackDuration, setTrackDuration] = useState(0);
  const volume = auditionVolume(gainDb);

  useEffect(() => {
    let cancelled = false;
    let ws: WaveSurferHandle | null = null;
    void import("wavesurfer.js").then(({ default: WaveSurfer }) => {
      if (cancelled || !containerRef.current) return;
      ws = WaveSurfer.create({
        container: containerRef.current,
        url: src,
        height: 56,
        waveColor: "var(--n-600)",
        progressColor: "var(--act)",
        cursorColor: "var(--act)",
      }) as unknown as WaveSurferHandle;
      ws.on("ready", (duration) => setTrackDuration(duration));
      ws.on("interaction", (at) => onOffset(Math.round(at * 100) / 100));
      wsRef.current = ws;
    });
    return () => {
      cancelled = true;
      ws?.destroy();
      wsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-create only when the source changes; onOffset is stable enough per render
  }, [src]);

  // The level follows the knob live: turn the gain down mid-audition and the
  // audition turns down with it.
  useEffect(() => {
    wsRef.current?.setVolume(volume);
  }, [volume]);

  return (
    <div className="wave">
      <div className="wave-stage">
        <div ref={containerRef} aria-label="Music waveform — click to set the offset" />
        {trackDuration > 0 && (
          <span
            aria-hidden
            className="wave-mark"
            style={{ left: `${Math.min(100, (offset / trackDuration) * 100)}%` }}
          />
        )}
      </div>
      <div className="inspector-row">
        <span className="t-label">
          Click the waveform to set where the track enters; playback auditions from the cue&rsquo;s
          offset at its gain
          {gainDb > 0 ? " (a boost cannot be auditioned — heard at full scale)" : ""}.
        </span>
        <div style={{ flex: 1 }} />
        <button
          type="button"
          className="btn btn-quiet btn-sm"
          onClick={() => {
            const ws = wsRef.current;
            if (!ws) return;
            if (ws.isPlaying()) {
              ws.pause();
              return;
            }
            // Audition the CUT, not the file: enter where the cue enters.
            ws.setTime(Math.max(0, offset));
            ws.setVolume(volume);
            void ws.play();
          }}
        >
          Play / pause
        </button>
      </div>
    </div>
  );
}

/**
 * The reframe window (B-ve.5/7): the overlay rectangle IS the measuring
 * tool — it reads and writes SOURCE pixels over the real take, and the
 * browser's videoWidth/videoHeight is the measurement (CSS percentages only
 * project it). A pan axis drags its start (solid) and end (dashed) windows
 * separately; an expression pan is shown as data and never dragged (the
 * knobless-honesty precedent).
 */
function Reframe({
  projectId,
  sourceRef,
  playable,
  crop,
  onPatch,
}: {
  projectId: string;
  sourceRef: string;
  playable: boolean;
  crop: Crop;
  onPatch: (crop: Crop) => void;
}) {
  const [dims, setDims] = useState<{ width: number; height: number } | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ which: "start" | "end"; x: number; y: number; crop: Crop } | null>(null);

  const xMode = panModeOf(crop.x);
  const yMode = panModeOf(crop.y);
  const hasPanAxis = xMode === "pan" || yMode === "pan";
  const hasExpression = xMode === "expression" || yMode === "expression";

  const rectStyle = (which: "start" | "end") => {
    if (!dims) return null;
    const x = panEndpoint(crop.x, which);
    const y = panEndpoint(crop.y, which);
    if (x === null || y === null) return null;
    return {
      left: `${(x / dims.width) * 100}%`,
      top: `${(y / dims.height) * 100}%`,
      width: `${(crop.width / dims.width) * 100}%`,
      height: `${(crop.height / dims.height) * 100}%`,
    };
  };

  const moveDrag = (event: React.PointerEvent) => {
    const drag = dragRef.current;
    const stage = stageRef.current;
    if (!drag || !stage || !dims) return;
    const rect = stage.getBoundingClientRect();
    const startX = panEndpoint(drag.crop.x, drag.which);
    const startY = panEndpoint(drag.crop.y, drag.which);
    let next = drag.crop;
    if (startX !== null) {
      next = dragCropAxis(
        next,
        "x",
        drag.which,
        startX + displayToSource(event.clientX - drag.x, rect.width, dims.width),
        dims.width,
      );
    }
    if (startY !== null) {
      next = dragCropAxis(
        next,
        "y",
        drag.which,
        startY + displayToSource(event.clientY - drag.y, rect.height, dims.height),
        dims.height,
      );
    }
    onPatch(next);
  };

  const commitAxis = (axis: "x" | "y", which: "start" | "end") => (value: number) => {
    const size = axis === "x" ? crop.width : crop.height;
    const bound = dims ? (axis === "x" ? dims.width : dims.height) : Number.MAX_SAFE_INTEGER;
    onPatch(dragCropAxis(crop, axis, which, clampOrigin(value, size, bound), bound));
  };

  const startStyle = rectStyle("start");
  const endStyle = hasPanAxis ? rectStyle("end") : null;

  return (
    <>
      <div className="inspector-row">
        <span className="t-label">Reframe — coordinates are SOURCE pixels, measured</span>
        <div style={{ flex: 1 }} />
        <span className="t-data">
          window {crop.width}×{crop.height}
          {dims ? ` · of ${dims.width}×${dims.height} (measured)` : playable ? " · measuring…" : ""}
        </span>
      </div>
      {playable ? (
        <div className="inspector-row">
          <div ref={stageRef} className="reframe-stage">
            <video
              preload="metadata"
              muted
              src={mediaUrl(projectId, sourceRef)}
              onLoadedMetadata={(event) => {
                const el = event.currentTarget;
                if (el.videoWidth > 0) setDims({ width: el.videoWidth, height: el.videoHeight });
              }}
            />
            {startStyle && (
              <div
                role="slider"
                aria-label="Crop window (start)"
                aria-valuenow={panEndpoint(crop.x, "start") ?? 0}
                tabIndex={0}
                className="reframe-win"
                style={startStyle}
                onPointerDown={(event) => {
                  if (hasExpression || !dims) return;
                  event.preventDefault();
                  (event.target as Element).setPointerCapture?.(event.pointerId);
                  dragRef.current = { which: "start", x: event.clientX, y: event.clientY, crop };
                }}
                onPointerMove={moveDrag}
                onPointerUp={() => (dragRef.current = null)}
              />
            )}
            {endStyle && (
              <div
                role="slider"
                aria-label="Crop window (end)"
                aria-valuenow={panEndpoint(crop.x, "end") ?? 0}
                tabIndex={0}
                className="reframe-win end"
                style={endStyle}
                onPointerDown={(event) => {
                  if (hasExpression || !dims) return;
                  event.preventDefault();
                  (event.target as Element).setPointerCapture?.(event.pointerId);
                  dragRef.current = { which: "end", x: event.clientX, y: event.clientY, crop };
                }}
                onPointerMove={moveDrag}
                onPointerUp={() => (dragRef.current = null)}
              />
            )}
          </div>
        </div>
      ) : (
        <div className="inspector-row">
          <span className="t-label">
            Playback is off on this box — the window is editable by numbers only.
          </span>
        </div>
      )}
      {hasExpression && (
        <div className="inspector-row">
          <span className="t-data inspector-ref">
            expression pan (edited as data, never dragged):{" "}
            {xMode === "expression"
              ? (crop.x as { expr: string }).expr
              : (crop.y as { expr: string }).expr}
          </span>
        </div>
      )}
      <div className="inspector-row">
        <Field
          label="width"
          value={crop.width}
          min={2}
          step={2}
          onCommit={(w) => onPatch({ ...crop, width: Math.max(2, Math.round(w / 2) * 2) })}
        />
        <Field
          label="height"
          value={crop.height}
          min={2}
          step={2}
          onCommit={(h) => onPatch({ ...crop, height: Math.max(2, Math.round(h / 2) * 2) })}
        />
        {xMode !== "expression" && (
          <>
            <Field
              label={xMode === "static" ? "x" : "x from"}
              value={panEndpoint(crop.x, "start") ?? 0}
              min={0}
              onCommit={commitAxis("x", "start")}
            />
            {xMode === "pan" && (
              <Field
                label="x to"
                value={panEndpoint(crop.x, "end") ?? 0}
                min={0}
                onCommit={commitAxis("x", "end")}
              />
            )}
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() =>
                onPatch(setCropAxisMode(crop, "x", xMode === "static" ? "pan" : "static"))
              }
            >
              {xMode === "static" ? "x: static → pan" : "x: pan → static"}
            </button>
          </>
        )}
        {yMode !== "expression" && (
          <>
            <Field
              label={yMode === "static" ? "y" : "y from"}
              value={panEndpoint(crop.y, "start") ?? 0}
              min={0}
              onCommit={commitAxis("y", "start")}
            />
            {yMode === "pan" && (
              <Field
                label="y to"
                value={panEndpoint(crop.y, "end") ?? 0}
                min={0}
                onCommit={commitAxis("y", "end")}
              />
            )}
          </>
        )}
      </div>
    </>
  );
}

/**
 * A labelled number field that keeps local text state and COMMITS on
 * blur/Enter — half-typed values never reach the EDL, and the committed
 * value round-trips back into the field.
 */
function Field({
  label,
  value,
  onCommit,
  step = 0.1,
  min,
}: {
  label: string;
  value: number;
  onCommit: (value: number) => void;
  step?: number;
  min?: number;
}) {
  const [text, setText] = useState(String(value));
  // Committed-value changes (a drag, a save round-trip) reset the draft text —
  // adjusted during render, not in an effect.
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    setText(String(value));
  }
  return (
    <label className="numfield">
      {label}
      <input
        type="number"
        step={step}
        min={min}
        value={text}
        onChange={(event) => setText(event.target.value)}
        onBlur={() => {
          const parsed = Number(text);
          if (!Number.isFinite(parsed) || text.trim() === "") {
            setText(String(value));
            return;
          }
          onCommit(parsed);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") (event.target as HTMLInputElement).blur();
        }}
      />
    </label>
  );
}
