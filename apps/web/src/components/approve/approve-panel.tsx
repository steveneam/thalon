"use client";

import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormatDetail } from "@/components/approve/format-detail";
import { JudgeVerdicts } from "@/components/approve/judge-verdicts";
import { queueStatusWord } from "@/components/approve/queue-list";
import { isTypingTarget } from "@/lib/workspace/keyboard";
import { cn } from "@/lib/utils";
import type { FeedRun, GridDraft, PanelJudgeResult } from "@/lib/approve-queue/types";

export type PanelStatus = "idle" | "loading" | "error" | "success";

interface ApprovePanelProps {
  status: PanelStatus;
  draft: GridDraft | null;
  /** The run behind the draft — the lineage anchor and the profile/model seats. */
  run: FeedRun | null;
  judgeResults: PanelJudgeResult[];
  busy?: boolean;
  /** Message from the last approve/reject/edit/re-judge attempt, if it failed — e.g. a judge run that threw (no gateway key, a budget halt). Null/undefined once an attempt succeeds. */
  actionError?: string | null;
  onApprove: () => void;
  /** The parent owns the named confirm — the button and the `r` key share it. */
  onReject: () => void;
  onEditSave: (editedBody: string) => void;
  onReJudge: () => void;
  onPublish: () => void;
  /** Narrow screens: the detail is the full surface — this is the way back to the list. */
  onBack: () => void;
}

/** Mono chip-link — the lineage nodes and the ?draft= deep link share one dress. */
function LineageNode({ href, children, title }: { href?: string; children: React.ReactNode; title?: string }) {
  const className =
    "inline-flex h-6 items-center gap-1 rounded-md border border-border bg-background px-2 font-mono text-2xs text-accent-foreground";
  if (!href) {
    return (
      <span title={title} className={cn(className, "border-dashed text-muted-foreground")}>
        {children}
      </span>
    );
  }
  return (
    <a href={href} title={title} className={cn(className, "hover:bg-accent")}>
      {children}
    </a>
  );
}

/**
 * The detail pane as INFORMED CONSENT (Phase I — the s59 "Approve Consent"
 * design): before the operator commits a verdict they can see where the
 * draft came from (lineage, every recorded node a link), who shaped it
 * (profile + model seats), and exactly what the judge decided and why
 * (verbatim, positive case included). The approve button is a sentence that
 * states its consequence; while any check fails, approve is simply ABSENT —
 * the gate fails closed, and the UI says so instead of graying a mystery
 * button.
 */
export function ApprovePanel({
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
  onBack,
}: ApprovePanelProps) {
  const [editing, setEditing] = useState(false);
  const [editedBody, setEditedBody] = useState("");

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
      <section aria-label="Draft detail" className="flex min-h-0 flex-col gap-2 p-4">
        {status === "idle" && <p className="text-sm text-muted-foreground">Select a draft to review.</p>}
        {status === "loading" && <p className="text-sm text-muted-foreground">Loading draft…</p>}
        {status === "error" && <p className="text-sm text-destructive">Couldn&rsquo;t load this draft.</p>}
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

  const st = queueStatusWord(draft.status);
  const judgeModel = judgeResults.find((r) => r.bodyHash === draft.bodyHash && r.model)?.model ?? null;
  const metaRecord =
    draft.meta && typeof draft.meta === "object" ? (draft.meta as Record<string, unknown>) : null;
  const captureId = typeof metaRecord?.captureId === "string" ? metaRecord.captureId : null;

  function startEdit() {
    setEditedBody(draft!.body);
    setEditing(true);
  }

  function saveEdit() {
    onEditSave(editedBody);
    setEditing(false);
  }

  return (
    <section aria-label="Draft detail" className="flex min-h-0 flex-col gap-3.5 overflow-y-auto p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" className="md:hidden" onClick={onBack}>
          <ArrowLeft aria-hidden data-icon="inline-start" />
          Queue
        </Button>
        <span
          className={cn(
            "rounded-full px-1.5 py-px font-mono text-2xs tracking-wider uppercase",
            st.signal ? "bg-signal text-signal-foreground" : "bg-muted text-foreground",
          )}
        >
          {st.word}
        </span>
        <h2 className="min-w-48 flex-1 text-sm font-semibold">{draft.platform} draft</h2>
        <LineageNode href={`/app/approve?draft=${draft.id}`} title="deep link to this draft">
          ?draft={draft.id.slice(0, 8)}
        </LineageNode>
      </div>

      {editing ? (
        <textarea
          aria-label="Edit draft body"
          className="min-h-32 w-full rounded-lg border border-border bg-background p-2.5 text-sm leading-relaxed focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          value={editedBody}
          onChange={(e) => setEditedBody(e.target.value)}
        />
      ) : (
        <div className="rounded-lg border border-border bg-background p-3.5">
          <span className="u-eyebrow mb-1.5 block text-muted-foreground">
            the judged body · exactly what a verdict applies to
          </span>
          <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">{draft.body}</p>
        </div>
      )}

      <div>
        <span className="u-eyebrow mb-1.5 block text-muted-foreground">
          where this came from — every recorded node opens its artifact
        </span>
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {captureId && (
            <>
              <LineageNode title="the intel capture that seeded this run (no surface for it yet)">
                intel #{captureId.slice(0, 8)}
              </LineageNode>
              <span aria-hidden className="text-muted-foreground">
                →
              </span>
            </>
          )}
          {run && (
            <>
              <LineageNode href={`/app/approve?run=${run.id}`} title="select this fan-out run's drafts">
                run #{run.id.slice(0, 8)}
              </LineageNode>
              <span aria-hidden className="text-muted-foreground">
                →
              </span>
            </>
          )}
          <LineageNode href="#judge-verdicts" title="the per-check verdicts below">
            judge {st.word === "blocked" ? "✗" : draft.status === "judging" || draft.status === "generated" ? "·" : "✓"}{" "}
            receipt
          </LineageNode>
          <span aria-hidden className="text-muted-foreground">
            →
          </span>
          <LineageNode title="approve moves the draft to the publish door; nothing publishes on its own">
            publish door (after approve)
          </LineageNode>
          <span className="flex-1" />
          {run && (
            <span className="inline-flex h-5 items-center rounded-full bg-muted px-2 text-xs font-medium">
              profile v{run.brandProfileVersion}
            </span>
          )}
          {run && (
            <span className="inline-flex h-5 items-center rounded-full bg-muted px-2 text-xs font-medium">
              {run.model} draft{judgeModel ? ` · ${judgeModel} judge` : ""}
            </span>
          )}
        </div>
        {run && !run.draftsComplete && (
          <p className="u-eyebrow mt-1.5 text-muted-foreground">
            this run is incomplete — fewer drafts than the platforms it requested (an aborted or partial fan-out)
          </p>
        )}
      </div>

      <JudgeVerdicts results={judgeResults} bodyHash={draft.bodyHash} />

      <FormatDetail draft={draft} />

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3.5">
        {editing ? (
          <>
            <Button size="sm" onClick={saveEdit} disabled={busy}>
              Save edit — the judge re-runs on the new body
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditing(false)} disabled={busy}>
              Cancel
            </Button>
          </>
        ) : (
          <>
            {canApproveReject && (
              <>
                <Button className="h-9" onClick={onApprove} disabled={busy}>
                  Approve — records the approval; nothing publishes until the publish door arms
                </Button>
                <Button size="sm" variant="destructive" onClick={onReject} disabled={busy}>
                  Reject…
                </Button>
              </>
            )}
            {canEdit && (
              <Button size="sm" variant="outline" onClick={startEdit} disabled={busy}>
                Edit
              </Button>
            )}
            {canReJudge && (
              <Button size="sm" variant="outline" onClick={onReJudge} disabled={busy}>
                Re-judge
              </Button>
            )}
            {canPublish && (
              <Button size="sm" onClick={onPublish} disabled={busy}>
                Publish to site
              </Button>
            )}
            <span className="flex-1" />
            {canApproveReject && (
              <span className="u-eyebrow text-muted-foreground">
                reject asks for a named confirm · every verdict is recorded
              </span>
            )}
          </>
        )}
      </div>

      {actionError && (
        <p className="text-xs text-destructive" role="alert">
          {actionError}
        </p>
      )}

      {draft.status === "blocked" && (
        <div className="rounded-lg border border-signal/45 bg-card p-3.5">
          <div className="mb-1.5 flex items-center gap-2">
            <span className="rounded-full bg-signal px-1.5 py-px font-mono text-2xs tracking-wider text-signal-foreground uppercase">
              blocked
            </span>
            <span className="text-xs font-semibold">Why there is no approve button</span>
          </div>
          <p className="text-xs text-foreground">
            Edit the draft and the judge re-runs; approve is simply absent while any check fails — the gate fails
            closed. The failing reasons are in the receipt above, verbatim.
          </p>
        </div>
      )}

      {draft.status === "judging" && (
        <p className="text-xs text-muted-foreground">
          No passing verdict yet for this draft&rsquo;s current body — edit-save and Re-judge both run the judge
          pipeline synchronously, so a draft only sits here when that run is genuinely stuck (see any error above).
          Re-judge retries it unmodified.
        </p>
      )}
    </section>
  );
}
