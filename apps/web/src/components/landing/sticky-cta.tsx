"use client";

import { useEffect, useState } from "react";
import { BrandMark } from "@/components/brand/marks";

/**
 * §1 [+] sticky mini-CTA: a slim bar with one button, shown only while no
 * waitlist surface is on screen. The anchors are the STABLE wrappers in
 * page.tsx (`data-waitlist-anchor`), never the form itself — the form node
 * is swapped for the success card on signup, and observing a removed node
 * would bring the bar back over the very thing it points to.
 */
export function StickyCta() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const anchors = document.querySelectorAll("[data-waitlist-anchor]");
    if (anchors.length === 0) return;
    const visible = new Set<Element>();
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) visible.add(entry.target);
        else visible.delete(entry.target);
      }
      setShow(visible.size === 0);
    });
    anchors.forEach((a) => observer.observe(a));
    return () => observer.disconnect();
  }, []);

  return (
    <div
      aria-hidden={!show}
      className={`fixed inset-x-0 bottom-0 z-40 transition-transform duration-300 ${
        show ? "translate-y-0" : "pointer-events-none translate-y-full"
      }`}
    >
      <div className="border-t bg-background/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-2.5">
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            <BrandMark className="size-4 text-primary" />
            <span className="hidden sm:inline">Posts, videos, and pages from one prompt.</span>
          </span>
          <a
            href="#waitlist"
            tabIndex={show ? 0 : -1}
            className="shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-85"
          >
            Join the waitlist
          </a>
        </div>
      </div>
    </div>
  );
}
