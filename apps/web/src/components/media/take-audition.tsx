"use client";

import { useEffect, useId, useState, useSyncExternalStore } from "react";
import { mediaUrl } from "@/lib/videos/client";
import "@/components/media/take-audition.css";

/**
 * `<TakeAudition>` — the s82 W2 seam: hear or watch a candidate BEFORE
 * committing it. Two surfaces consume it, which is why it is a shared
 * component rather than either one's markup: the editor's takes strip
 * (lane A) auditions a candidate take before swapping a beat to it, and the
 * inspector's bed picker (lane B) auditions a music bed before swapping the
 * cut's music. Both were choosing blind — the bed picker especially, where
 * "pick one of nine beds by filename" is not a decision anyone can make.
 *
 * It renders only the AFFORDANCE and the player, never the tile: both
 * surfaces already draw their own tiles with their own sizing, and a
 * component that dictated tile markup would have to flatten one of them.
 *
 * **Only one audition plays at a time, and neither lane has to arrange it.**
 * Nine beds playing over each other is noise, not an audition. The
 * coordination lives in a module-level store read through
 * `useSyncExternalStore` rather than a context provider, deliberately: a
 * provider would need a wrapper element in both surfaces — a cross-file edit
 * in exactly the two files the lanes were split to keep apart. This way the
 * guarantee is structural and the wiring is one self-contained tag.
 */

/* ------------------------------------------------------------------ */
/* The one-at-a-time store.                                            */
/* ------------------------------------------------------------------ */

/**
 * The slot records WHICH REF it was started for, not just which component
 * holds it. That extra field is what makes a recycled tile safe: when a host
 * re-points an instance at a different candidate, the slot no longer matches
 * and the control lands at rest — declaratively, with nothing mutated during
 * render. Keying on the component alone meant a recycled tile inherited the
 * audition and began streaming a file nobody asked to hear.
 */
let current: { id: string; ref: string } | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Exported for tests: an audition left playing by one case must not leak into the next. */
export function resetAuditions(): void {
  current = null;
  emit();
}

export type AuditionKind = "motion" | "audio";

export interface TakeAuditionProps {
  projectId: string;
  /** Project-relative ref — the take's identity, and what the media door streams. */
  refPath: string;
  /**
   * `motion` draws a `<video>`, `audio` an `<audio>`. Narrower than
   * `VideoTakeKind` on purpose: a `still` has nothing to audition, so a
   * caller must decide that explicitly rather than passing a take's kind
   * through and rendering a player with no time in it.
   */
  kind: AuditionKind;
  /** What the control is auditioning, for its accessible name ("bed 03", "take clip-01"). */
  label: string;
}

export function TakeAudition({ projectId, refPath, kind, label }: TakeAuditionProps) {
  const id = useId();
  const playing = useSyncExternalStore(
    subscribe,
    () => current?.id === id && current.ref === refPath,
    // Server render: nothing is auditioning, so the button starts at rest.
    () => false,
  );
  const [failed, setFailed] = useState(false);

  // A tile recycled to a different ref must not inherit the previous ref's
  // failure — the SourceThumb precedent, adjusted DURING render rather than in
  // an effect, which would paint the stale broken state for a frame first.
  const [seenRef, setSeenRef] = useState(refPath);
  if (refPath !== seenRef) {
    setSeenRef(refPath);
    setFailed(false);
  }

  // Unmounting while playing must release the slot, or the next audition
  // would find it taken by a component that no longer exists.
  useEffect(() => {
    return () => {
      if (current?.id === id) {
        current = null;
        emit();
      }
    };
  }, [id]);

  function toggle(): void {
    current = playing ? null : { id, ref: refPath };
    setFailed(false);
    emit();
  }

  /**
   * A failed audition must hand the slot back. Holding it while showing an
   * unplayable notice would leave the one-at-a-time guarantee pointed at a
   * control that can no longer release it.
   */
  function reportUnplayable(): void {
    setFailed(true);
    if (current?.id === id) {
      current = null;
      emit();
    }
  }

  if (failed) {
    // The file is gone, or the project has no media root on this box. A dead
    // play button that does nothing is the defect this states instead.
    return (
      <span className="take-audition take-audition-dead" role="status">
        <span className="take-audition-slash" aria-hidden="true" />
        {kind === "audio" ? "bed" : "take"} unplayable
      </span>
    );
  }

  return (
    <span className="take-audition">
      <button
        type="button"
        className="take-audition-btn"
        // The control keeps its own state in its accessible name AND in
        // aria-pressed: a toggle that only LOOKS pressed is invisible to
        // anything not reading pixels (the s81 accessible-name lesson).
        aria-pressed={playing}
        aria-label={playing ? `Stop auditioning ${label}` : `Audition ${label}`}
        onClick={toggle}
      >
        <span className={playing ? "take-audition-stop" : "take-audition-play"} aria-hidden="true" />
      </button>
      {playing && (
        <span className="take-audition-player">
          {kind === "audio" ? (
            <audio
              className="take-audition-audio"
              src={mediaUrl(projectId, refPath)}
              controls
              autoPlay
              onError={reportUnplayable}
            />
          ) : (
            <video
              className="take-audition-video"
              src={mediaUrl(projectId, refPath)}
              controls
              autoPlay
              // A candidate is auditioned for its picture and its cut, not its
              // sound bed — but muting it would hide a take whose audio is the
              // reason it is a reject. It plays as recorded.
              playsInline
              onError={reportUnplayable}
            />
          )}
        </span>
      )}
    </span>
  );
}
