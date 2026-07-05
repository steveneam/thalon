import { directionDocSchema, type DirectionDoc } from "../direction-doc";

/** Shared valid-document fixture for the direction contract tests (not a test file — vitest must not collect it). */
export function validDoc(overrides: Partial<DirectionDoc> = {}): DirectionDoc {
  return directionDocSchema.parse({
    docVersion: "direction.v1",
    title: "What the product does",
    aspect: "16:9",
    fps: 30,
    pacing: "medium",
    scenes: [
      {
        sceneIndex: 0,
        heading: "Hook",
        narration: "The one thing to know.",
        onScreenText: "One thing",
        visual: null,
        motion: "smooth",
        durationMs: 3000,
      },
      {
        sceneIndex: 1,
        heading: "Why it matters",
        narration: "Because it saves the operator an hour a day.",
        onScreenText: null,
        visual: null,
        motion: "snappy",
        durationMs: 4000,
      },
    ],
    cta: null,
    ...overrides,
  });
}
