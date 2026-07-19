"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SweepStamp } from "@/lib/intel/types";
import { timeAgo, timeUntil } from "@/lib/workspace/format";

/**
 * The Intel cadence stamp (wave-3 §3.7, header dress per Phase D design #4):
 * automation is FELT when it's stamped where the operator looks — a mono
 * micro-stamp in the surface header with Sweep-now beside it. Honest in both
 * eras — while the dataset is demo the stamp says so ("demo drivers until
 * B6.5 arms") and "next sweep" only renders when one is actually scheduled
 * (B-arm.1: an enabled schedule's real time, "due now" once it arrives);
 * "Sweep now" runs a REAL sweep through the env-selected TrendSource (B6.5
 * armed it) — a driver refusal surfaces verbatim in the tab's error line,
 * never a fake spinner.
 */
export function CadenceStamp({
  sweep,
  demo,
  busy,
  onSweepNow,
}: {
  sweep: SweepStamp;
  /** true while cards come from the built-in demo dataset. */
  demo?: boolean;
  busy?: boolean;
  onSweepNow?: () => void;
}) {
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
      <span className="font-mono text-2xs tracking-wider text-muted-foreground uppercase">
        swept{" "}
        <time dateTime={sweep.lastSweptAt} className="text-foreground">
          {timeAgo(sweep.lastSweptAt)}
        </time>
        {" · "}
        {sweep.dueNow ? (
          <span className="text-foreground">due now</span>
        ) : sweep.nextSweepAt ? (
          <>
            next{" "}
            <time dateTime={sweep.nextSweepAt} className="text-foreground">
              {timeUntil(sweep.nextSweepAt)}
            </time>
          </>
        ) : (
          <>sweeps every {sweep.intervalHours}h — run the first one now</>
        )}
        {demo && <> · demo drivers until B6.5 arms</>}
      </span>
      <Button
        size="sm"
        variant="ghost"
        disabled={busy || !onSweepNow}
        onClick={onSweepNow}
        className="h-6 px-2 text-xs"
      >
        <RefreshCw aria-hidden data-icon="inline-start" /> Sweep now
      </Button>
    </span>
  );
}
