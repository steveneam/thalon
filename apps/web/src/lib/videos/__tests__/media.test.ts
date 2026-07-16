import { describe, expect, it } from "vitest";
import { parseByteRange, resolveMediaFile } from "../media";
import { mediaRootOf } from "../media-root";

const ROOT = "/data/projects/film";

describe("resolveMediaFile (the three walls)", () => {
  it("serves a clean project-relative media ref", () => {
    const r = resolveMediaFile(ROOT, "motion/keepers/clip-01.mp4");
    expect(r).toEqual({
      ok: true,
      absPath: "/data/projects/film/motion/keepers/clip-01.mp4",
      contentType: "video/mp4",
    });
  });

  it.each([
    ["/etc/passwd", "absolute"],
    ["../secrets.mp4", "parent traversal"],
    ["a/../../b.mp4", "nested traversal"],
    ["a\\b.mp4", "backslash"],
    ["a//b.mp4", "empty segment"],
    ["", "empty ref"],
  ])("refuses %s (%s) at the contract ref guard", (ref) => {
    const r = resolveMediaFile(ROOT, ref);
    expect(r.ok).toBe(false);
  });

  it.each(["build-9x16.sh", "index.md", "edl.json", "noext"])(
    "refuses non-media type %s",
    (ref) => {
      const r = resolveMediaFile(ROOT, ref);
      expect(r).toMatchObject({ ok: false, reason: "ref is not a servable media type" });
    },
  );
});

describe("mediaRootOf", () => {
  it("reads only an absolute-path string from meta.mediaRoot", () => {
    expect(mediaRootOf({ mediaRoot: "/data/p" })).toBe("/data/p");
    expect(mediaRootOf({ mediaRoot: "relative/p" })).toBeNull();
    expect(mediaRootOf({ mediaRoot: "/" })).toBeNull();
    expect(mediaRootOf({ mediaRoot: 42 })).toBeNull();
    expect(mediaRootOf({})).toBeNull();
    expect(mediaRootOf(null)).toBeNull();
  });
});

describe("parseByteRange", () => {
  it("parses the single-range forms video scrubbing sends", () => {
    expect(parseByteRange(null, 100)).toBeNull();
    expect(parseByteRange("bytes=0-49", 100)).toEqual({ start: 0, end: 49 });
    expect(parseByteRange("bytes=50-", 100)).toEqual({ start: 50, end: 99 });
    expect(parseByteRange("bytes=-30", 100)).toEqual({ start: 70, end: 99 });
    expect(parseByteRange("bytes=0-500", 100)).toEqual({ start: 0, end: 99 });
  });

  it("ignores malformed headers (→ 200 full) and flags unsatisfiable ones (→ 416)", () => {
    expect(parseByteRange("bytes=abc", 100)).toBeNull();
    expect(parseByteRange("bytes=-", 100)).toBeNull();
    expect(parseByteRange("bytes=9-5", 100)).toBeNull();
    expect(parseByteRange("bytes=0-49,60-99", 100)).toBeNull();
    expect(parseByteRange("bytes=100-", 100)).toBe("unsatisfiable");
    expect(parseByteRange("bytes=-0", 100)).toBe("unsatisfiable");
  });
});
