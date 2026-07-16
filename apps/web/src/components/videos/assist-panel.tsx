"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import type { Edl, EdlDiffOp, VideoCutAttribution } from "@thalon/contracts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { proposeDiff, rejectProposal, type DiffProposal } from "@/lib/videos/client";

/**
 * B-ve.4 assist panel (ADR 0010): the agent proposes an EDL DIFF, the
 * operator reads every op (with its why) and decides. Apply hands the
 * applied preview + full attribution up to the editor — the save door
 * replay-verifies it; auto-apply does not exist. Reject requires the
 * reason: the correction becomes an eval row (rule 6), exactly like a
 * rejected take carries its reason.
 */

function opTarget(op: EdlDiffOp, base: Edl): string {
  if (op.op === "music-align") return `music cue ${op.cue}`;
  const text = base.captions?.lines[op.line]?.text;
  return `line ${op.line}${text ? ` “${text}”` : ""}`;
}

function opChange(op: EdlDiffOp, base: Edl): string {
  switch (op.op) {
    case "caption-move": {
      const line = base.captions?.lines[op.line];
      return line ? `(${line.x}, ${line.y}) → (${op.x}, ${op.y})` : `→ (${op.x}, ${op.y})`;
    }
    case "caption-text":
      return `→ “${op.text}”`;
    case "music-align": {
      const knobs: string[] = [];
      if (op.offset !== undefined) knobs.push(`offset → ${op.offset}s`);
      if (op.gainDb !== undefined) knobs.push(`gain → ${op.gainDb}dB`);
      if (op.fadeIn !== undefined) knobs.push(`entry ease → ${op.fadeIn.duration}s`);
      if (op.fadeOut !== undefined)
        knobs.push(`tail ease → ${op.fadeOut.duration}s @ ${op.fadeOut.start}s`);
      return knobs.join(" · ");
    }
  }
}

export function AssistPanel({
  projectId,
  cutId,
  baseEdl,
  dirty,
  onApply,
}: {
  projectId: string;
  cutId: string;
  /** The SAVED cut's EDL — what the agent proposed against (before values come from here). */
  baseEdl: Edl;
  /** Unsaved manual edits present: proposing is disabled — the agent reads the stored cut. */
  dirty: boolean;
  onApply: (preview: Edl, attribution: VideoCutAttribution) => void;
}) {
  const [ask, setAsk] = useState("");
  const [proposal, setProposal] = useState<DiffProposal | null>(null);
  const [busy, setBusy] = useState<"propose" | "reject" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const onPropose = async () => {
    setBusy("propose");
    setNotice(null);
    setProposal(null);
    try {
      setProposal(await proposeDiff(projectId, cutId, ask));
      setRejectReason("");
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "proposal failed");
    } finally {
      setBusy(null);
    }
  };

  const onReject = async () => {
    if (!proposal || !rejectReason.trim()) return;
    setBusy("reject");
    setNotice(null);
    try {
      await rejectProposal(projectId, cutId, {
        diff: proposal.diff,
        reason: rejectReason.trim(),
        ...(ask.trim() ? { ask: ask.trim() } : {}),
      });
      setProposal(null);
      setNotice("Rejected — the correction is now an eval row.");
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "reject failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles aria-hidden className="size-4 text-muted-foreground" />
          Assist
        </CardTitle>
        <CardDescription>
          The agent proposes a diff — caption placement and music alignment — against the saved
          cut. You approve each proposal or reject it with a reason; nothing applies itself.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex min-w-56 flex-1 flex-col gap-0.5 text-xs text-muted-foreground">
            ask (optional)
            <input
              value={ask}
              onChange={(e) => setAsk(e.target.value)}
              placeholder="e.g. clear the second caption off the falcon"
              className="rounded-md border border-border bg-background p-1.5 text-sm text-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </label>
          <Button onClick={() => void onPropose()} disabled={dirty || busy !== null}>
            {busy === "propose" ? "Proposing…" : "Propose"}
          </Button>
        </div>
        {dirty && (
          <p className="text-xs text-muted-foreground">
            Save your manual edits first — the agent proposes against the stored cut.
          </p>
        )}
        {notice && (
          <p role="status" className="rounded-md bg-muted px-2.5 py-1.5 text-sm text-foreground">
            {notice}
          </p>
        )}
        {proposal && (
          <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
            <p className="text-sm font-medium">{proposal.diff.summary}</p>
            <ul className="flex flex-col gap-1.5">
              {proposal.diff.ops.map((op, i) => (
                <li key={i} className="rounded-md border border-border p-2">
                  <p className="flex flex-wrap items-center gap-2 text-sm">
                    <Badge variant="outline">{op.op}</Badge>
                    <span className="min-w-0 truncate text-muted-foreground">
                      {opTarget(op, baseEdl)}
                    </span>
                    <span className="u-tabular">{opChange(op, baseEdl)}</span>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{op.why}</p>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-end gap-2">
              <Button
                onClick={() => {
                  onApply(proposal.preview, proposal.attribution);
                  setProposal(null);
                  setNotice("Applied to the working copy — Save records it as agent-authored.");
                }}
              >
                Apply
              </Button>
              <label className="flex min-w-48 flex-1 flex-col gap-0.5 text-xs text-muted-foreground">
                reject reason (required — it becomes the eval row)
                <input
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="rounded-md border border-border bg-background p-1.5 text-sm text-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                />
              </label>
              <Button
                variant="outline"
                onClick={() => void onReject()}
                disabled={!rejectReason.trim() || busy !== null}
              >
                {busy === "reject" ? "Rejecting…" : "Reject"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
