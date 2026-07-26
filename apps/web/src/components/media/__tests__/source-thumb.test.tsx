// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SourceThumb } from "@/components/media/source-thumb";
import type { MediaResolution } from "@/lib/media/resolve";

const AT = "2026-07-26T04:00:00.000Z";

function resolved(width?: number, height?: number, alt?: string): MediaResolution {
  return {
    state: "resolved",
    src: "https://cdn.test/a.jpg",
    envelope: {
      ref: { kind: "external", url: "https://cdn.test/a.jpg", ...(width && height ? { width, height } : {}) },
      provenance: "captured",
      capturedAt: AT,
      ...(alt ? { alt } : {}),
    },
    orientation: width && height ? (width > height ? "landscape" : "portrait") : "unknown",
  };
}

describe("SourceThumb — one box, five states", () => {
  /**
   * The whole reason this renders the SHARED box class rather than the
   * sheet's own `.tb`: four surfaces override `.thumb-sm`/`.thumb-md`
   * legitimately (Approve's margin, the editor's 118×68 takes, the video
   * dossier's 52×33, the site dossier's 148×92). Rendering anything else
   * would silently flatten all four.
   */
  it("renders the shared box class so per-surface size overrides keep applying", () => {
    const { container, rerender } = render(<SourceThumb resolution={{ state: "empty" }} />);
    expect(container.querySelector(".thumb-sm.src-thumb")).not.toBeNull();
    rerender(<SourceThumb resolution={{ state: "empty" }} size="md" />);
    expect(container.querySelector(".thumb-md.src-thumb")).not.toBeNull();
  });

  it("empty is the bare striped box carrying its legend", () => {
    render(<SourceThumb resolution={{ state: "empty" }} legend="article" />);
    expect(screen.getByText("article")).toBeInTheDocument();
  });

  it("loading reserves the box and announces itself as busy", () => {
    const { container } = render(<SourceThumb resolution={{ state: "loading" }} />);
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(container.querySelector(".src-thumb-shimmer")).not.toBeNull();
  });

  /** empty and broken are different facts and must never look alike. */
  it("broken says GONE and is visually distinct from empty", () => {
    const { container } = render(
      <SourceThumb
        resolution={{
          state: "broken",
          was: { ref: { kind: "external", url: "https://cdn.test/dead.jpg" }, provenance: "captured", capturedAt: AT },
        }}
        legend="video"
      />,
    );
    expect(screen.getByText("gone")).toBeInTheDocument();
    expect(screen.queryByText("video")).toBeNull();
    expect(container.querySelector(".src-thumb-broken")).not.toBeNull();
  });

  it("landscape covers; portrait contains against its own backdrop", () => {
    const { container, rerender } = render(<SourceThumb resolution={resolved(1280, 720)} />);
    expect(container.querySelector(".src-thumb-cover")).not.toBeNull();
    expect(container.querySelector(".src-thumb-backdrop")).toBeNull();

    rerender(<SourceThumb resolution={resolved(1080, 1920)} />);
    expect(container.querySelector(".src-thumb-contain")).not.toBeNull();
    expect(container.querySelector(".src-thumb-backdrop")).not.toBeNull();
  });

  it("unmeasured media keeps the default cover treatment", () => {
    const { container } = render(<SourceThumb resolution={resolved()} />);
    expect(container.querySelector(".src-thumb-cover")).not.toBeNull();
  });

  /**
   * The bug this component exists to kill: three shipped <img> blocks had no
   * onError, so a dead poster painted a browser broken-image glyph inside the
   * striped box — the one state that reads as a defect rather than an honesty.
   */
  it("flips a dead poster to broken instead of painting a browser glyph", () => {
    const { container } = render(<SourceThumb resolution={resolved(1280, 720)} />);
    const img = container.querySelector(".src-thumb-cover");
    expect(img).not.toBeNull();
    fireEvent.error(img!);
    expect(screen.getByText("gone")).toBeInTheDocument();
  });

  it("does not let one dead poster poison the next row that reuses the node", () => {
    const { container, rerender } = render(<SourceThumb resolution={resolved(1280, 720)} />);
    fireEvent.error(container.querySelector(".src-thumb-cover")!);
    expect(screen.getByText("gone")).toBeInTheDocument();

    rerender(
      <SourceThumb
        resolution={{ ...resolved(1280, 720), src: "https://cdn.test/fresh.jpg" } as MediaResolution}
      />,
    );
    expect(screen.queryByText("gone")).toBeNull();
    expect(container.querySelector(".src-thumb-cover")).not.toBeNull();
  });

  it("hides decorative media from the reader and announces it when alt is authored", () => {
    const { container, rerender } = render(<SourceThumb resolution={resolved(1280, 720)} />);
    expect(container.querySelector('.src-thumb-cover[aria-hidden="true"]')).not.toBeNull();

    rerender(<SourceThumb resolution={resolved(1280, 720, "A keynote stage")} />);
    expect(screen.getByAltText("A keynote stage")).toBeInTheDocument();
  });
});
