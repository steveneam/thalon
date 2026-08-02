import { platformLabel } from "@/lib/workspace/format";

/**
 * The W1 sheet's `.plat-dot` — a real platform mark on every queue row
 * (house rule since Analytics: real marks, never a text token). The four
 * marks below are the sheet's own paths verbatim (LinkedIn · X · Facebook ·
 * Bluesky) plus its globe for site/blog drafts; a platform the sheet never
 * drew gets its initial letter — an honest fallback, never an invented logo.
 * The full platform name always rides the title.
 */
const MARK_PATHS: Record<string, string> = {
  linkedin:
    "M4.2 5.9H1.9V14h2.3V5.9ZM3 2a1.3 1.3 0 1 0 0 2.7A1.3 1.3 0 0 0 3 2Zm5.6 3.7c-1.2 0-1.9.6-2.2 1.1V5.9H6.1V14h2.3V9.6c0-1 .2-1.9 1.4-1.9s1.2 1.1 1.2 2V14h2.3V9.2c0-2.2-1.2-3.5-2.9-3.5Z",
  x: "M2.4 2.2h3.9l3.1 4.4 3.6-4.4h1.6l-4.5 5.4 4.8 6.4h-3.9l-3.3-4.7-3.9 4.7H2.1l4.9-5.9L2.4 2.2Z",
  facebook:
    "M9.6 15V8.9h2l.3-2.4H9.6V5c0-.7.2-1.2 1.2-1.2h1.3V1.7A17 17 0 0 0 10.2 1.6C8.3 1.6 7 2.8 7 4.8v1.7H5v2.4h2V15h2.6Z",
  bluesky:
    "M3.6 2.6C5.3 3.9 7.1 6.5 8 7.9c.9-1.4 2.7-4 4.4-5.3 1.2-.9 3.1-1.6 3.1.6 0 .4-.3 3.5-.4 4-.4 1.7-2.1 2.1-3.6 1.9 2.6.4 3.3 1.9 1.9 3.4-2.7 2.8-3.9-.7-4.2-1.6l-.2-.5-.2.5c-.3.9-1.5 4.4-4.2 1.6-1.4-1.5-.7-3 1.9-3.4-1.5.2-3.2-.2-3.6-1.9-.1-.5-.4-3.6-.4-4 0-2.2 1.9-1.5 3.1-.6Z",
};

/** Site/blog drafts wear the sheet's stroke globe rather than a filled mark. */
const GLOBE_PLATFORMS = new Set(["blog", "site", "web"]);

export function PlatMark({ platform }: { platform: string }) {
  const key = platform.toLowerCase();
  const label = platformLabel(platform);
  if (GLOBE_PLATFORMS.has(key)) {
    return (
      <span className="plat-dot" title={label}>
        <svg
          width="9"
          height="9"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        >
          <circle cx="8" cy="8" r="5.7" />
          <path d="M2.5 8h11M8 2.5c2 1.8 2 9.2 0 11" />
        </svg>
      </span>
    );
  }
  const path = MARK_PATHS[key];
  if (!path) {
    return (
      <span className="plat-dot plat-dot-letter" title={label}>
        {label.charAt(0)}
      </span>
    );
  }
  return (
    <span className="plat-dot" title={label}>
      <svg width="9" height="9" viewBox="0 0 16 16" fill="currentColor">
        <path d={path} />
      </svg>
    </span>
  );
}
