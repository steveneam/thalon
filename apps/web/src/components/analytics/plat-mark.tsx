import { platformLabel } from "@/lib/workspace/format";

/**
 * The Analytics sheet's `.plat-dot` marks, lifted from Analytics.dc.html's
 * own rows verbatim (house rule: real marks, never a text token — and never
 * an invented logo). Surface-local on purpose: `components/approve/plat-mark`
 * is the Approve-scoped precedent and cross-surface imports of it are barred
 * (kickoff), so this surface carries the sheet's own markup itself.
 *
 * A platform the sheet never drew gets its initial letter — an honest
 * fallback. The full platform name always rides the title.
 */

/** Filled marks, the sheet's own paths (Facebook · LinkedIn · Bluesky). */
const FILLED: Record<string, string> = {
  facebook:
    "M9.6 15V8.9h2l.3-2.4H9.6V5c0-.7.2-1.2 1.2-1.2h1.3V1.7A17 17 0 0 0 10.2 1.6C8.3 1.6 7 2.8 7 4.8v1.7H5v2.4h2V15h2.6Z",
  linkedin:
    "M4.2 5.9H1.9V14h2.3V5.9ZM3 2a1.3 1.3 0 1 0 0 2.7A1.3 1.3 0 0 0 3 2Zm5.6 3.7c-1.2 0-1.9.6-2.2 1.1V5.9H6.1V14h2.3V9.6c0-1 .2-1.9 1.4-1.9s1.2 1.1 1.2 2V14h2.3V9.2c0-2.2-1.2-3.5-2.9-3.5Z",
  bluesky:
    "M3.6 2.6C5.3 3.9 7.1 6.5 8 7.9c.9-1.4 2.7-4 4.4-5.3 1.2-.9 3.1-1.6 3.1.6 0 .4-.3 3.5-.4 4-.4 1.7-2.1 2.1-3.6 1.9 2.6.4 3.3 1.9 1.9 3.4-2.7 2.8-3.9-.7-4.2-1.6l-.2-.5-.2.5c-.3.9-1.5 4.4-4.2 1.6-1.4-1.5-.7-3 1.9-3.4-1.5.2-3.2-.2-3.6-1.9-.1-.5-.4-3.6-.4-4 0-2.2 1.9-1.5 3.1-.6Z",
};

/** Site/blog rows wear the sheet's stroke globe. */
const GLOBE = new Set(["blog", "site", "web"]);

export function AnalyticsPlatMark({ platform }: { platform: string }) {
  const key = platform.toLowerCase();
  const label = platformLabel(platform);
  if (key === "instagram") {
    // The sheet's Instagram mark is stroke-drawn, unlike the filled three.
    return (
      <span className="plat-dot" title={label}>
        <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="2.2" y="2.2" width="11.6" height="11.6" rx="3.6" />
          <circle cx="8" cy="8" r="2.9" />
          <circle cx="11.5" cy="4.5" r="0.8" fill="currentColor" stroke="none" />
        </svg>
      </span>
    );
  }
  if (GLOBE.has(key)) {
    return (
      <span className="plat-dot" title={label}>
        <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <circle cx="8" cy="8" r="5.7" />
          <path d="M2.5 8h11M8 2.5c2 1.8 2 9.2 0 11" />
        </svg>
      </span>
    );
  }
  const path = FILLED[key];
  if (!path) {
    return (
      <span className="plat-dot plat-dot-letter" title={label}>
        {label.charAt(0)}
      </span>
    );
  }
  return (
    <span className="plat-dot" title={label}>
      <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
        <path d={path} />
      </svg>
    </span>
  );
}
