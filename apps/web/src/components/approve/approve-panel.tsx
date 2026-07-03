"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { JudgeBadge } from "@/components/approve/judge-badge";
import type { GridDraft, PanelJudgeResult } from "@/lib/approve-queue/types";

export type PanelStatus = "idle" | "loading" | "error" | "success";

interface ApprovePanelProps {
  status: PanelStatus;
  draft: GridDraft | null;
  judgeResults: PanelJudgeResult[];
  busy?: boolean;
  onApprove: () => void;
  onReject: () => void;
  onEditSave: (editedBody: string) => void;
}

/** Zone 3: full body, per-variant judge badge, and the approve / reject / edit actions. */
export function ApprovePanel({ status, draft, judgeResults, busy, onApprove, onReject, onEditSave }: ApprovePanelProps) {
  const [editing, setEditing] = useState(false);
  const [editedBody, setEditedBody] = useState("");

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
          </>
        )}
      </div>
      {draft.status === "judging" && (
        <p className="text-xs text-muted-foreground">Re-judging after your edit — verdicts will refresh here once the judge lane runs.</p>
      )}
    </section>
  );
}
