// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { TakeAudition, resetAuditions } from "@/components/media/take-audition";

/**
 * s82 W2 — the audition seam, pinned before either lane consumes it. The
 * behaviours below are the ones the lanes are entitled to rely on, so they
 * live here rather than in whichever surface happens to wire it first.
 */

const PROJECT = "11111111-2222-3333-4444-555555555555";

afterEach(() => {
  cleanup();
  resetAuditions();
});

describe("<TakeAudition> — hear it before you commit to it", () => {
  it("rests as a play control that says what it would audition", () => {
    render(<TakeAudition projectId={PROJECT} refPath="music-candidates/bed-03.mp3" kind="audio" label="bed 03" />);
    const button = screen.getByRole("button", { name: "Audition bed 03" });
    // A verb living only in a title attribute reads as present to nobody —
    // the s81 accessible-name lesson, applied at the seam.
    expect(button).toHaveAttribute("aria-pressed", "false");
    // Nothing streams until asked: no media element is mounted at rest.
    expect(document.querySelector("audio")).toBeNull();
    expect(document.querySelector("video")).toBeNull();
  });

  it("plays through the guarded project media door, addressed by ref", () => {
    render(<TakeAudition projectId={PROJECT} refPath="music-candidates/bed-03.mp3" kind="audio" label="bed 03" />);
    fireEvent.click(screen.getByRole("button", { name: "Audition bed 03" }));

    const audio = document.querySelector("audio");
    expect(audio).not.toBeNull();
    expect(audio?.getAttribute("src")).toBe(
      `/api/videos/${PROJECT}/media?ref=${encodeURIComponent("music-candidates/bed-03.mp3")}`,
    );
    expect(audio).toHaveAttribute("controls");
    // The control now states the way back out, in its name and its state.
    expect(screen.getByRole("button", { name: "Stop auditioning bed 03" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("draws a <video> for motion and an <audio> for a bed", () => {
    const { rerender } = render(
      <TakeAudition projectId={PROJECT} refPath="motion/keepers/clip-01.mp4" kind="motion" label="take clip-01" />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Audition take clip-01" }));
    expect(document.querySelector("video")).not.toBeNull();
    expect(document.querySelector("audio")).toBeNull();

    resetAuditions();
    rerender(
      <TakeAudition projectId={PROJECT} refPath="music-candidates/bed-01.mp3" kind="audio" label="bed 01" />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Audition bed 01" }));
    expect(document.querySelector("audio")).not.toBeNull();
    expect(document.querySelector("video")).toBeNull();
  });

  it("stops when pressed again", () => {
    render(<TakeAudition projectId={PROJECT} refPath="music-candidates/bed-03.mp3" kind="audio" label="bed 03" />);
    fireEvent.click(screen.getByRole("button", { name: "Audition bed 03" }));
    fireEvent.click(screen.getByRole("button", { name: "Stop auditioning bed 03" }));
    expect(document.querySelector("audio")).toBeNull();
    expect(screen.getByRole("button", { name: "Audition bed 03" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("plays ONE at a time — nine beds over each other is not an audition", () => {
    render(
      <>
        <TakeAudition projectId={PROJECT} refPath="music-candidates/bed-01.mp3" kind="audio" label="bed 01" />
        <TakeAudition projectId={PROJECT} refPath="music-candidates/bed-02.mp3" kind="audio" label="bed 02" />
      </>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Audition bed 01" }));
    expect(document.querySelectorAll("audio")).toHaveLength(1);

    // Starting the second must stop the first, without either host arranging it.
    fireEvent.click(screen.getByRole("button", { name: "Audition bed 02" }));
    const playing = document.querySelectorAll("audio");
    expect(playing).toHaveLength(1);
    expect(playing[0].getAttribute("src")).toContain("bed-02.mp3");
    expect(screen.getByRole("button", { name: "Audition bed 01" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("says so when the file will not play, instead of leaving a dead button", () => {
    render(<TakeAudition projectId={PROJECT} refPath="music-candidates/gone.mp3" kind="audio" label="bed gone" />);
    fireEvent.click(screen.getByRole("button", { name: "Audition bed gone" }));
    fireEvent.error(document.querySelector("audio")!);

    // The media door 404s for a missing file or a project with no media root
    // on this box. A play button that silently does nothing is the dead door
    // this states instead.
    expect(screen.getByRole("status")).toHaveTextContent("bed unplayable");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("a tile recycled to another ref does not inherit the previous failure", () => {
    const { rerender } = render(
      <TakeAudition projectId={PROJECT} refPath="music-candidates/gone.mp3" kind="audio" label="bed gone" />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Audition bed gone" }));
    fireEvent.error(document.querySelector("audio")!);
    expect(screen.getByRole("status")).toHaveTextContent("bed unplayable");

    rerender(
      <TakeAudition projectId={PROJECT} refPath="music-candidates/bed-07.mp3" kind="audio" label="bed 07" />,
    );
    // One dead bed must not poison every row that reuses the node.
    expect(screen.getByRole("button", { name: "Audition bed 07" })).toBeInTheDocument();
  });

  it("a recycled tile lands AT REST — it never inherits the audition and streams unasked", () => {
    // The defect this pins: keying the one-at-a-time slot on the component
    // alone meant re-pointing an instance at a different candidate carried the
    // playing state across, so a list that recycled its nodes would start
    // playing a file nobody asked to hear. The slot records the ref it was
    // started for, so a changed ref is at rest by construction.
    const { rerender } = render(
      <TakeAudition projectId={PROJECT} refPath="music-candidates/bed-01.mp3" kind="audio" label="bed 01" />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Audition bed 01" }));
    expect(document.querySelector("audio")).not.toBeNull();

    rerender(
      <TakeAudition projectId={PROJECT} refPath="music-candidates/bed-02.mp3" kind="audio" label="bed 02" />,
    );
    expect(document.querySelector("audio")).toBeNull();
    expect(screen.getByRole("button", { name: "Audition bed 02" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("an unplayable audition hands the slot back, so the next candidate can still play", () => {
    render(
      <>
        <TakeAudition projectId={PROJECT} refPath="music-candidates/gone.mp3" kind="audio" label="bed gone" />
        <TakeAudition projectId={PROJECT} refPath="music-candidates/bed-02.mp3" kind="audio" label="bed 02" />
      </>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Audition bed gone" }));
    fireEvent.error(document.querySelector("audio")!);

    fireEvent.click(screen.getByRole("button", { name: "Audition bed 02" }));
    const playing = document.querySelectorAll("audio");
    expect(playing).toHaveLength(1);
    expect(playing[0].getAttribute("src")).toContain("bed-02.mp3");
  });

  it("releases the slot when it unmounts mid-audition", () => {
    const { unmount } = render(
      <TakeAudition projectId={PROJECT} refPath="music-candidates/bed-01.mp3" kind="audio" label="bed 01" />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Audition bed 01" }));
    unmount();

    // A slot held by a component that no longer exists would leave the next
    // audition unable to start.
    render(
      <TakeAudition projectId={PROJECT} refPath="music-candidates/bed-02.mp3" kind="audio" label="bed 02" />,
    );
    const next = screen.getByRole("button", { name: "Audition bed 02" });
    fireEvent.click(next);
    expect(document.querySelectorAll("audio")).toHaveLength(1);
  });

  it("escapes a ref with characters a URL would otherwise eat", () => {
    render(
      <TakeAudition
        projectId={PROJECT}
        refPath="music-candidates/bed 03 (final).mp3"
        kind="audio"
        label="bed 03 final"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Audition bed 03 final" }));
    expect(document.querySelector("audio")?.getAttribute("src")).toBe(
      `/api/videos/${PROJECT}/media?ref=${encodeURIComponent("music-candidates/bed 03 (final).mp3")}`,
    );
  });
});
