import { judgeReasons, type JudgeResultWithEvidence } from "@/lib/approve-queue/judge-reasons";

interface JudgeReasonsProps {
  results: JudgeResultWithEvidence[];
  bodyHash: string;
}

/**
 * The WHY under the verdict chips (critique P1, 2026-07-14: reasons were
 * "withheld exactly where trust is earned"). Plain language from the judge's
 * recorded evidence — the operator sees the offending claim/term, not just
 * "g1: fail". Renders nothing when nothing failed.
 */
export function JudgeReasons({ results, bodyHash }: JudgeReasonsProps) {
  const reasons = judgeReasons(results, bodyHash);
  if (reasons.length === 0) return null;
  return (
    <ul aria-label="Why the judge blocked this" className="flex flex-col gap-1">
      {reasons.map((reason, i) => (
        <li key={`${reason.gate}-${i}`} className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{reason.gateLabel}: </span>
          {reason.line}
        </li>
      ))}
    </ul>
  );
}
