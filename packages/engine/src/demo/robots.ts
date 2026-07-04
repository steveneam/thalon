/**
 * robots.txt parsing + permission check (B2.5 stage 1 safety invariant,
 * CHARTER B2.5): pure core functions, tested in isolation from the network.
 * Implements the common-case algorithm every major crawler agrees on — the
 * longest matching Allow/Disallow path prefix wins, ties broken toward Allow
 * — but skips wildcard (`*`) and end-anchor (`$`) path patterns, which no
 * site in this engine's fixtures needs.
 */
export interface RobotsRule {
  type: "allow" | "disallow";
  path: string;
}

export interface RobotsRuleGroup {
  userAgents: string[];
  rules: RobotsRule[];
}

export interface RobotsRules {
  groups: RobotsRuleGroup[];
}

/** No robots.txt (or an empty one) is the standard "allow everything" case. */
export const ALLOW_ALL_ROBOTS: RobotsRules = { groups: [] };

const DIRECTIVE_LINE = /^([A-Za-z-]+)\s*:\s*(.*)$/;

/** Pure parse: given the same robots.txt text, always the same rule groups. Unknown directives (Sitemap, Crawl-delay, etc.) are ignored. */
export function parseRobotsTxt(text: string): RobotsRules {
  const groups: RobotsRuleGroup[] = [];
  let current: RobotsRuleGroup | null = null;
  let currentHasRules = false;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const match = DIRECTIVE_LINE.exec(line);
    if (!match) continue;
    const directive = match[1].toLowerCase();
    const value = match[2].trim();

    if (directive === "user-agent") {
      // Consecutive User-agent lines with no rules between them share one
      // group (the common "these agents get the same rules" shorthand); a
      // User-agent line seen AFTER a group's first rule starts a new group.
      if (!current || currentHasRules) {
        current = { userAgents: [], rules: [] };
        groups.push(current);
        currentHasRules = false;
      }
      current.userAgents.push(value);
      continue;
    }
    if (!current) continue;
    if (directive === "disallow" && value) {
      current.rules.push({ type: "disallow", path: value });
      currentHasRules = true;
    } else if (directive === "allow" && value) {
      current.rules.push({ type: "allow", path: value });
      currentHasRules = true;
    }
    // An empty `Disallow:` is the standard "nothing disallowed" no-op —
    // deliberately not recorded as a rule.
  }
  return { groups };
}

function selectGroup(rules: RobotsRules, userAgent: string): RobotsRuleGroup | null {
  const lowerUA = userAgent.toLowerCase();
  const specific = rules.groups.find((g) =>
    g.userAgents.some((ua) => ua !== "*" && lowerUA.includes(ua.toLowerCase())),
  );
  if (specific) return specific;
  return rules.groups.find((g) => g.userAgents.includes("*")) ?? null;
}

/** Pure permission check: the longest matching Disallow/Allow path prefix wins; no match at all ⇒ allowed (robots.txt convention). */
export function isPathAllowed(rules: RobotsRules, userAgent: string, path: string): boolean {
  const group = selectGroup(rules, userAgent);
  if (!group) return true;
  let best: RobotsRule | null = null;
  for (const rule of group.rules) {
    if (!path.startsWith(rule.path)) continue;
    if (
      !best ||
      rule.path.length > best.path.length ||
      (rule.path.length === best.path.length && rule.type === "allow")
    ) {
      best = rule;
    }
  }
  return best ? best.type === "allow" : true;
}

/** Refused loudly — a disallowed page is never silently skipped past (CHARTER B2.5 safety invariant). */
export class RobotsDisallowedError extends Error {
  constructor(
    public readonly url: string,
    public readonly userAgent: string,
  ) {
    super(`robots.txt disallows "${userAgent}" from fetching "${url}"`);
    this.name = "RobotsDisallowedError";
  }
}

export function assertPathAllowed(
  rules: RobotsRules,
  userAgent: string,
  path: string,
  url: string,
): void {
  if (!isPathAllowed(rules, userAgent, path)) {
    throw new RobotsDisallowedError(url, userAgent);
  }
}
