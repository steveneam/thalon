"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * B-ve.6: the video section's tab rail — the editor is a first-class space
 * beside the project browser (founder direction s50), not a detail view.
 * Plain links styled as tabs; active state from the pathname.
 */
export function VideosSubnav({ projectId, cutId }: { projectId: string; cutId?: string | null }) {
  const pathname = usePathname();
  const inEditor = pathname?.endsWith("/edit") ?? false;
  const tabs = [
    { label: "Project", href: `/app/videos/${projectId}`, active: !inEditor },
    {
      label: "Editor",
      href: `/app/videos/${projectId}/edit${cutId ? `?cut=${cutId}` : ""}`,
      active: inEditor,
    },
  ];
  return (
    <nav aria-label="Video project sections" className="flex items-center gap-1">
      {tabs.map((tab) => (
        <Link
          key={tab.label}
          href={tab.href}
          aria-current={tab.active ? "page" : undefined}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-medium",
            "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
            tab.active
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
