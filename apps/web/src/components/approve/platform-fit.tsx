"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatStamp, platformLabel } from "@/components/approve/approve-model";
import {
  cancelQueueRow,
  fetchDraftFit,
  fetchQueueRows,
  isLiveQueueRow,
  scheduleDraft,
  type FitResponse,
  type PlatformFitWire,
  type QueueRowWire,
} from "@/components/approve/queue-client";
import type { GridDraft } from "@/lib/approve-queue/types";

/**
 * C1 wiring #2 + C2 + C4 (s82): the platform-true half of the Approve card
 * — the fit line, the preview state behind it, and the *Schedule* verb.
 *
 * FOUNDER CALL #3, DECIDED: this ships as a keeper-STATE behind existing
 * chrome, NOT as a sheet amendment. The sheet stays law. So the fit line
 * borrows the checks band's own "reasons on record →" grammar for its
 * preview door, and the Schedule verb sits in the action rail the sheet
 * already draws, beside "Plan a slot →". Permanent chrome is something a
 * card earns in dogfood, not something a lane grants itself.
 *
 * NOTHING HERE MEASURES ANYTHING. Every number comes from the engine's one
 * validator through `/api/social/fit`, which is also what the queue
 * producer refuses on — so what the preview shows and what the Schedule
 * verb accepts can never drift apart.
 */

export interface PlatformFitState {
  status: "idle" | "loading" | "error" | "success";
  fit: FitResponse | null;
  rows: QueueRowWire[];
  reload: () => void;
}

/**
 * Reads the draft's fit and its queue rows together, and re-reads whenever
 * the BODY changes — `bodyHash` is in the dependency list on purpose: an
 * operator edit produces a new body, and a fit line describing the old one
 * is exactly the stale-derivation defect the stamp's own docstring warns
 * about.
 */
export function usePlatformFit(draft: GridDraft | null): PlatformFitState {
  const [status, setStatus] = useState<PlatformFitState["status"]>("idle");
  const [fit, setFit] = useState<FitResponse | null>(null);
  const [rows, setRows] = useState<QueueRowWire[]>([]);
  const draftId = draft?.id ?? null;
  const bodyHash = draft?.bodyHash ?? null;
  /**
   * Which read is the LIVE one. An edit fires a second read while the first
   * is still in flight, and the two can land out of order — a fit line
   * describing the pre-edit body, sitting under the post-edit body, is
   * exactly the stale-derivation defect the whole `bodyHash` discipline
   * exists to prevent (the surface's own selectedDraftIdRef precedent).
   */
  const liveRead = useRef(0);

  const read = useCallback(() => {
    if (!draftId) return Promise.resolve();
    const token = liveRead.current + 1;
    liveRead.current = token;
    return Promise.all([fetchDraftFit(draftId), fetchQueueRows({ draftId })])
      .then(([nextFit, nextRows]) => {
        if (liveRead.current !== token) return;
        setFit(nextFit);
        setRows(nextRows);
        setStatus("success");
      })
      .catch(() => {
        // A failed read is a failed read — the card says the fit is UNKNOWN
        // rather than showing an invented one or nothing at all.
        if (liveRead.current === token) setStatus("error");
      });
  }, [draftId]);

  // bodyHash is a dependency on purpose: an operator edit produces a new
  // body, and the measurement must follow it.
  useEffect(() => {
    if (!draftId) return;
    void read();
  }, [draftId, bodyHash, read]);

  return { status, fit, rows, reload: read };
}

/* ── The fit line ───────────────────────────────────────────────────────── */

function fitSummary(fit: PlatformFitWire): string {
  const parts = [`${fit.text.billedChars} of ${fit.text.maxChars} characters`];
  if (fit.text.links.length > 0) {
    parts.push(
      fit.text.urlWeight === null
        ? `${fit.text.links.length} link${fit.text.links.length === 1 ? "" : "s"} counted in full`
        : `${fit.text.links.length} link${fit.text.links.length === 1 ? "" : "s"} billed at ${fit.text.urlWeight} each`,
    );
  }
  if (fit.text.hashtags.length > 0) {
    parts.push(
      fit.text.maxHashtags === null
        ? `${fit.text.hashtags.length} hashtag${fit.text.hashtags.length === 1 ? "" : "s"}`
        : `${fit.text.hashtags.length} of ${fit.text.maxHashtags} hashtags`,
    );
  }
  if (fit.media.count > 0) {
    parts.push(`${fit.media.count} image${fit.media.count === 1 ? "" : "s"}`);
  }
  return parts.join(" · ");
}

export function FitLine({
  state,
  previewOpen,
  onTogglePreview,
}: {
  state: PlatformFitState;
  previewOpen: boolean;
  onTogglePreview: () => void;
}) {
  if (state.status === "loading" || state.status === "idle") {
    return <span className="t-label">Measuring this draft against the platform…</span>;
  }
  if (state.status === "error") {
    return (
      <span className="t-label" style={{ color: "var(--warn)" }}>
        Couldn’t measure this draft against the platform — the fit is unknown, not passing.
      </span>
    );
  }
  const response = state.fit;
  if (!response) return null;
  // A blog page or an outreach email has no platform ceiling, so there is
  // nothing to state and the card stays byte-true to the sheet. The reason
  // still surfaces where its absence needs explaining — beside the missing
  // Schedule verb on an approved draft.
  if (!response.supported) return null;
  const fit = response.fit;
  return (
    <div className="fit-line">
      <span className={fit.fits ? "check" : "check check-err"}>
        <span className="ck">{fit.fits ? "✓" : "✗"}</span>
        {fit.fits
          ? `Fits ${platformLabel(fit.platform)} — ${fitSummary(fit)}`
          : fit.problems[0].message}
      </span>
      <div style={{ flex: 1 }} />
      <button
        type="button"
        className="t-label as-text-btn"
        aria-expanded={previewOpen}
        onClick={onTogglePreview}
      >
        platform preview →
      </button>
    </div>
  );
}

/* ── The platform-true preview ──────────────────────────────────────────── */

/**
 * What the platform will actually render: the body split the way the
 * platform reads it (links and hashtags marked), and — the fact the sheet's
 * plain body can never show — WHERE THE CEILING FALLS. Everything past the
 * cut is drawn as refused, because that is what happens to it.
 *
 * The cut is the platform's ACCEPTANCE ceiling, not a feed's "…see more"
 * fold: the matrix carries the first as a published fact and says nothing
 * about the second, and drawing a fold we have no data for would be a
 * guess dressed as a preview.
 */
export function PlatformPreview({ fit }: { fit: PlatformFitWire }) {
  const kept: Array<{ kind: string; text: string; key: string }> = [];
  const cut: Array<{ kind: string; text: string; key: string }> = [];
  let index = 0;
  fit.text.segments.forEach((segment, i) => {
    const start = index;
    index += segment.text.length;
    if (start >= fit.text.cutIndex) {
      cut.push({ kind: segment.kind, text: segment.text, key: `s${i}` });
      return;
    }
    if (index <= fit.text.cutIndex) {
      kept.push({ kind: segment.kind, text: segment.text, key: `s${i}` });
      return;
    }
    // The cut lands inside this segment (only ever plain text — a link is
    // billed whole or not at all, so the cut is placed in front of one).
    const split = fit.text.cutIndex - start;
    kept.push({ kind: segment.kind, text: segment.text.slice(0, split), key: `s${i}a` });
    cut.push({ kind: segment.kind, text: segment.text.slice(split), key: `s${i}b` });
  });

  const className = (kind: string) =>
    kind === "link" ? "fit-link" : kind === "hashtag" ? "fit-tag" : undefined;

  return (
    <div className="preview-panel" role="group" aria-label="Platform preview">
      <span className="t-label">
        {`what ${platformLabel(fit.platform)} will render — measured against its published ceiling (checked ${fit.capability.verifiedOn})`}
      </span>
      <p className="fit-preview-body">
        {kept.map((piece) => (
          <span key={piece.key} className={className(piece.kind)}>
            {piece.text}
          </span>
        ))}
        {cut.length > 0 && (
          <>
            <span className="fit-cut" aria-hidden />
            <span className="fit-over">
              {cut.map((piece) => (
                <span key={piece.key}>{piece.text}</span>
              ))}
            </span>
          </>
        )}
      </p>
      {cut.length > 0 && (
        <span className="t-label" style={{ color: "var(--err)" }}>
          {`${platformLabel(fit.platform)} stops at ${fit.text.maxChars} — everything after the rule is ${fit.text.overBy} character${fit.text.overBy === 1 ? "" : "s"} the platform will refuse.`}
        </span>
      )}
      <span className="t-label">{fitSummary(fit)}</span>
      {fit.problems.length > 0 && (
        <div className="reasons-panel" role="group" aria-label="Why it does not fit">
          {fit.problems.map((problem) => (
            <div key={problem.code} className="reason-row">
              <span className="reason-mark" aria-hidden style={{ color: "var(--err)" }}>
                ✗
              </span>
              <span className="reason-gate">{problem.code.replace(/_/g, " ")}</span>
              <span className="reason-lines">{problem.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── The Schedule verb ──────────────────────────────────────────────────── */

/** A Date as the value a `datetime-local` input wants — local parts, no zone (the calendar's own helper). */
function toLocalInputValue(date: Date): string {
  const pad = (n: number) => `${n}`.padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const QUEUE_WORDS: Record<string, string> = {
  pending: "waiting for its slot",
  processing: "being published now",
  published: "published",
  failed: "failed",
  cancelled: "cancelled",
};

export function ScheduleControl({
  draft,
  state,
  disabled,
}: {
  draft: GridDraft;
  state: PlatformFitState;
  /** The card's own busy flag — one write at a time, like every other verb here. */
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [when, setWhen] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const response = state.fit;
  const live = state.rows.find(isLiveQueueRow) ?? null;
  const history = state.rows.filter((row) => !isLiveQueueRow(row));

  // Only an approved post-family draft can be committed to a time, and only
  // on a platform the matrix covers — the same two facts the engine door
  // checks, stated here so the verb is absent rather than dead.
  const schedulable =
    draft.status === "approved" && response !== null && response.supported && response.fit.fits;

  function begin() {
    if (response?.supported) setWhen(toLocalInputValue(new Date(response.suggestedAt)));
    setError(null);
    setOpen(true);
  }

  function commit() {
    if (!response?.supported) return;
    const at = new Date(when);
    if (Number.isNaN(at.getTime())) {
      setError("That is not a time — pick an instant in the future.");
      return;
    }
    setBusy(true);
    setError(null);
    scheduleDraft({
      draftId: draft.id,
      platform: response.fit.platform,
      scheduledAt: at.toISOString(),
    })
      .then(() => {
        setOpen(false);
        state.reload();
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Couldn’t schedule this draft.");
      })
      .finally(() => setBusy(false));
  }

  function withdraw(id: string) {
    setBusy(true);
    setError(null);
    cancelQueueRow(id)
      .then(() => state.reload())
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Couldn’t cancel this scheduled row.");
      })
      .finally(() => setBusy(false));
  }

  if (state.status !== "success" || !response) return null;
  // Nothing to say about this draft's commitment: the sheet's resting
  // footer stays byte-true rather than gaining an empty band. A queued or
  // blocked draft is not schedulable and has no history — that is the
  // Approve queue's main case, and it must look exactly as it did.
  if (!live && !schedulable && history.length === 0 && draft.status !== "approved") return null;

  return (
    <div className="sched-block">
      {live && (
        <div className="sched-row">
          <span className="pill pill-idle">Scheduled</span>
          <span className="t-label">
            {`${platformLabel(live.platform)} · ${formatStamp(live.scheduledAt ?? live.createdAt)} · ${QUEUE_WORDS[live.status] ?? live.status}`}
          </span>
          <div style={{ flex: 1 }} />
          {/* Reversible while it is still the operator's decision to make:
              once a consumer has claimed the row, the repo refuses and says
              so rather than pretending the withdrawal landed. */}
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={disabled || busy}
            onClick={() => withdraw(live.id)}
          >
            {busy ? "Cancelling…" : "Cancel schedule"}
          </button>
        </div>
      )}
      {live && (
        <span className="t-label">
          committed, not published — the publisher is disarmed and the row waits; the platform’s own
          door still arms on your GO
        </span>
      )}

      {!live && schedulable && !open && (
        <div className="sched-row">
          <button type="button" className="btn btn-ghost btn-sm" disabled={disabled} onClick={begin}>
            Schedule…
          </button>
          <span className="t-label">
            a queue row is a commitment with a time — a plan is only an intention
          </span>
        </div>
      )}

      {!live && schedulable && open && (
        <div className="sched-row sched-form">
          <label className="t-label" htmlFor={`sched-${draft.id}`}>
            {`Publish to ${platformLabel(response.supported ? response.fit.platform : draft.platform)} at`}
          </label>
          <input
            id={`sched-${draft.id}`}
            className="input"
            type="datetime-local"
            value={when}
            disabled={busy}
            onChange={(event) => setWhen(event.target.value)}
          />
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={busy || when === ""}
            onClick={commit}
          >
            {busy ? "Scheduling…" : "Schedule"}
          </button>
          <button
            type="button"
            className="btn btn-quiet btn-sm"
            disabled={busy}
            onClick={() => setOpen(false)}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Fail-closed, the card's own rule: while the post does not fit, the
          verb is ABSENT and the line says why — never a button that will be
          refused the moment it is pressed. */}
      {!live && !schedulable && draft.status === "approved" && (
        <span className="t-label">
          {response.supported
            ? response.fit.fits
              ? "scheduling is available for approved social drafts"
              : "scheduling is absent while the post does not fit — the platform would refuse it; edit the draft and the judge re-runs"
            : response.reason}
        </span>
      )}

      {history.length > 0 && (
        <div className="sched-history">
          {history.map((row) => (
            <span key={row.id} className="t-label">
              {`${platformLabel(row.platform)} · ${formatStamp(row.scheduledAt ?? row.createdAt)} · ${QUEUE_WORDS[row.status] ?? row.status}`}
              {row.lastError ? ` — ${row.lastError}` : ""}
            </span>
          ))}
        </div>
      )}

      {error && (
        <span className="t-label" role="alert" style={{ color: "var(--err)" }}>
          {error}
        </span>
      )}
    </div>
  );
}
