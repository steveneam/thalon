import { Badge } from "@/components/ui/badge";
import { computeJudgeBadge, type JudgeOverallStatus, type JudgeResultLike } from "@/lib/approve-queue/judge-badge";

const LABEL: Record<JudgeOverallStatus, string> = {
  pass: "Pass",
  fail: "Fail",
  blocked_disagreement: "Blocked — disagreement",
  pending: "Pending",
};

const VARIANT: Record<JudgeOverallStatus, "default" | "destructive" | "outline"> = {
  pass: "default",
  fail: "destructive",
  blocked_disagreement: "destructive",
  pending: "outline",
};

interface JudgeBadgeProps {
  results: JudgeResultLike[];
  bodyHash: string;
}

/** Surfaces gate evidence (g1 / g3_screen / g3_final) and clearly distinguishes pass / fail / blocked-disagreement / pending. */
export function JudgeBadge({ results, bodyHash }: JudgeBadgeProps) {
  const { overall, gates } = computeJudgeBadge(results, bodyHash);
  return (
    <div className="flex flex-wrap items-center gap-1.5" data-overall={overall}>
      <Badge variant={VARIANT[overall]}>{LABEL[overall]}</Badge>
      {Object.entries(gates).map(([gate, verdict]) => (
        <Badge key={gate} variant="secondary" className="font-mono text-[10px]">
          {gate}: {verdict}
        </Badge>
      ))}
    </div>
  );
}
