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

/**
 * Every rule from every group matching `userAgent` — a robots.txt is free to
 * split one agent's rules across multiple non-adjacent groups (e.g.
 * interleaved with other agents' groups), and ALL of them apply, not just
 * the first one found. Specific-agent groups take priority over the `*`
 * fallback as a set: if ANY group names this agent specifically, the `*`
 * groups are ignored entirely (never merged in) — only when NO group names
 * this agent do the `*` groups' rules apply, merged the same way.
 */
function selectRules(rules: RobotsRules, userAgent: string): RobotsRule[] {
  const lowerUA = userAgent.toLowerCase();
  const specificGroups = rules.groups.filter((g) =>
    g.userAgents.some((ua) => ua !== "*" && lowerUA.includes(ua.toLowerCase())),
  );
  const matchingGroups =
    specificGroups.length > 0
      ? specificGroups
      : rules.groups.filter((g) => g.userAgents.includes("*"));
  return matchingGroups.flatMap((g) => g.rules);
}

/** Pure permission check: the longest matching Disallow/Allow path prefix wins, across ALL of the user-agent's matching rules; no match at all ⇒ allowed (robots.txt convention). */
export function isPathAllowed(rules: RobotsRules, userAgent: string, path: string): boolean {
  const matchingRules = selectRules(rules, userAgent);
  let best: RobotsRule | null = null;
  for (const rule of matchingRules) {
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
