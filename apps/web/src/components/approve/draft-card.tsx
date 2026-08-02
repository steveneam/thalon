"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  checkGlyph,
  checkLabel,
  checkMarks,
  formatStamp,
  headWindow,
  formatWord,
  overallNote,
  platformLabel,
  statusPill,
  thumbLabel,
  versionStrip,
} from "@/components/approve/approve-model";
import { FormatDetail } from "@/components/approve/format-detail";
import {
  FitLine,
  PlatformPreview,
  ScheduleControl,
  usePlatformFit,
} from "@/components/approve/platform-fit";
import { isTypingTarget } from "@/lib/workspace/keyboard";
import { timeAgo } from "@/lib/workspace/format";
import type { FeedRun, GridDraft, PanelJudgeResult } from "@/lib/approve-queue/types";

export type DetailStatus = "idle" | "loading" | "error" | "success";

interface DraftCardProps {
  status: DetailStatus;
  draft: GridDraft | null;
  /** The run behind the draft — the lineage anchor and the profile/model seats. */
  run: FeedRun | null;
  judgeResults: PanelJudgeResult[];
  busy: boolean;
  /** Message from the last approve/reject/edit/re-judge attempt, if it failed. */
  actionError: string | null;
  onApprove: () => void;
  /** The surface owns the named confirm — the button and the `r` key share it. */
  onReject: () => void;
  onEditSave: (editedBody: string) => void;
  onReJudge: () => void;
  onPublish: () => void;
}

/**
 * The card's own frame, shared by every state. Both branches below return
 * this same <section> so React reuses the DOM node across states — a
 * caller holding the region (tests, focus, a screen reader's cursor) keeps
 * pointing at the live card rather than a detached one.
 */
const CARD_STYLE = { display: "flex", flexDirection: "column", minHeight: 0 } as const;

/**
 * The draft card, ported from `Approve.dc.html`: the status head, the
 * attributed version strip, media placeholder beside the draft body, the
 * per-gate checks band with its verbatim-reasons door, the provenance
 * source line, and the action rail. Keepers woven in BEHIND the sheet's
 * resting chrome (old-design-keepers.md): the `e`-key editor with its
 * Escape cancel, per-gate judge verdicts with reasons VERBATIM, and the
 * fail-closed rule — while any blocking check fails, approve is simply
 * ABSENT and the card says why.
 */
export function DraftCard({
  status,
  draft,
  run,
  judgeResults,
  busy,
  actionError,
  onApprove,
  onReject,
  onEditSave,
  onReJudge,
  onPublish,
}: DraftCardProps) {
  const [editing, setEditing] = useState(false);
  const [editedBody, setEditedBody] = useState("");
  const [reasonsOpen, setReasonsOpen] = useState(false);
  // s82 C4: the platform-true preview is a keeper-STATE behind the checks
  // band's own "→" grammar (founder call #3 — the sheet stays law), so it
  // rests closed exactly as the reasons panel does.
  const [previewOpen, setPreviewOpen] = useState(false);
  // Fit + queue rows for THIS draft. Called before the state branches below,
  // because a hook may not be conditional; it no-ops on a null draft.
  const fitState = usePlatformFit(draft);

  // Keyboard triage (B6.2 [+]): 'e' opens the editor (edit state lives
  // here); Escape cancels it — allowed even FROM the textarea, so the
  // typing guard applies only to opening.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && editing) {
        setEditing(false);
        return;
      }
      if (event.key !== "e" || event.ctrlKey || event.metaKey || event.altKey) return;
      if (busy || editing || isTypingTarget(event.target)) return;
      const editable = draft && (draft.status === "queued" || draft.status === "blocked");
      if (!editable || status !== "success") return;
      event.preventDefault();
      setEditedBody(draft.body);
      setEditing(true);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, editing, draft, status]);

  if (status !== "success" || !draft) {
    return (
      <section className="card" aria-label="Draft detail" style={CARD_STYLE}>
        <div className="draft-scroll" {...(status === "error" ? { role: "alert" as const } : {})}>
          {status === "idle" && <span className="t-label">Select a draft to review.</span>}
          {status === "loading" && <span className="t-label">Reading the draft…</span>}
          {status === "error" && (
            <>
              <p className="t-title">Couldn’t read this draft</p>
              <span className="t-label">
                This is a read failure, not a missing draft — nothing has been decided.
              </span>
            </>
          )}
        </div>
      </section>
    );
  }

  // approve/reject only leave `queued` (SPINE §1.1 state machine); an edit is legal from queued or blocked.
  const canApproveReject = draft.status === "queued";
  const canEdit = draft.status === "queued" || draft.status === "blocked";
  // Re-judge (unmodified retry) is legal from `blocked` (a real verdict the
  // operator wants retried as-is) and from `judging` (a draft an operational
  // halt — e.g. a budget cap, not a verdict — may have stranded there with no
  // other way back; see repos.drafts.reJudge).
  const canReJudge = draft.status === "blocked" || draft.status === "judging";
  // Publish (B6.7) = the own-site door: web_page only, approved only (the
  // engine re-checks both). The draft STAYS approved after — republish is
  // legal by design, so the button never disables on deploy state.
  const canPublish = draft.status === "approved" && draft.format === "web_page";

  const pill = statusPill(draft.status);
  const window_ = headWindow(draft);
  const thumb = thumbLabel(draft);
  const marks = checkMarks(draft, judgeResults);
  const blockingFail = marks.some((m) => !m.advisory && m.status === "fail");
  const anyPending = marks.some((m) => m.status === "pending");
  const composite = overallNote(draft, judgeResults);
  // A block must state its reason without a click — the receipt opens itself.
  const mustExplain = blockingFail || draft.status === "blocked";
  const version = versionStrip(draft, judgeResults);
  const judgeModel = judgeResults.find((r) => r.bodyHash === draft.bodyHash && r.model)?.model ?? null;
  const metaRecord =
    draft.meta && typeof draft.meta === "object" ? (draft.meta as Record<string, unknown>) : null;
  const captureId = typeof metaRecord?.captureId === "string" ? metaRecord.captureId : null;

  // The band's wash follows the VERDICT, never the sheet's happy case: a
  // blocking failure washes red, an undecided gate stays neutral.
  const checksBackground = blockingFail
    ? "var(--err-subtle)"
    : anyPending
      ? "var(--n-bg)"
      : "var(--ok-subtle)";

  function startEdit() {
    setEditedBody(draft!.body);
    setEditing(true);
  }

  function saveEdit() {
    onEditSave(editedBody);
    setEditing(false);
  }

  return (
    <section className="card" aria-label="Draft detail" style={CARD_STYLE}>
      <div className="card-head">
        <span className={pill.cls ? `pill ${pill.cls}` : "pill"}>{pill.word}</span>
        <span className="t-title">{`${platformLabel(draft.platform)} draft · ${formatWord(draft)}`}</span>
        {window_ && <span className="t-label">{window_}</span>}
        <div style={{ flex: 1 }} />
        {/* The sheet's Composer re-entry door, ARMED in s92 (B-create.4
            landed the route). It carries the draft's fanout id — the route
            resolves it to the create run that recorded it, and a run that
            predates Create lands on that fact in words, never a bare 404. */}
        <Link
          className="card-link"
          href={`/app/create/run/${encodeURIComponent(draft.fanoutRunId)}`}
          title="the run-scoped checkpoint — this draft's run in the Composer"
        >
          Open in Composer →
        </Link>
        <span className="t-data" title={`Deep link · draft ${draft.id}`}>
          #{draft.id.slice(0, 8)}
        </span>
      </div>
      <div className="draft-scroll">
        <div className="ver-strip">
          <span className="ver-dot" />
          <span>
            <b style={{ fontWeight: 600 }}>v1</b> · engine draft
          </span>
          {version.edited && (
            <>
              <span style={{ color: "var(--n-700)" }}>→</span>
              <span className="ver-dot" style={{ background: "var(--act)" }} />
              <span style={{ color: "var(--n-1000)" }}>
                <b style={{ fontWeight: 600 }}>v{version.current}</b> · edited by you ·{" "}
                {timeAgo(draft.updatedAt)}
              </span>
            </>
          )}
          {version.edited && (
            <>
              <span style={{ color: "var(--n-700)" }}>→</span>
              <span>
                {version.reJudged
                  ? `judge re-ran on v${version.current}`
                  : `no verdict yet on v${version.current}`}
              </span>
            </>
          )}
          <div style={{ flex: 1 }} />
          {/* The edit itself is recorded server-side (edit_diffs), but no read
              exposes the prior body — the slot states that rather than
              offering a door that opens onto nothing. */}
          <span className="t-data" title="Edits are recorded server-side (edit_diffs); no read exposes the prior body yet.">
            diff not on the wire
          </span>
        </div>

        <div style={{ display: "flex", gap: 16 }}>
          {thumb && (
            <div className="thumb-md" style={{ width: 200, height: 112 }}>
              <span>{thumb}</span>
            </div>
          )}
          {editing ? (
            <textarea
              aria-label="Edit draft body"
              className="draft-editor"
              style={{ flex: 1 }}
              value={editedBody}
              onChange={(e) => setEditedBody(e.target.value)}
            />
          ) : (
            <div className="draft-body" style={{ flex: 1 }}>
              {draft.body.split("\n\n").map((para, i) => (
                <p key={i} style={{ whiteSpace: "pre-wrap" }}>
                  {para}
                </p>
              ))}
            </div>
          )}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
            padding: "12px 14px",
            background: checksBackground,
            borderRadius: 8,
          }}
        >
          {marks.map((mark) => (
            <span
              key={mark.gate}
              className={`check${mark.status === "pass" ? "" : mark.advisory ? " check-warn" : " check-err"}`}
              title={mark.title}
            >
              <span className="ck">{checkGlyph(mark)}</span>
              {mark.label}
            </span>
          ))}
          <div style={{ flex: 1 }} />
          {/* A forced-open receipt has nothing to toggle, so the door is the
              sheet's own plain span there — never a button that claims to
              collapse a panel it cannot. */}
          {mustExplain ? (
            <span className="t-label">reasons on record →</span>
          ) : (
            <button
              type="button"
              className="t-label as-text-btn"
              aria-expanded={reasonsOpen}
              onClick={() => setReasonsOpen((open) => !open)}
            >
              reasons on record →
            </button>
          )}
        </div>

        {/* The judge-verdict provenance keeper: per-gate verdicts with the
            recorded reasons VERBATIM, never paraphrased. A blocking failure
            opens it without a click — a block must state its reason. */}
        {(reasonsOpen || mustExplain) && (
          <div className="reasons-panel" role="group" aria-label="Judge verdicts">
            <span className="t-label">judge verdicts — reasons verbatim, never paraphrased</span>
            {marks.map((mark) => (
              <div key={mark.gate} className="reason-row">
                <span
                  className="reason-mark"
                  aria-hidden
                  style={{
                    color:
                      mark.status === "pass"
                        ? "var(--ok)"
                        : mark.status === "pending"
                          ? "var(--n-800)"
                          : mark.advisory
                            ? "var(--warn)"
                            : "var(--err)",
                  }}
                >
                  {checkGlyph(mark)}
                </span>
                {/* The gate NAME comes from the gate, never from string
                    surgery on the label. `checkLabel` already distinguishes
                    "Grounding — screen" from "Grounding — final", and
                    splitting on " — " collapsed both to "Grounding" — the
                    two rows that can DISAGREE, rendered indistinguishable
                    directly above the composite note explaining that they
                    disagreed (live s79, a real blocked draft). */}
                <span className="reason-gate">{checkLabel(mark.gate)}</span>
                <span className="reason-lines">{mark.lines.join(" · ")}</span>
              </div>
            ))}
            {composite && <span className="t-label">{composite}</span>}
          </div>
        )}

        {/* The FIT line (C1 wiring #2) — the judge's sibling, and its own
            line rather than a mark in the checks band: the judge gates what
            a post CLAIMS, this gates whether it FITS, and blurring them
            would put a platform's character ceiling among the grounding
            verdicts. Absent for a format with no capability row. */}
        <FitLine
          state={fitState}
          previewOpen={previewOpen}
          onTogglePreview={() => setPreviewOpen((open) => !open)}
        />
        {previewOpen && fitState.fit?.supported && <PlatformPreview fit={fitState.fit.fit} />}

        <FormatDetail draft={draft} />

        <div className="src-line">
          {captureId && (
            <>
              <span>From</span>
              <span className="t-data" title="the intel capture that seeded this run">
                capture #{captureId.slice(0, 8)}
              </span>
              <span>·</span>
            </>
          )}
          <span>{`run ${formatStamp(run?.createdAt ?? draft.createdAt)}`}</span>
          {run && (
            <>
              <span>·</span>
              <span>{`profile v${run.brandProfileVersion}`}</span>
              <span>·</span>
              <span>{`drafted ${run.model}${judgeModel ? ` · judged ${judgeModel}` : ""}`}</span>
            </>
          )}
          <span>·</span>
          <span style={{ color: "var(--n-800)" }}>the judge gates — it never rewrites</span>
          {run && !run.draftsComplete && (
            <>
              <span>·</span>
              <span style={{ color: "var(--warn)" }}>
                this run is incomplete — fewer drafts than the platforms it requested
              </span>
            </>
          )}
        </div>

        {actionError && (
          <p className="t-label" style={{ color: "var(--err)" }} role="alert">
            {actionError}
          </p>
        )}
      </div>

      {/* The commitment band (C2/C4): present ONLY when this draft has a
          commitment to show or make. A queued or blocked draft — the Approve
          queue's main case — renders nothing here, so the sheet's resting
          footer is unchanged. */}
      <ScheduleControl draft={draft} state={fitState} disabled={busy || editing} />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "14px 24px",
          borderTop: "1px solid var(--n-400)",
        }}
      >
        {editing ? (
          <>
            <button type="button" className="btn btn-primary" onClick={saveEdit} disabled={busy}>
              Save edit
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setEditing(false)} disabled={busy}>
              Cancel
            </button>
            <span className="t-label" style={{ marginLeft: 6 }}>
              the judge re-runs on the new body
            </span>
          </>
        ) : (
          <>
            {/* The W1 grammar (Plain): every verb carries its key INLINE on
                the control — the footer legend orients, the button itself
                teaches. */}
            {/* The inline key hint is visual (aria-hidden) so the button's
                accessible name stays the verb; the shortcut reaches AT via
                aria-keyshortcuts instead. */}
            {canApproveReject && (
              <button
                type="button"
                className="btn btn-primary"
                aria-keyshortcuts="a"
                onClick={onApprove}
                disabled={busy}
              >
                Approve
                <span className="kbd" aria-hidden>
                  a
                </span>
              </button>
            )}
            {canEdit && (
              <button
                type="button"
                className="btn btn-ghost"
                aria-keyshortcuts="e"
                onClick={startEdit}
                disabled={busy}
              >
                Edit
                <span className="kbd" aria-hidden>
                  e
                </span>
              </button>
            )}
            {canReJudge && (
              <button type="button" className="btn btn-ghost" onClick={onReJudge} disabled={busy}>
                Re-judge
              </button>
            )}
            {canPublish && (
              <button type="button" className="btn btn-primary" onClick={onPublish} disabled={busy}>
                Publish to site
              </button>
            )}
            {/* Approval is the moment a draft BECOMES plannable, so the door to
                planning belongs here as well as on the calendar (founder s78:
                "shouldnt plan be in the calendar and Create section or
                something?" — Create is too early; the draft does not exist yet
                and may never pass the judge). Planning writes a slot only. */}
            {draft.status === "approved" && (
              <Link className="btn btn-ghost" href={`/app/schedule?plan=${draft.id}`}>
                Plan a slot →
              </Link>
            )}
            <span className="t-label" style={{ marginLeft: 6 }}>
              {canApproveReject
                ? "recorded — nothing publishes until the door arms"
                : draft.status === "blocked"
                  ? "approve is absent while any check fails — the gate fails closed; edit and the judge re-runs"
                  : draft.status === "judging"
                    ? "no passing verdict yet for this body — re-judge retries it unmodified"
                    : "recorded — nothing publishes until the door arms"}
            </span>
            <div style={{ flex: 1 }} />
            {canApproveReject && (
              <button
                type="button"
                className="btn btn-danger"
                // The sheet says "reason required"; the seat's own semantics
                // are richer — a stated reason becomes the eval row, a blank
                // one is a bare decision. The title tells the truth.
                title="asks for your reason — it becomes the eval row; blank rejects without one"
                aria-keyshortcuts="r"
                onClick={onReject}
                disabled={busy}
              >
                Reject…
                <span className="kbd" aria-hidden>
                  r
                </span>
              </button>
            )}
          </>
        )}
      </div>
    </section>
  );
}
