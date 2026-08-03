"use client";

import "@/components/composer/composer.css";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { checkMarks, targetTerms } from "@/components/approve/approve-model";
import { fetchDraftFit, type FitResponse } from "@/components/approve/queue-client";
import {
  composerHeadline,
  composerTabs,
  discoverability,
  fieldLabel,
  firstMediaKind,
  fitWords,
  hasFirstComment,
  hitTerm,
  markBody,
  moreSettingsFields,
  previewActions,
  provenanceParts,
  sendToApproveHref,
  wouldBlockCount,
} from "@/components/composer/composer-model";
import {
  editDraft,
  fetchDraftDetail,
  reJudgeDraft,
} from "@/lib/approve-queue/client";
import type { DraftDetail, GridDraft } from "@/lib/approve-queue/types";
import type { JudgeResultWithEvidence } from "@/lib/approve-queue/judge-reasons";
import { fetchCreateRun, type CreateRunWire } from "@/lib/create/client";
import { platformLabel } from "@/lib/workspace/format";

type ReadState = "loading" | "error" | "success";

interface AiEditState {
  open: boolean;
  instruction: string;
  busy: boolean;
  /** The engine's refusal, VERBATIM — shown at the control, never swallowed. */
  refusal: string | null;
  proposal: {
    instruction: string;
    priorBody: string;
    priorBodyHash: string;
    proposedBody: string;
  } | null;
}

const AI_EDIT_IDLE: AiEditState = {
  open: false,
  instruction: "",
  busy: false,
  refusal: null,
  proposal: null,
};

/**
 * The Composer — the run-scoped checkpoint between Generate and Approve
 * (B-create.4, exact-mock from Composer.dc.html, the s90c iteration).
 * Founder's zoning holds: WRITE left · SEE middle · KNOBS right, the five
 * destinations one full-width band below. Every zone names its job; nothing
 * here publishes; the judge gates — it never rewrites. Edits (hand or AI)
 * re-judge before a variant can leave.
 */
/** The judge-detail read, honest in all three eras — reading · failed · read. */
type DetailRead =
  | { state: "reading" }
  | { state: "failed" }
  | { state: "read"; detail: DraftDetail };

export function ComposerSurface({ runId }: { runId: string }) {
  const [status, setStatus] = useState<ReadState>("loading");
  const [run, setRun] = useState<CreateRunWire | null>(null);
  const [drafts, setDrafts] = useState<GridDraft[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [fits, setFits] = useState<Record<string, FitResponse | null>>({});
  const [detail, setDetail] = useState<DetailRead>({ state: "reading" });
  const [editing, setEditing] = useState(false);
  const [editedBody, setEditedBody] = useState("");
  const [verbBusy, setVerbBusy] = useState<"save" | "rejudge" | null>(null);
  /** A verb's failure, in its own words, at the header where the verb lives. */
  const [verbError, setVerbError] = useState<string | null>(null);
  const [aiEdit, setAiEdit] = useState<AiEditState>(AI_EDIT_IDLE);
  const [moreOpen, setMoreOpen] = useState(false);

  /** The read failure's own words (the 404 carries "predates Create" honesty). */
  const [readError, setReadError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      const payload = await fetchCreateRun(runId);
      setRun(payload.run);
      setDrafts(payload.drafts);
      setActiveId((current) => current ?? payload.drafts[0]?.id ?? null);
      setStatus("success");
    } catch (err) {
      setReadError(err instanceof Error ? err.message : null);
      setStatus("error");
    }
  }, [runId]);

  useEffect(() => {
    // The async wrapper keeps the setState chain out of the effect's own
    // body (react-hooks/set-state-in-effect — the B1.4 lesson).
    void Promise.resolve().then(load);
  }, [load]);

  const active = drafts.find((d) => d.id === activeId) ?? null;

  // The fit band measures EVERY variant against its own platform — re-read
  // per body (an edit mints a new bodyHash; a fit line describing the old
  // body under the new one is the stale-derivation defect, s82 discipline).
  const fitKey = drafts.map((d) => `${d.id}:${d.bodyHash}`).join("|");
  useEffect(() => {
    if (drafts.length === 0) return;
    let cancelled = false;
    for (const draft of drafts) {
      fetchDraftFit(draft.id)
        .then((fit) => {
          if (!cancelled) setFits((prev) => ({ ...prev, [draft.id]: fit }));
        })
        .catch(() => {
          /* the line renders its unmeasured state */
        });
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fitKey encodes drafts+bodies
  }, [fitKey]);

  // The judge detail rides the ACTIVE tab only (lazy) — same per-body rule.
  const activeHash = active?.bodyHash ?? null;
  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;
    // Reset + fetch ride one promise chain (the B1.4 wrapper): the strip
    // says "reading" for the NEW tab rather than showing the old verdicts.
    Promise.resolve()
      .then(() => {
        if (!cancelled) setDetail({ state: "reading" });
      })
      .then(() => fetchDraftDetail(activeId))
      .then((d) => {
        // A 404 on a draft the grid lists IS a failed read, not a quiet null.
        if (!cancelled) setDetail(d === null ? { state: "failed" } : { state: "read", detail: d });
      })
      .catch(() => {
        // A failed read NAMES itself — an eternal "reading…" is a lie (s98).
        if (!cancelled) setDetail({ state: "failed" });
      });
    return () => {
      cancelled = true;
    };
  }, [activeId, activeHash]);

  const refreshDraft = (draft: GridDraft) => {
    setDrafts((prev) => prev.map((d) => (d.id === draft.id ? draft : d)));
  };

  const saveEdit = async () => {
    if (!active || editedBody.trim() === "" || editedBody === active.body) return;
    setVerbBusy("save");
    setVerbError(null);
    try {
      const result = await editDraft(active.id, editedBody);
      refreshDraft(result.draft);
      setEditing(false);
    } catch (err) {
      setVerbError(err instanceof Error ? err.message : "the edit failed");
    } finally {
      setVerbBusy(null);
    }
  };

  const rejudge = async () => {
    if (!active) return;
    setVerbBusy("rejudge");
    setVerbError(null);
    try {
      const result = await reJudgeDraft(active.id);
      refreshDraft(result.draft);
    } catch (err) {
      setVerbError(err instanceof Error ? err.message : "the re-judge failed");
    } finally {
      setVerbBusy(null);
    }
  };

  const proposeAiEdit = async () => {
    if (!active || aiEdit.instruction.trim() === "") return;
    setAiEdit((s) => ({ ...s, busy: true, refusal: null }));
    try {
      const res = await fetch(`/api/drafts/${encodeURIComponent(active.id)}/ai-edit`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ instruction: aiEdit.instruction }),
      });
      const body = (await res.json()) as
        | { status: "proposed"; proposal: AiEditState["proposal"] }
        | { status: "refused"; reason: string }
        | { error: string };
      if ("error" in body) {
        setAiEdit((s) => ({ ...s, busy: false, refusal: body.error }));
      } else if (body.status === "refused") {
        setAiEdit((s) => ({ ...s, busy: false, refusal: body.reason }));
      } else {
        setAiEdit((s) => ({ ...s, busy: false, proposal: body.proposal }));
      }
    } catch {
      setAiEdit((s) => ({ ...s, busy: false, refusal: "the propose call failed — try again" }));
    }
  };

  const applyAiEdit = async () => {
    if (!active || !aiEdit.proposal) return;
    setAiEdit((s) => ({ ...s, busy: true, refusal: null }));
    try {
      const res = await fetch(`/api/drafts/${encodeURIComponent(active.id)}/ai-edit/apply`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ proposal: aiEdit.proposal, runId }),
      });
      const body = (await res.json()) as
        | { status: "queued" | "blocked"; draft: GridDraft }
        | { status: "refused"; reason: string }
        | { error: string };
      if ("error" in body) {
        setAiEdit((s) => ({ ...s, busy: false, refusal: body.error }));
      } else if (body.status === "refused") {
        setAiEdit((s) => ({ ...s, busy: false, refusal: body.reason }));
      } else {
        refreshDraft(body.draft);
        setAiEdit(AI_EDIT_IDLE);
      }
    } catch {
      setAiEdit((s) => ({ ...s, busy: false, refusal: "the apply call failed — try again" }));
    }
  };

  if (status === "error") {
    return (
      <div className="content composer-surface">
        <div className="card read-error" role="alert" style={{ padding: "12px 16px" }}>
          <span className="t-label">
            {readError ?? "Couldn’t read this run — a read failure, not an empty run."}{" "}
            <button type="button" className="bare cmp-retry" onClick={() => void load()}>
              try again
            </button>{" "}
            <Link className="card-link" href="/app/approve">
              back to Approve →
            </Link>
          </span>
        </div>
      </div>
    );
  }
  if (status === "loading" || !run) {
    return (
      <div className="content composer-surface">
        <span className="t-label">Reading the run…</span>
      </div>
    );
  }

  const tabs = composerTabs(drafts, fits);
  const blocked = wouldBlockCount(drafts);
  const provenance = provenanceParts(run, active);

  return (
    <div className="content composer-surface" style={{ gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Link className="t-label" href="/app/create" style={{ color: "inherit" }}>
          Create ›
        </Link>
        <h1 className="t-headline">{composerHeadline(run, drafts.length)}</h1>
        {blocked > 0 && <span className="pill pill-warn">would block · {blocked}</span>}
        <div style={{ flex: 1 }} />
        {verbError && (
          <span className="t-label cmp-verb-err" role="alert">
            {verbError}
          </span>
        )}
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          disabled={!editing || verbBusy !== null}
          title={editing ? "apply your edit — it re-judges before it can leave" : "edit the body first — nothing to save"}
          onClick={() => void saveEdit()}
        >
          {verbBusy === "save" ? "Saving…" : "Save draft"}
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          disabled={!active || verbBusy !== null}
          title="re-run the judge on the unmodified body"
          onClick={() => void rejudge()}
        >
          {verbBusy === "rejudge" ? "Re-judging…" : "Re-judge"}
        </button>
        <Link className="btn btn-primary btn-sm" href={sendToApproveHref(run)}>
          Send to Approve
        </Link>
      </div>

      <div className="src-line">
        <span>The checkpoint before Approve — nothing publishes from here.</span>
        {provenance.map((part, i) => (
          <span key={i} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
            <span style={{ color: "var(--n-600)" }}>{i === 0 ? "|" : "·"}</span>
            {part.href ? <Link href={part.href}>{part.text}</Link> : <span>{part.text}</span>}
          </span>
        ))}
      </div>

      {drafts.length === 0 ? (
        <div className="card" style={{ padding: "12px 16px" }}>
          <span className="t-label">
            This run recorded no drafts
            {run.lastError ? ` — ${run.lastError}` : " — its children may still be generating."}
          </span>
        </div>
      ) : (
        <>
          <div className="cmp-grid">
            <LeftColumn
              active={active}
              detail={detail}
              editing={editing}
              editedBody={editedBody}
              onStartEdit={() => {
                if (!active) return;
                setEditedBody(active.body);
                setEditing(true);
              }}
              onChangeBody={setEditedBody}
              aiEdit={aiEdit}
              onAiEdit={setAiEdit}
              onPropose={() => void proposeAiEdit()}
              onApply={() => void applyAiEdit()}
            />
            <MiddleColumn
              tabs={tabs}
              activeId={activeId}
              onSelect={(id) => {
                setActiveId(id);
                setEditing(false);
                setAiEdit(AI_EDIT_IDLE);
                setMoreOpen(false);
              }}
              active={active}
              fit={active ? (fits[active.id] ?? null) : null}
            />
            <RightColumn
              active={active}
              fit={active ? (fits[active.id] ?? null) : null}
              moreOpen={moreOpen}
              onToggleMore={() => setMoreOpen((v) => !v)}
            />
          </div>

          <span className="zlabel">EVERY DESTINATION AT A GLANCE — FIT + REFUSALS</span>
          <div className="fitband" style={{ gridTemplateColumns: `repeat(${drafts.length}, 1fr)` }}>
            {drafts.map((draft) => {
              const words = fitWords(fits[draft.id] ?? null);
              return (
                <div key={draft.id} className={`fitline fitline-${words.tone}`}>
                  <div className="fit-top">
                    <span className={`fit-count fit-count-${words.tone}`}>{words.count}</span>
                    <div style={{ flex: 1 }} />
                    <span className="t-data">{platformLabel(draft.platform)}</span>
                  </div>
                  <span className={`fit-why fit-why-${words.tone}`}>{words.why}</span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function LeftColumn({
  active,
  detail,
  editing,
  editedBody,
  onStartEdit,
  onChangeBody,
  aiEdit,
  onAiEdit,
  onPropose,
  onApply,
}: {
  active: GridDraft | null;
  detail: DetailRead;
  editing: boolean;
  editedBody: string;
  onStartEdit: () => void;
  onChangeBody: (body: string) => void;
  aiEdit: AiEditState;
  onAiEdit: (next: AiEditState) => void;
  onPropose: () => void;
  onApply: () => void;
}) {
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    if (editing) bodyRef.current?.focus();
  }, [editing]);

  const results = (detail.state === "read"
    ? detail.detail.judgeResults
    : []) as unknown as JudgeResultWithEvidence[];
  const marks = active ? checkMarks(active, results) : [];
  const failing = marks.find((m) => m.status === "fail" && !m.advisory);
  const term = active?.status === "blocked" ? hitTerm(failing?.label) : null;
  const marked = active && !editing ? markBody(active.body, term) : null;

  return (
    <div className="cmp-left">
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span className="zlabel">YOUR WORDS — EDITS RE-JUDGE</span>
        <div style={{ flex: 1 }} />
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          disabled={!active}
          title="describe the change — the engine proposes, the judge re-checks, you apply · a refused proposal never touches your text"
          onClick={() => onAiEdit({ ...AI_EDIT_IDLE, open: !aiEdit.open })}
        >
          AI edit…
        </button>
      </div>

      {aiEdit.open && active && (
        <div className="ai-box">
          {aiEdit.proposal === null ? (
            <>
              <textarea
                className="ai-input"
                placeholder="describe the change — e.g. tighten the middle, keep the claim grounded"
                value={aiEdit.instruction}
                onChange={(e) => onAiEdit({ ...aiEdit, instruction: e.target.value })}
              />
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={aiEdit.busy || aiEdit.instruction.trim() === ""}
                  onClick={onPropose}
                >
                  {aiEdit.busy ? "Proposing…" : "Propose"}
                </button>
                <span className="t-label" style={{ fontSize: 11 }}>
                  propose → judge → apply — it never lands unjudged
                </span>
              </div>
            </>
          ) : (
            <>
              <span className="t-label" style={{ fontSize: 11 }}>
                the proposed body — your text is untouched until you apply
              </span>
              <div className="ai-proposal">{aiEdit.proposal.proposedBody}</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" className="btn btn-primary btn-sm" disabled={aiEdit.busy} onClick={onApply}>
                  {aiEdit.busy ? "Applying…" : "Apply — re-judges"}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={aiEdit.busy}
                  onClick={() => onAiEdit(AI_EDIT_IDLE)}
                >
                  Discard
                </button>
              </div>
            </>
          )}
          {aiEdit.refusal && (
            <span className="t-label cmp-verb-err" role="alert">
              refused: {aiEdit.refusal}
            </span>
          )}
        </div>
      )}

      {active === null ? (
        <div className="body-box">
          <span className="t-label">No draft selected.</span>
        </div>
      ) : editing ? (
        <textarea
          ref={bodyRef}
          className="body-box body-edit"
          value={editedBody}
          onChange={(e) => onChangeBody(e.target.value)}
          aria-label="Draft body"
        />
      ) : (
        // Resting = the marked read view (the judge's hit IN the body);
        // click to edit in place — Save re-judges.
        <div
          className="body-box body-read"
          role="button"
          tabIndex={0}
          title="click to edit — edits re-judge"
          onClick={onStartEdit}
          onKeyDown={(e) => {
            if (e.key === "Enter") onStartEdit();
          }}
        >
          {marked ? (
            <>
              {marked[0]}
              <span className="hit">{marked[1]}</span>
              {marked[2]}
            </>
          ) : (
            active.body
          )}
        </div>
      )}

      {active && (
        <div className="jstrip">
          <div className="jstrip-top">
            {active.status === "blocked" ? (
              <span className="pill pill-err">would block</span>
            ) : active.status === "judging" ? (
              <span className="pill pill-idle">at the judge</span>
            ) : (
              <span className="pill pill-ok">passes</span>
            )}
            <span style={{ fontSize: "12.5px" }}>
              {active.status === "blocked"
                ? (failing?.label ?? "blocked — the judge’s reason is on the record")
                : active.status === "judging"
                  ? "gates running on the current body"
                  : "queued for Approve — the human gate is next"}
              {term && marked ? " — marked in the body" : ""}
            </span>
          </div>
          <div className="jstrip-facts">
            {detail.state === "reading" ? (
              <span>reading the verdicts…</span>
            ) : detail.state === "failed" ? (
              <span role="alert">couldn’t read the verdicts — the record is on Approve</span>
            ) : (
              // Hard fails FIRST, wearing ✗ — the gate that blocks is the one
              // fact this strip must never drop (s98 dogfood: "would block"
              // over a row of ✓ marks named every gate but the failing one).
              [...marks]
                .sort(
                  (a, b) =>
                    Number(b.status === "fail" && !b.advisory) -
                    Number(a.status === "fail" && !a.advisory),
                )
                .slice(0, 3)
                .map((m) => {
                  const hardFail = m.status === "fail" && !m.advisory;
                  return (
                    <span key={m.gate} title={m.title}>
                      <span
                        style={{
                          color: hardFail
                            ? "var(--err)"
                            : m.status === "pass"
                              ? "var(--ok)"
                              : "var(--n-800)",
                        }}
                      >
                        {hardFail ? "✗" : m.status === "pass" ? "✓" : "·"}
                      </span>{" "}
                      {/* The bare gate word — the strip's top row states the failing line. */}
                      {hardFail ? m.word : m.label}
                    </span>
                  );
                })
            )}
            <span className="t-label" style={{ fontSize: 11 }}>
              it gates — it never rewrites
            </span>
            <div style={{ flex: 1 }} />
            <Link
              className="card-link"
              style={{ fontSize: "11.5px" }}
              href={`/app/approve?run=${encodeURIComponent(active.fanoutRunId)}&draft=${encodeURIComponent(active.id)}`}
            >
              details ▸
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function MiddleColumn({
  tabs,
  activeId,
  onSelect,
  active,
  fit,
}: {
  tabs: ReturnType<typeof composerTabs>;
  activeId: string | null;
  onSelect: (id: string) => void;
  active: GridDraft | null;
  fit: FitResponse | null;
}) {
  const cut =
    fit && fit.supported && fit.fit.text.cutIndex < (active?.body.length ?? 0)
      ? fit.fit.text.cutIndex
      : null;
  const hashtags = fit && fit.supported ? fit.fit.text.hashtags : [];
  const media = active ? firstMediaKind(active) : null;
  const actions = active ? previewActions(active.platform) : [];

  return (
    <div className="cmp-mid">
      <div className="ptabs" role="tablist" aria-label="Destinations">
        {tabs.map((tab) => (
          <button
            key={tab.draftId}
            type="button"
            role="tab"
            aria-selected={tab.draftId === activeId}
            className={tab.draftId === activeId ? "ptab on" : "ptab"}
            onClick={() => onSelect(tab.draftId)}
          >
            <span className={`dot dot-${tab.dot}`} />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="card" style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
        <div className="card-head">
          <span className="t-title">Preview · {active ? platformLabel(active.platform) : "—"}</span>
          <div style={{ flex: 1 }} />
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            aria-disabled="true"
            title="true platform width lives in the popout — drawn for pass 3, not built yet"
          >
            Expand
          </button>
        </div>
        <div style={{ padding: "11px 13px 12px", display: "flex", flexDirection: "column", gap: 8, minHeight: 0, overflowY: "auto" }}>
          {active === null ? (
            <span className="t-label">No draft selected.</span>
          ) : (
            <>
              <div className="pv">
                <div className="pv-head">
                  <div className="pv-av" />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: "12.5px", fontWeight: 600 }}>Your page</div>
                    <div className="t-data">now</div>
                  </div>
                </div>
                <div className="pv-body">
                  {cut !== null ? (
                    <>
                      {active.body.slice(0, cut)}
                      <span className="pv-fade"> — …</span>
                    </>
                  ) : (
                    active.body
                  )}
                </div>
                {cut !== null && (
                  <div className="pv-cut">
                    <span className="t-label" style={{ fontSize: 11, color: "var(--warn)" }}>
                      …see more
                    </span>
                    <span className="t-label" style={{ fontSize: "10.5px" }}>
                      feed cuts here · {cut} characters
                    </span>
                  </div>
                )}
                {hashtags.length > 0 && (
                  <div style={{ fontSize: "12.5px", lineHeight: 1.5 }}>
                    {hashtags.map((tag) => (
                      <span key={tag} className="tag">
                        {tag.startsWith("#") ? tag : `#${tag}`}{" "}
                      </span>
                    ))}
                  </div>
                )}
                {media !== null && (
                  <div className="pv-media" style={{ height: 186 }}>
                    <span>{media === "video" ? "video — the run’s cut" : `${media} — as attached`}</span>
                  </div>
                )}
                {actions.length > 0 && (
                  <div className="pv-actions">
                    {actions.map((verb) => (
                      <span key={verb} className="pv-act">
                        {verb}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <span className="t-label" style={{ fontSize: 11 }}>
                Documented platform rules, not a live render — close, not exact.
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function RightColumn({
  active,
  fit,
  moreOpen,
  onToggleMore,
}: {
  active: GridDraft | null;
  fit: FitResponse | null;
  moreOpen: boolean;
  onToggleMore: () => void;
}) {
  const media = active ? firstMediaKind(active) : null;
  const more = active ? moreSettingsFields(active.platform) : [];
  const terms = active ? targetTerms(active) : [];
  const disc = active ? discoverability(terms, active.body) : null;
  const suggested =
    fit && fit.supported && fit.suggestedAt
      ? new Date(fit.suggestedAt)
      : null;

  return (
    <div className="cmp-right">
      <span className="zlabel">THIS DESTINATION&apos;S SETTINGS</span>
      <div className="band">
        <div className="fld">
          <dt>Media</dt>
          <dd>
            {media !== null ? (
              <>
                <div className="thumb-sm">
                  <span>{media}</span>
                </div>
                <span className="t-label" style={{ fontSize: 11 }}>
                  tools land with the media pass — attached as generated
                </span>
              </>
            ) : (
              <span className="t-label" style={{ fontSize: 11 }}>
                no media on this variant
              </span>
            )}
          </dd>
        </div>
        {media === "video" && (
          <div className="fld">
            <dt>Cover frame</dt>
            <dd>
              <span className="t-label" style={{ fontSize: 11 }}>
                frames need the render’s stills — not on this wire yet
              </span>
            </dd>
          </div>
        )}
        {active && hasFirstComment(active.platform) && (
          <div className="fld">
            <dt>First comment</dt>
            <dd>
              <span className="toggle off" aria-disabled="true" title="arms with the queue’s settings seat — not wired yet" />
              <span className="t-label" style={{ fontSize: 11 }}>
                off — set at scheduling
              </span>
            </dd>
          </div>
        )}
        {more.length > 0 && (
          <div className="fld fld-more">
            <dd style={{ width: "100%" }}>
              <button type="button" className="bare more-row" onClick={onToggleMore}>
                More settings<span className="t-data"> · {more.length}</span>
                <div style={{ flex: 1 }} />
                <span style={{ fontSize: 10 }}>{moreOpen ? "▴" : "▾"}</span>
              </button>
              <span className="t-label" style={{ fontSize: "10.5px" }}>
                {moreOpen
                  ? more.map(fieldLabel).join(" · ")
                  : "set once, rarely touched"}
              </span>
            </dd>
          </div>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 2px" }}>
        <span className="t-label" style={{ fontSize: 11 }}>
          generated from this platform&apos;s schema
        </span>
        <span
          className="info"
          title="each platform declares its own settings — a video destination declares more (YouTube: title · thumbnail · made-for-kids; TikTok: privacy · duet · stitch), on their own tabs"
        >
          i
        </span>
      </div>

      <span className="zlabel" style={{ marginTop: 2 }}>
        HOW IT SHOULD DO
      </span>
      <div className="band">
        <div className="fld">
          <dt>Discoverability</dt>
          <dd>
            {disc === null ? (
              <span className="t-label" style={{ fontSize: 11 }}>
                no target terms on this draft — generation declares them
              </span>
            ) : (
              <>
                <span
                  className={disc.missing ? "pill pill-warn" : "pill pill-ok"}
                  style={{ flexShrink: 0 }}
                >
                  {disc.have} of {disc.total}
                </span>
                <span style={{ fontSize: 12, color: "var(--n-900)" }}>
                  {disc.missing
                    ? `“${disc.missing}” not in the body — warns, never blocks`
                    : "every target term is in the body"}
                </span>
              </>
            )}
          </dd>
        </div>
        <div className="fld">
          <dt>Posting slot</dt>
          <dd>
            {suggested ? (
              <>
                <span style={{ fontSize: "12.5px" }}>
                  {new Intl.DateTimeFormat("en-GB", {
                    weekday: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  }).format(suggested)}{" "}
                  suggested
                </span>
                <span className="t-label" style={{ fontSize: 11 }}>
                  · from your own rhythm — Approve plans it
                </span>
              </>
            ) : (
              <span className="t-label" style={{ fontSize: 11 }}>
                no slot yet — approve, then plan
              </span>
            )}
          </dd>
        </div>
        <div className="fld">
          <dt>Trend forecast</dt>
          <dd>
            <span className="t-label" style={{ fontSize: 11 }}>
              joins when Analytics has real history — nothing invented before that{" "}
              <span
                className="info"
                style={{ verticalAlign: -3 }}
                title="A forecast needs measured posts. The analytics loop records how every published post actually does; once that history exists, this row predicts from it. Until then a number here would be fiction — honesty beats polish."
              >
                i
              </span>
            </span>
          </dd>
        </div>
      </div>
    </div>
  );
}
