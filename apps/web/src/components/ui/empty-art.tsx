import { WORKSPACE_ASSETS, type WorkspaceAssetKey } from "@/lib/brand-assets";
import { cn } from "@/lib/utils";

/**
 * Decorative empty-state illustration (§W paper/navy set). Strictly
 * non-semantic: aria-hidden, empty alt, no pointer target — the empty-state
 * COPY keeps carrying the tutorial and actions. The radial mask melts the
 * plate's paper field into whatever light surface it sits on (page paper,
 * card white, dashed boxes), so the ink appears drawn on the page itself.
 */
export function EmptyArt({
  asset,
  size = "md",
  className,
}: {
  asset: WorkspaceAssetKey;
  size?: "xs" | "sm" | "md";
  className?: string;
}) {
  const a = WORKSPACE_ASSETS[asset];
  return (
    <img
      src={a.src}
      width={a.width}
      height={a.height}
      alt=""
      aria-hidden="true"
      data-brand={asset}
      loading="lazy"
      draggable={false}
      className={cn(
        // multiply melts the near-white paper field into any light surface;
        // the mask fades the plate edge so the ink reads drawn-on-the-page.
        "pointer-events-none mx-auto h-auto select-none mix-blend-multiply",
        "[mask-image:radial-gradient(ellipse_72%_72%_at_50%_50%,black_52%,transparent_98%)]",
        size === "md" ? "w-44" : size === "sm" ? "w-24" : "w-16",
        className,
      )}
    />
  );
}
