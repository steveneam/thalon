"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SweepStamp } from "@/lib/intel/types";
import { timeAgo } from "@/lib/workspace/format";

/**
 * The Intel cadence stamp (wave-3 §3.7): automation is FELT when it's
 * stamped where the operator looks. Honest about fake-driver mode — while
 * the dataset is demo, "next sweep" names what arms it and "Sweep now" is
 * disabled with the reason, never a fake spinner.
 */
export function CadenceStamp({ sweep, demo }: { sweep: SweepStamp; demo: boolean }) {
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
              {timeAgo(sweep.nextSweepAt)}
            </time>
          </>
        ) : (
          <>sweeps every {sweep.intervalHours}h once live polling arms (B6.5)</>
        )}
      </span>
      <span aria-hidden>·</span>
      <Button
        size="sm"
        variant="outline"
        disabled={demo}
        title={demo ? "Sweeping arms with the B6.5 live pollers — this dataset is the built-in demo." : undefined}
        className="h-6 px-2 text-xs"
      >
        <RefreshCw aria-hidden data-icon="inline-start" /> Sweep now
      </Button>
    </div>
  );
}
