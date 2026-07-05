import {
  DIRECTION_ASPECTS,
  DIRECTION_DOC_VERSION,
  DIRECTION_MOTIONS,
  DIRECTION_NONE_SENTINEL,
  DIRECTION_PACINGS,
  directionDocSchema,
  type DirectionAspect,
  type DirectionDoc,
  type DirectionMotion,
  type DirectionPacing,
  type DirectionScene,
} from "./direction-doc";

/**
 * The deterministic direction.md renderer/parser (B5.2, amendment A11).
 * STRICT SCHEMA MARKDOWN, never freeform (founder-ratified decision 2):
 * one grammar, zero flexibility — no optional whitespace, no reordered
 * keys, no alternative spellings. The renderer emits exactly what the
 * parser accepts, which is what makes the round-trip BYTE-IDENTICAL in
 * both directions (the executable ratchet lives in
 * __tests__/direction-md.test.ts):
 *
 *   renderDirectionMd(parseDirectionMd(md)) === md   for any md that parses
 *   parseDirectionMd(renderDirectionMd(doc)) equals  doc  for any valid doc
 *
 * The document is simultaneously the operator's raw-markdown editor view
 * (B5.4), the model-facing stage representation (the scenes/polish shells
 * read it), and the persisted `direction_doc` meta — one artifact.
 *
 * Grammar (LF only, exactly one trailing newline):
 *
 *   ---
 *   doc: direction.v1
 *   title: <title>
 *   aspect: <16:9|9:16|1:1>
 *   fps: <int>
 *   pacing: <fast|medium|slow>
 *   ---
 *
 *   ## Scene 1 — <heading>
 *
 *   - narration: <text>
 *   - on-screen: <text or (none)>
 *   - visual: <text or (none)>
 *   - motion: <smooth|snappy|bouncy|dramatic>
 *   - duration-ms: <int>
 *
 *   ## Scene 2 — <heading>
 *   …
 *
 *   ## CTA
 *
 *   <cta text>            (section absent when cta is null)
 */

export class DirectionMdParseError extends Error {
  constructor(
    /** 1-based line number; 0 for whole-document failures. */
    public readonly line: number,
    message: string,
  ) {
    super(line > 0 ? `direction.md line ${line}: ${message}` : `direction.md: ${message}`);
    this.name = "DirectionMdParseError";
  }
}

const SCENE_HEADER = /^## Scene (\d+) — (.+)$/;

export function renderDirectionMd(input: DirectionDoc): string {
  // Fail-loud: an invalid doc must never render (the round-trip guarantee
  // only holds for schema-valid documents).
  const doc = directionDocSchema.parse(input);
  const lines: string[] = [
    "---",
    `doc: ${doc.docVersion}`,
    `title: ${doc.title}`,
    `aspect: ${doc.aspect}`,
    `fps: ${doc.fps}`,
    `pacing: ${doc.pacing}`,
    "---",
  ];
  for (const scene of doc.scenes) {
    lines.push(
      "",
      `## Scene ${scene.sceneIndex + 1} — ${scene.heading}`,
      "",
      `- narration: ${scene.narration}`,
      `- on-screen: ${scene.onScreenText ?? DIRECTION_NONE_SENTINEL}`,
      `- visual: ${scene.visual ?? DIRECTION_NONE_SENTINEL}`,
      `- motion: ${scene.motion}`,
      `- duration-ms: ${scene.durationMs}`,
    );
  }
  if (doc.cta !== null) lines.push("", "## CTA", "", doc.cta);
  return `${lines.join("\n")}\n`;
}

export function parseDirectionMd(md: string): DirectionDoc {
  if (md.includes("\r")) {
    throw new DirectionMdParseError(0, "CR found — direction.md is LF-only");
  }
  if (!md.endsWith("\n") || md.endsWith("\n\n")) {
    throw new DirectionMdParseError(0, "must end with exactly one trailing newline");
  }
  const lines = md.slice(0, -1).split("\n");
  let i = 0;

  const fail = (message: string): never => {
    throw new DirectionMdParseError(i + 1, message);
  };
  const next = (): string => {
    if (i >= lines.length) {
      throw new DirectionMdParseError(lines.length + 1, "unexpected end of document");
    }
    return lines[i++];
  };
  const expectLine = (exact: string): void => {
    const line = next();
    if (line !== exact) {
      i -= 1;
      fail(`expected "${exact}", got "${line}"`);
    }
  };
  const expectValue = (prefix: string): string => {
    const line = next();
    if (!line.startsWith(prefix) || line.length === prefix.length) {
      i -= 1;
      fail(`expected "${prefix}<value>", got "${line}"`);
    }
    return line.slice(prefix.length);
  };
  const expectInt = (prefix: string): number => {
    const raw = expectValue(prefix);
    if (!/^\d+$/.test(raw)) {
      i -= 1;
      fail(`expected "${prefix}" to carry a plain decimal integer, got "${raw}"`);
    }
    return Number(raw);
  };
  const expectEnum = <T extends string>(prefix: string, allowed: readonly T[]): T => {
    const raw = expectValue(prefix);
    if (!(allowed as readonly string[]).includes(raw)) {
      i -= 1;
      fail(`"${raw}" is not one of ${allowed.join(" | ")}`);
    }
    return raw as T;
  };
  /** The null sentinel is only meaningful on nullable fields. */
  const nullable = (value: string): string | null =>
    value === DIRECTION_NONE_SENTINEL ? null : value;

  expectLine("---");
  const docVersion = expectValue("doc: ");
  if (docVersion !== DIRECTION_DOC_VERSION) {
    i -= 1;
    fail(`unknown doc version "${docVersion}" (this parser reads ${DIRECTION_DOC_VERSION})`);
  }
  const title = expectValue("title: ");
  const aspect: DirectionAspect = expectEnum("aspect: ", DIRECTION_ASPECTS);
  const fps = expectInt("fps: ");
  const pacing: DirectionPacing = expectEnum("pacing: ", DIRECTION_PACINGS);
  expectLine("---");

  const scenes: DirectionScene[] = [];
  let cta: string | null = null;
  while (i < lines.length) {
    expectLine("");
    const header = next();
    if (header === "## CTA") {
      if (scenes.length === 0) {
        i -= 1;
        fail("the CTA section cannot precede the first scene");
      }
      expectLine("");
      cta = next();
      if (i < lines.length) fail("the CTA line must be the last line of the document");
      break;
    }
    const match = SCENE_HEADER.exec(header);
    if (!match) {
      // i already points past the header line, so it IS the 1-based header line number.
      throw new DirectionMdParseError(
        i,
        `expected "## Scene ${scenes.length + 1} — <heading>" or "## CTA", got "${header}"`,
      );
    }
    const [, number, heading] = match;
    if (Number(number) !== scenes.length + 1) {
      i -= 1;
      fail(`scene numbered ${number} where ${scenes.length + 1} was expected — scenes are contiguous from 1`);
    }
    expectLine("");
    const narration = expectValue("- narration: ");
    const onScreenText = nullable(expectValue("- on-screen: "));
    const visual = nullable(expectValue("- visual: "));
    const motion: DirectionMotion = expectEnum("- motion: ", DIRECTION_MOTIONS);
    const durationMs = expectInt("- duration-ms: ");
    scenes.push({
      sceneIndex: scenes.length,
      heading,
      narration,
      onScreenText,
      visual,
      motion,
      durationMs,
    });
  }

  if (scenes.length === 0) {
    throw new DirectionMdParseError(0, "a direction document has at least one scene");
  }

  // Belt-and-braces: the line machine built it, the schema still owns the
  // contract (line-length caps, trimmed values, sentinel reservation, …).
  try {
    return directionDocSchema.parse({ docVersion, title, aspect, fps, pacing, scenes, cta });
  } catch (err) {
    throw new DirectionMdParseError(
      0,
      `document parsed but violates the direction contract: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
