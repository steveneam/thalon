import { Radar } from "lucide-react";

/**
 * The honest seam label (kickoff rule: seams visible, never stubbed-over):
 * demo data is rendered as demo data, with what arms the real thing.
 */
export function DemoBanner({ arming }: { arming: string }) {
  return (
    <p className="flex items-center gap-2 rounded-lg border border-primary/25 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
      <Radar aria-hidden className="size-3.5 shrink-0 text-primary" />
      <span>
        <span className="font-medium text-foreground">Demo dataset.</span> {arming}
      </span>
    </p>
  );
}
