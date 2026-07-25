"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Badge } from "@astryxdesign/core/Badge";
import { SideNav, SideNavItem, SideNavSection } from "@astryxdesign/core/SideNav";
import { BrandMark } from "@/components/brand/marks";
import { usePulse } from "@/components/workspace/pulse-context";
import { activeSurface, NAV_SECTIONS, NAV_SURFACES } from "@/lib/workspace/nav";

/**
 * The labeled side nav (wave-0 kickoff step 3): every surface wears its
 * word — icon + label, order and grouping exactly as the founder-verdicted
 * mock. The three clusters render as unlabeled groups (the mock's ┃
 * separators); their titles stay for screen readers. The Approve row
 * carries the needs-you count in the amber signal channel — amber is
 * needs-you ONLY (§5 doctrine 3).
 */
export function WorkspaceSideNav() {
  const pathname = usePathname();
  const { pulse, status } = usePulse();
  const active = activeSurface(pathname);
  const needsYou = pulse?.needsYou ?? 0;

  return (
    <SideNav
      header={
        <Link
          href="/app"
          aria-label="Workspace home"
          className="flex items-center gap-2 px-3 py-2 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {/* The mark wears the landing amber — one DNA with the landing;
              brand is never status, never interactive color (§5). */}
          <BrandMark
            aria-hidden
            className="size-5 shrink-0"
            style={{ color: "light-dark(var(--color-brand-lo), var(--color-brand-hi))" }}
          />
          <span className="text-sm font-semibold">Thalon</span>
        </Link>
      }
    >
      {NAV_SECTIONS.map((section) => (
        <SideNavSection key={section.id} title={section.title} isHeaderHidden>
          {NAV_SURFACES.filter((s) => s.section === section.id).map((surface) => (
            <SideNavItem
              key={surface.href}
              label={surface.label}
              href={surface.href}
              icon={surface.icon}
              isSelected={active?.href === surface.href}
              endContent={
                surface.showsNeedsYou && status === "success" && needsYou > 0 ? (
                  <Badge variant="warning" label={String(needsYou)} />
                ) : undefined
              }
            />
          ))}
        </SideNavSection>
      ))}
    </SideNav>
  );
}
