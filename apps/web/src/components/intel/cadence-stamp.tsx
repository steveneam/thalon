"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SweepStamp } from "@/lib/intel/types";
import { timeAgo, timeUntil } from "@/lib/workspace/format";

/**
 * The Intel cadence stamp (wave-3 §3.7): automation is FELT when it's
 * stamped where the operator looks. Honest in both eras — while the dataset
 * is demo, "next sweep" names what arms it and "Sweep now" runs a REAL
 * sweep through the env-selected TrendSource (B6.5 armed it); a driver
 * refusal surfaces verbatim in the tab's error line, never a fake spinner.
 */
export function CadenceStamp({
  sweep,
  busy,
  onSweepNow,
}: {
  sweep: SweepStamp;
  busy?: boolean;
  onSweepNow?: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground">
      <span>
        last swept{" "}
        <time dateTime={sweep.lastSweptAt} className="font-medium text-foreground">
          {timeAgo(sweep.lastSweptAt)}
        </time>
      </span>
      <span aria-hidden>·</span>
      <span>
        {sweep.nextSweepAt ? (
          <>
            next sweep{" "}
            <time dateTime={sweep.nextSweepAt} className="font-medium text-foreground">
              {timeUntil(sweep.nextSweepAt)}
            </time>{" "}
            (scheduled polling lands at deploy — Sweep now until then)
          </>
        ) : (
          <>sweeps every {sweep.intervalHours}h — run the first one now</>
        )}
      </span>
      <span aria-hidden>·</span>
      <Button
        size="sm"
        variant="outline"
        disabled={busy || !onSweepNow}
        onClick={onSweepNow}
        className="h-6 px-2 text-xs"
      >
        <RefreshCw aria-hidden data-icon="inline-start" /> Sweep now
      </Button>
    </div>
  );
}
