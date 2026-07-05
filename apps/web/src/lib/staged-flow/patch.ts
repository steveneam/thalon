import type { DirectionDoc, DirectionScene } from "@thalon/contracts";

/**
 * Minimal RFC-6902 (JSON Patch) support for the staged-flow surface (B5.4).
 * Every operator interaction is expressed as a patch and stored VERBATIM as
 * the edit_diff payload — the same convention the Hyperframes SDK emits
 * (typed ops + dispatch → RFC-6902 patches with inverses), so when the SDK
 * preview lands its patches drop into the identical capture field.
 *
 * This is deliberately not a general-purpose JSON Patch library: it applies
 * exactly the ops the builders below emit (plus whole-document add/replace
 * for candidate picks), fails LOUDLY on anything it cannot resolve, and
 * never mutates its input.
 */

export type Rfc6902Op =
  | { op: "add"; path: string; value: unknown }
  | { op: "remove"; path: string }
  | { op: "replace"; path: string; value: unknown }
  | { op: "move"; from: string; path: string }
  | { op: "copy"; from: string; path: string }
  | { op: "test"; path: string; value: unknown };

/** The interaction vocabulary — one kind per chip/control, so the eval rows can be sliced by interaction type. */
export type CapturedEditKind = "tweak" | "reorder" | "accept" | "preset" | "raw_md" | "pick";

export class PatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PatchError";
  }
}

/** RFC-6901 pointer segment escape (`~` → `~0`, `/` → `~1`). */
function escapeSegment(segment: string): string {
  return segment.replace(/~/g, "~0").replace(/\//g, "~1");
}

function unescapeSegment(segment: string): string {
  return segment.replace(/~1/g, "/").replace(/~0/g, "~");
}

export function pointer(...segments: (string | number)[]): string {
  return segments.map((s) => `/${escapeSegment(String(s))}`).join("");
}

function parsePointer(path: string): string[] {
  if (path === "") return [];
  if (!path.startsWith("/")) throw new PatchError(`invalid JSON pointer "${path}"`);
  return path.slice(1).split("/").map(unescapeSegment);
}

function clone<T>(value: T): T {
  return value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T);
}

/** Resolves a pointer's parent container + final key; throws on a missing intermediate. */
function resolveParent(root: unknown, path: string): { parent: unknown; key: string } {
  const segments = parsePointer(path);
  if (segments.length === 0) throw new PatchError(`"${path}" has no parent — handled by the caller`);
  let parent: unknown = root;
  for (const segment of segments.slice(0, -1)) {
    parent = child(parent, segment, path);
  }
  return { parent, key: segments[segments.length - 1] };
}

function child(container: unknown, key: string, path: string): unknown {
  if (Array.isArray(container)) {
    const index = arrayIndex(container, key, path, false);
    return container[index];
  }
  if (container !== null && typeof container === "object") {
    if (!(key in container)) throw new PatchError(`path "${path}" does not exist (missing "${key}")`);
    return (container as Record<string, unknown>)[key];
  }
  throw new PatchError(`path "${path}" traverses a non-container value at "${key}"`);
}

function arrayIndex(array: unknown[], key: string, path: string, allowEnd: boolean): number {
  if (key === "-") {
    if (!allowEnd) throw new PatchError(`"-" is only valid for add, in "${path}"`);
    return array.length;
  }
  if (!/^(0|[1-9]\d*)$/.test(key)) throw new PatchError(`"${key}" is not an array index, in "${path}"`);
  const index = Number(key);
  const max = allowEnd ? array.length : array.length - 1;
  if (index > max) throw new PatchError(`index ${index} out of bounds (length ${array.length}), in "${path}"`);
  return index;
}

function getAt(root: unknown, path: string): unknown {
  if (path === "") return root;
  const { parent, key } = resolveParent(root, path);
  return child(parent, key, path);
}

function addAt(root: unknown, path: string, value: unknown): unknown {
  if (path === "") return clone(value);
  const { parent, key } = resolveParent(root, path);
  if (Array.isArray(parent)) {
    parent.splice(arrayIndex(parent, key, path, true), 0, clone(value));
  } else if (parent !== null && typeof parent === "object") {
    (parent as Record<string, unknown>)[key] = clone(value);
  } else {
    throw new PatchError(`cannot add at "${path}" — parent is not a container`);
  }
  return root;
}

function removeAt(root: unknown, path: string): { root: unknown; removed: unknown } {
  if (path === "") throw new PatchError('cannot remove the whole document ("")');
  const { parent, key } = resolveParent(root, path);
  if (Array.isArray(parent)) {
    const index = arrayIndex(parent, key, path, false);
    return { root, removed: parent.splice(index, 1)[0] };
  }
  if (parent !== null && typeof parent === "object" && key in parent) {
    const record = parent as Record<string, unknown>;
    const removed = record[key];
    delete record[key];
    return { root, removed };
  }
  throw new PatchError(`cannot remove "${path}" — it does not exist`);
}

/** Applies `ops` in order to a deep copy of `target`; the input is never mutated. Throws PatchError with the failing op's index on any unresolvable op. */
export function applyPatch(target: unknown, ops: Rfc6902Op[]): unknown {
  let root = clone(target);
  ops.forEach((op, i) => {
    try {
      switch (op.op) {
        case "add":
          root = addAt(root, op.path, op.value);
          break;
        case "replace": {
          if (op.path === "") {
            root = clone(op.value);
            break;
          }
          // RFC 6902: replace requires the target to exist.
          getAt(root, op.path);
          const removed = removeAt(root, op.path);
          root = removed.root;
          root = addAt(root, op.path, op.value);
          break;
        }
        case "remove":
          root = removeAt(root, op.path).root;
          break;
        case "move": {
          const taken = removeAt(root, op.from);
          root = addAt(taken.root, op.path, taken.removed);
          break;
        }
        case "copy":
          root = addAt(root, op.path, getAt(root, op.from));
          break;
        case "test":
          if (JSON.stringify(getAt(root, op.path)) !== JSON.stringify(op.value)) {
            throw new PatchError(`test failed at "${op.path}"`);
          }
          break;
      }
    } catch (err) {
      throw new PatchError(`op ${i} (${op.op} ${"path" in op ? op.path : ""}): ${err instanceof Error ? err.message : String(err)}`);
    }
  });
  return root;
}

/** Replace ops for a set of changed fields under one base path — the shape every per-field tweak commits as. */
export function buildFieldReplaceOps(
  basePath: string,
  changes: Record<string, unknown>,
): Rfc6902Op[] {
  return Object.entries(changes).map(([field, value]) => ({
    op: "replace" as const,
    path: `${basePath}${pointer(field)}`,
    value,
  }));
}

/**
 * Field ops honoring OPTIONAL fields (storyboard's onScreenText/visualHint/
 * durationHintMs): `undefined` means absent, so absent→value is an add,
 * value→absent is a remove, value→value is a replace. `null` is a real
 * value (direction docs use it for nullable fields) and always replaces.
 * Unchanged fields emit nothing.
 */
export function buildFieldPatchOps(
  basePath: string,
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): Rfc6902Op[] {
  const ops: Rfc6902Op[] = [];
  for (const field of Object.keys(after)) {
    const prev = before[field];
    const next = after[field];
    if (prev === next) continue;
    const path = `${basePath}${pointer(field)}`;
    if (prev === undefined) ops.push({ op: "add", path, value: next });
    else if (next === undefined) ops.push({ op: "remove", path });
    else ops.push({ op: "replace", path, value: next });
  }
  return ops;
}

/**
 * A scene reorder as one honest patch: the move op plus the sceneIndex
 * repairs the contract demands (sceneIndex must equal array position —
 * schema-enforced), so applying the patch verbatim yields a schema-valid
 * document with no out-of-band normalization.
 */
export function buildSceneReorderOps(sceneCount: number, from: number, to: number): Rfc6902Op[] {
  if (from === to) return [];
  if (from < 0 || to < 0 || from >= sceneCount || to >= sceneCount) {
    throw new PatchError(`reorder ${from} → ${to} out of bounds for ${sceneCount} scenes`);
  }
  const ops: Rfc6902Op[] = [{ op: "move", from: pointer("scenes", from), path: pointer("scenes", to) }];
  const [lo, hi] = from < to ? [from, to] : [to, from];
  for (let i = lo; i <= hi; i++) {
    ops.push({ op: "replace", path: pointer("scenes", i, "sceneIndex"), value: i });
  }
  return ops;
}

const SCENE_FIELDS = [
  "sceneIndex",
  "heading",
  "narration",
  "onScreenText",
  "visual",
  "motion",
  "durationMs",
] as const satisfies readonly (keyof DirectionScene)[];

const DOC_SCALAR_FIELDS = ["title", "aspect", "fps", "pacing", "cta"] as const;

/**
 * Structured diff between two schema-valid direction documents → RFC-6902
 * ops such that applyPatch(before, ops) equals after. Used by the raw-md
 * editor view: the operator edits markdown, parseDirectionMd yields the new
 * doc, and THIS turns it into the machine-readable edit_diff payload. Field
 * comparisons are positional (scenes by index) — a reorder done in raw md
 * reads as per-field rewrites, which is honest: raw md carries no identity.
 */
export function diffDirectionDocs(before: DirectionDoc, after: DirectionDoc): Rfc6902Op[] {
  const ops: Rfc6902Op[] = [];
  for (const field of DOC_SCALAR_FIELDS) {
    if (before[field] !== after[field]) {
      ops.push({ op: "replace", path: pointer(field), value: after[field] });
    }
  }
  const shared = Math.min(before.scenes.length, after.scenes.length);
  for (let i = 0; i < shared; i++) {
    for (const field of SCENE_FIELDS) {
      if (before.scenes[i][field] !== after.scenes[i][field]) {
        ops.push({ op: "replace", path: pointer("scenes", i, field), value: after.scenes[i][field] });
      }
    }
  }
  for (let i = before.scenes.length - 1; i >= shared; i--) {
    ops.push({ op: "remove", path: pointer("scenes", i) });
  }
  for (let i = shared; i < after.scenes.length; i++) {
    ops.push({ op: "add", path: pointer("scenes", i), value: after.scenes[i] });
  }
  return ops;
}
