import { cn } from "@/lib/utils";

/** Loading placeholder on the muted wash (DESIGN.md Do: "skeletons, not text"). */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  );
}

export { Skeleton };
