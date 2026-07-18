import { computeJudgeBadge, type JudgeOverallStatus } from "@/lib/approve-queue/judge-badge";
import { gateLabel, type JudgeResultWithEvidence } from "@/lib/approve-queue/judge-reasons";
import { cn } from "@/lib/utils";

const OVERALL_LABEL: Record<JudgeOverallStatus, string> = {
  pass: "Pass",
  fail: "Fail",
  blocked_disagreement: "Blocked — disagreement",
  blocked_overlap: "Blocked — exemplar overlap",
  pending: "Pending",
};

/** The rule behind the two composite blocks, stated in operator copy (never a bare code). */
const OVERALL_NOTE: Partial<Record<JudgeOverallStatus, string>> = {
  blocked_disagreement:
    "The two grounding tiers returned different verdicts — the gate blocks until they agree, never silently passes.",
  blocked_overlap: "Verbatim exemplar reuse detected — a distinct, harder block than an ordinary fail.",
};

interface VerdictRow {
  gate: string;
  label: string;
  verdict: "pass" | "fail" | "pending";
  /** Reason lines VERBATIM from the recorded evidence — positive case included. */
  lines: string[];
}

interface EvidenceClaim {
  claim?: unknown;
  verdict?: unknown;
  evidence?: unknown;
}

/**
 * Per-check verdict rows from the judge's recorded evidence, VERBATIM —
 * including the positive case (what grounded a passing claim), which the old
 * reasons list withheld (ux-v2 §10: reasons "withheld exactly where trust is
 * earned"). Structural reads only: a malformed evidence blob yields an
 * honest fallback line, never a crash. Only rows for the draft's CURRENT
 * bodyHash are live evidence (SPINE invariant I1).
 */
export function judgeVerdictRows(results: JudgeResultWithEvidence[], bodyHash: string): VerdictRow[] {
  const { gates } = computeJudgeBadge(results, bodyHash);

  const latestByGate = new Map<string, JudgeResultWithEvidence>();
  for (const r of results) {
    if (r.bodyHash !== bodyHash) continue;
    const prev = latestByGate.get(r.gate);
    if (!prev || new Date(r.createdAt).getTime() >= new Date(prev.createdAt).getTime()) {
      latestByGate.set(r.gate, r);
    }
  }

  return Object.entries(gates).map(([gate, verdict]) => {
    const result = latestByGate.get(gate);
    const lines: string[] = [];
    if (verdict === "pending" || !result) {
      lines.push("no verdict yet for the current body");
    } else {
      const ev = result.evidence as { claims?: unknown; notes?: unknown } | null;
      const claims = Array.isArray(ev?.claims) ? (ev.claims as EvidenceClaim[]) : [];
      for (const c of claims) {
        const claim = typeof c.claim === "string" && c.claim.length > 0 ? c.claim : null;
        const detail = typeof c.evidence === "string" && c.evidence.length > 0 ? c.evidence : null;
        const line = claim && detail ? `${claim} — ${detail}` : (claim ?? detail);
        if (line) lines.push(line);
      }
      if (lines.length === 0) {
        const notes = typeof ev?.notes === "string" && ev.notes.length > 0 ? ev.notes : null;
        lines.push(
          notes ??
            (verdict === "pass"
              ? "passed — no claims recorded for this check"
              : "failed without recorded detail — re-judge to get a fresh verdict"),
        );
      }
    }
    return { gate, label: gateLabel(gate), verdict, lines };
  });
}

interface JudgeVerdictsProps {
  results: JudgeResultWithEvidence[];
  bodyHash: string;
}

/**
 * The judge receipt (Phase I — the s59 "Approve Consent" design): one row
 * per check, verdict mark + reasons verbatim, never paraphrased. The
 * anchor id is the lineage strip's "judge receipt" target.
 */
export function JudgeVerdicts({ results, bodyHash }: JudgeVerdictsProps) {
  const { overall } = computeJudgeBadge(results, bodyHash);
  const rows = judgeVerdictRows(results, bodyHash);
  const note = OVERALL_NOTE[overall];
  return (
    <div
      id="judge-verdicts"
      data-overall={overall}
      className="rounded-lg border border-border bg-card p-3.5"
      aria-label="Judge verdicts"
      role="group"
    >
      <div className="mb-2 flex items-center gap-2">
        <span className="u-eyebrow text-muted-foreground">judge verdicts — reasons verbatim, never paraphrased</span>
        <span className="flex-1" />
        <span
          className={cn(
            "text-xs font-semibold",
            overall === "pass"
              ? "text-ok"
              : overall === "pending"
                ? "text-muted-foreground"
                : "text-destructive",
          )}
        >
          {OVERALL_LABEL[overall]}
        </span>
      </div>
      <ul className="flex flex-col">
        {rows.map((row) => (
          <li key={row.gate} className="flex items-start gap-2.5 border-t border-border py-2 first:border-t-0 first:pt-0 last:pb-0">
            <span
              aria-hidden
              className={cn(
                "w-4 shrink-0 text-center font-mono text-xs font-bold",
                row.verdict === "pass"
                  ? "text-ok"
                  : row.verdict === "fail"
                    ? "text-destructive"
                    : "text-muted-foreground",
              )}
            >
              {row.verdict === "pass" ? "✓" : row.verdict === "fail" ? "✗" : "·"}
            </span>
            <span className="w-28 shrink-0 text-xs font-semibold">{row.label}</span>
            <span className="min-w-0 flex-1 text-xs text-muted-foreground">
              <span className="sr-only">{row.verdict === "pass" ? "passed: " : row.verdict === "fail" ? "failed: " : "pending: "}</span>
              {row.lines.join(" · ")}
            </span>
          </li>
        ))}
      </ul>
      {note && <p className="mt-2 border-t border-border pt-2 text-xs text-foreground">{note}</p>}
    </div>
  );
}
