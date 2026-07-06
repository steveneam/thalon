import type { Metadata } from "next";
import {
  BrandLockup,
  MarkGrip,
  MarkGripSoft,
  MarkShells,
  Wordmark,
} from "@/components/brand/marks";

/**
 * Internal founder-review page (B6.1): the GRIP mark, read WARMLY — three
 * sail-like forms (founder direction 2026-07-06: "like the Sydney Opera
 * House sails but less sharp", one sail off-centre, never perfectly
 * symmetric) — in three interpretations at display and favicon scale, on
 * dark and light chips. The pick swaps the `BrandMark` alias in
 * components/brand/marks.tsx. Never indexed.
 */
export const metadata: Metadata = {
  title: "Brand — the grip mark",
  robots: { index: false, follow: false },
};

const CONCEPTS = [
  {
    name: "I · Grip",
    story:
      "Three soft sails leaning into a loose close — organic and warm, the talon implied rather than bared. The center sail rides tall and off-centre; no mirror symmetry anywhere.",
    Mark: MarkGrip,
  },
  {
    name: "II · Grip, softer — PICKED",
    story:
      "The founder's pick (2026-07-06): fuller bellies, blunted tips, and the off-centred right sail fattened so it survives favicon scale. This is the mark every surface now renders.",
    Mark: MarkGripSoft,
  },
  {
    name: "III · The shells",
    story:
      "The sails re-set ascending off a shared waterline, opera-house style — the warm form carrying the intel story: something rising, left to right.",
    Mark: MarkShells,
  },
] as const;

export default function BrandPage() {
  return (
    // Brand-review page keeps the dark-cinematic mood (scoped, like `/`).
    <div className="dark flex min-h-dvh flex-1 flex-col bg-background text-foreground">
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-16">
      <p className="u-eyebrow text-primary">Internal · B6.1</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">The grip mark</h1>
      <p className="mt-2 max-w-xl text-muted-foreground">
        Three warm readings of the grip — sail-like, off-balance on purpose, nothing menacing.
        Each is one color, drawn on a 32-grid, and holds up at favicon size. <strong>II is
        picked</strong>; I and III stay for the record. The wordmark stays either way.
      </p>

      <div className="mt-10 grid gap-6 md:grid-cols-3">
        {CONCEPTS.map(({ name, story, Mark }) => (
          <section key={name} aria-label={name} className="rounded-xl border bg-card p-6">
            <h2 className="u-eyebrow text-muted-foreground">{name}</h2>
            <div className="mt-4 flex h-40 items-center justify-center rounded-lg bg-background">
              <Mark className="size-24 text-primary" />
            </div>
            <div className="mt-3 flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-md bg-background">
                <Mark className="size-6 text-primary" />
              </span>
              <span className="flex size-10 items-center justify-center rounded-md bg-background">
                <Mark className="size-4 text-foreground" />
              </span>
              <span className="flex size-10 items-center justify-center rounded-md bg-[oklch(0.97_0.004_84)]">
                <Mark className="size-6 text-[oklch(0.55_0.118_70)]" />
              </span>
              <span className="ml-auto flex items-center gap-1.5 rounded-md bg-background px-2.5 py-2">
                <Mark className="size-4 text-primary" />
                <span className="text-xs font-bold tracking-[0.14em] uppercase">Thalon</span>
              </span>
            </div>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">{story}</p>
          </section>
        ))}
      </div>

      <section aria-label="Wordmark" className="mt-12 rounded-xl border bg-card p-6">
        <h2 className="u-eyebrow text-muted-foreground">Wordmark · kept</h2>
        <div className="mt-4 flex flex-wrap items-center gap-10">
          <Wordmark className="text-4xl" />
          <BrandLockup />
        </div>
      </section>
      </main>
    </div>
  );
}
