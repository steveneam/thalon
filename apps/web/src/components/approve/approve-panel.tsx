"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { FormatDetail } from "@/components/approve/format-detail";
import { JudgeBadge } from "@/components/approve/judge-badge";
import { JudgeReasons } from "@/components/approve/judge-reasons";
import { isTypingTarget } from "@/lib/workspace/keyboard";
import type { GridDraft, PanelJudgeResult } from "@/lib/approve-queue/types";

export type PanelStatus = "idle" | "loading" | "error" | "success";

interface ApprovePanelProps {
  status: PanelStatus;
  draft: GridDraft | null;
  judgeResults: PanelJudgeResult[];
  busy?: boolean;
  /** Message from the last approve/reject/edit/re-judge attempt, if it failed — e.g. a judge run that threw (no gateway key, a budget halt). Null/undefined once an attempt succeeds. */
  actionError?: string | null;
  onApprove: () => void;
  onReject: () => void;
  onEditSave: (editedBody: string) => void;
  onReJudge: () => void;
  onPublish: () => void;
}

/** Zone 3: full body, per-variant judge badge, and the approve / reject / edit / re-judge actions. */
export function ApprovePanel({ status, draft, judgeResults, busy, actionError, onApprove, onReject, onEditSave, onReJudge, onPublish }: ApprovePanelProps) {
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
      <section aria-label="Approve panel" className="flex w-full flex-col gap-2 p-3 md:w-96">
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

  function startEdit() {
    setEditedBody(draft!.body);
    setEditing(true);
  }

  function saveEdit() {
    onEditSave(editedBody);
    setEditing(false);
  }

  return (
    <section aria-label="Approve panel" className="flex w-full flex-col gap-3 p-3 md:w-96">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">{draft.platform}</h2>
        <span className="text-xs text-muted-foreground">{draft.status}</span>
      </div>
      <JudgeBadge results={judgeResults} bodyHash={draft.bodyHash} />
      <JudgeReasons results={judgeResults} bodyHash={draft.bodyHash} />
      <FormatDetail draft={draft} />
      {editing ? (
        <textarea
          aria-label="Edit draft body"
          className="min-h-32 w-full rounded-lg border border-border bg-background p-2 text-sm focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          value={editedBody}
          onChange={(e) => setEditedBody(e.target.value)}
        />
      ) : (
        <p className="whitespace-pre-wrap text-sm text-foreground">{draft.body}</p>
      )}
      <div className="flex flex-wrap gap-2">
        {editing ? (
          <>
            <Button size="sm" onClick={saveEdit} disabled={busy}>
              Save edit
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditing(false)} disabled={busy}>
              Cancel
            </Button>
          </>
        ) : (
          <>
            <Button size="sm" onClick={onApprove} disabled={busy || !canApproveReject}>
              Approve
            </Button>
            <Button size="sm" variant="destructive" onClick={onReject} disabled={busy || !canApproveReject}>
              Reject
            </Button>
            <Button size="sm" variant="outline" onClick={startEdit} disabled={busy || !canEdit}>
              Edit
            </Button>
            <Button size="sm" variant="outline" onClick={onReJudge} disabled={busy || !canReJudge}>
              Re-judge
            </Button>
            {canPublish && (
              <Button size="sm" onClick={onPublish} disabled={busy}>
                Publish to site
              </Button>
            )}
          </>
        )}
      </div>
      {actionError && (
        <p className="text-xs text-destructive" role="alert">
          {actionError}
        </p>
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
