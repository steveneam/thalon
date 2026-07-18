/* Loopwell page instrument.
   Everything here measures THIS visit, in this browser only. There is no
   network call anywhere in this file, by design: the honesty line in the
   hero ("nothing leaves this page") is load-bearing. */
(() => {
  "use strict";

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  /* ---------- session counters (shared by recorder + readouts) ---------- */
  const t0 = performance.now();
  let pointerPx = 0;
  let events = 0;
  let lastX = null;
  let lastY = null;
  let activity = 0; // 0..1, decays; the pen's y-position source

  const bump = (amount) => {
    activity = Math.min(1, activity + amount);
    events += 1;
  };

  addEventListener(
    "pointermove",
    (e) => {
      if (lastX !== null) {
        const d = Math.hypot(e.clientX - lastX, e.clientY - lastY);
        pointerPx += d;
        activity = Math.min(1, activity + d / 900);
      }
      lastX = e.clientX;
      lastY = e.clientY;
    },
    { passive: true },
  );
  let lastScroll = scrollY;
  addEventListener(
    "scroll",
    () => {
      activity = Math.min(1, activity + Math.abs(scrollY - lastScroll) / 1200);
      lastScroll = scrollY;
    },
    { passive: true },
  );
  for (const type of ["pointerdown", "keydown", "touchstart"]) {
    addEventListener(type, () => bump(0.25), { passive: true });
  }

  /* ---------- readouts ---------- */
  const el = (id) => document.getElementById(id);
  const rElapsed = el("r-elapsed");
  const rScroll = el("r-scroll");
  const rPointer = el("r-pointer");
  const rEvents = el("r-events");

  const scrollPct = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    return max > 0 ? Math.round((scrollY / max) * 100) : 0;
  };

  // the closing band mirrors the hero recorder: the instrument closes the loop
  const sessionLine = el("session-line");
  const sElapsed = el("s-elapsed");
  const sScroll = el("s-scroll");
  const sPointer = el("s-pointer");
  let maxScrollPct = 0;

  const updateReadouts = () => {
    const s = Math.floor((performance.now() - t0) / 1000);
    const clock = `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
    rElapsed.textContent = clock;
    rScroll.textContent = `${scrollPct()}%`;
    rPointer.textContent = `${Math.round(pointerPx).toLocaleString("en")} px`;
    rEvents.textContent = String(events + Math.round(pointerPx / 160));
    maxScrollPct = Math.max(maxScrollPct, scrollPct());
    sElapsed.textContent = clock;
    sScroll.textContent = `${maxScrollPct}%`;
    sPointer.textContent = `${Math.round(pointerPx).toLocaleString("en")} px`;
  };
  updateReadouts();
  sessionLine.hidden = false;

  /* ---------- the strip-chart recorder ---------- */
  /* ---------- chart draw-ins (charts are visible by default; motion only
     adds — .predraw is applied here, never in static CSS, so no-JS visits
     and renderers where the observer never fires always see full charts) */
  const drawables = document.querySelectorAll(".drawable");
  if (!reduceMotion.matches && "IntersectionObserver" in window && drawables.length) {
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("drawn");
            io.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.35 },
    );
    for (const d of drawables) {
      if (d.getBoundingClientRect().top > innerHeight) {
        d.classList.add("predraw");
        io.observe(d);
      }
    }
    // Failsafe: nothing stays hidden if the observer never fires.
    setTimeout(() => drawables.forEach((d) => d.classList.add("drawn")), 2200);
  }

  const chart = document.getElementById("chart");
  const canvas = document.getElementById("trace");
  const fallback = chart.querySelector("svg.fallback");
  const liveLabel = document.getElementById("live-label");

  const liveNote = el("live-note");
  if (reduceMotion.matches || !canvas.getContext) {
    // Honest paused state: keep the static trace, say why, tick numbers slowly.
    liveLabel.textContent = "SESSION TRACE · RECORDER PAUSED (reduced motion)";
    liveNote.textContent =
      "The trace shown is a sample; the readouts are yours, measured in this browser only. Nothing leaves this page.";
    setInterval(updateReadouts, 2000);
    return;
  }

  liveNote.textContent = "This is you, measured in your browser just now. Nothing leaves this page.";
  fallback.remove();
  canvas.hidden = false;
  const ctx = canvas.getContext("2d");

  const css = getComputedStyle(document.documentElement);
  const inkSignal = css.getPropertyValue("--signal").trim();

  let w = 0;
  let h = 0;
  let dpr = 1;
  const samples = [];
  let maxSamples = 600;

  const resize = () => {
    dpr = Math.min(devicePixelRatio || 1, 2);
    const rect = chart.getBoundingClientRect();
    w = Math.round(rect.width);
    h = Math.round(rect.height);
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    maxSamples = Math.max(200, Math.floor(w / 2));
  };
  resize();
  addEventListener("resize", resize);

  // Seed with a flat lead-in, closing on a pen check (the calibration sweep
  // a real recorder runs at power-on) so the strip has character at load.
  // It is the instrument's own startup, not user data; readouts start at 0.
  for (let i = 0; i < maxSamples; i += 1) {
    const fromEnd = maxSamples - i;
    let v = 0.06;
    if (fromEnd < 90 && fromEnd >= 78) v = 0.06 + (90 - fromEnd) * 0.055; // rise
    else if (fromEnd < 78 && fromEnd >= 66) v = 0.72 - (78 - fromEnd) * 0.055; // fall
    else if (fromEnd < 58 && fromEnd >= 50) v = 0.06 + (58 - fromEnd) * 0.045; // echo
    else if (fromEnd < 50 && fromEnd >= 42) v = 0.42 - (50 - fromEnd) * 0.045;
    else if (fromEnd < 42) v = 0.06 + 0.012 * Math.sin(fromEnd / 3); // settle
    samples.push(Math.max(0.04, v));
  }

  let lastSample = 0;
  let raf = null;

  const frame = (now) => {
    // ~30 samples/sec: the strip advances at a readable recorder pace.
    if (now - lastSample > 33) {
      lastSample = now;
      const wobble = 0.02 * Math.sin(now / 700) + 0.015 * Math.sin(now / 231);
      samples.push(Math.max(0.04, Math.min(1, activity + 0.06 + wobble)));
      if (samples.length > maxSamples) samples.shift();
      activity *= 0.94; // the pen relaxes toward baseline
      updateReadouts();
    }

    ctx.clearRect(0, 0, w, h);
    const pad = 14;
    const usable = h - pad * 2;
    const step = w / (maxSamples - 1);

    ctx.beginPath();
    for (let i = 0; i < samples.length; i += 1) {
      const x = i * step;
      const y = pad + usable * (1 - samples[i]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = inkSignal;
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.stroke();

    // the pen head
    const headY = pad + usable * (1 - samples[samples.length - 1]);
    ctx.beginPath();
    ctx.arc(w - 1.5, headY, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = inkSignal;
    ctx.fill();

    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      cancelAnimationFrame(raf);
      raf = null;
    } else if (!raf) {
      lastSample = 0;
      raf = requestAnimationFrame(frame);
    }
  });

  /* ---------- event-log ticker (sample data, clearly labeled) ---------- */
  /* Step 3 aggregates step 2's stream live: each sample event that ticks in
     extends the reading's red line, so "events aggregate into readings" is
     shown, not said. This code runs only past the reduced-motion / no-canvas
     early return above — those visits (and no-JS) keep the complete line. */
  const aggLine = document.getElementById("agg-line");
  const aggPen = document.getElementById("agg-pen");
  let aggAdvance = null;
  if (aggLine && aggPen && aggLine.getTotalLength) {
    const aggTotal = aggLine.getTotalLength();
    let aggProgress = 0.55; // mid-trace at load: the trend reads at a glance
    const setAgg = () => {
      aggLine.style.strokeDashoffset = String(aggTotal * (1 - aggProgress));
      const p = aggLine.getPointAtLength(aggTotal * aggProgress);
      aggPen.setAttribute("cx", p.x.toFixed(1));
      aggPen.setAttribute("cy", p.y.toFixed(1));
    };
    aggLine.style.strokeDasharray = `${aggTotal} ${aggTotal}`;
    setAgg();
    // flush before enabling the transition, so load doesn't animate a retract
    void aggLine.getBoundingClientRect();
    aggLine.style.transition = "stroke-dashoffset 0.9s cubic-bezier(0.16, 1, 0.3, 1)";
    aggAdvance = () => {
      if (aggProgress >= 1) return;
      aggProgress = Math.min(1, aggProgress + 0.055);
      setAgg();
    };
  }

  const log = document.getElementById("eventlog");
  if (log) {
    const names = [
      ["session.start", "web"],
      ["feature.used", "export"],
      ["feature.used", "reports"],
      ["funnel.step", "invite"],
      ["feature.used", "api"],
      ["session.end", "12m 40s"],
      ["funnel.step", "first project"],
    ];
    let i = 0;
    const tick = () => {
      if (document.hidden) return;
      const rect = log.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > innerHeight) return; // only when seen
      // once live rows flow, retire the static seed rows so the clock reads
      // consistently top to bottom
      if (i === 0) log.querySelectorAll("[data-seed]").forEach((r) => r.remove());
      const [name, detail] = names[i % names.length];
      i += 1;
      const d = new Date();
      const hh = String(d.getHours()).padStart(2, "0");
      const mm = String(d.getMinutes()).padStart(2, "0");
      const ss = String(d.getSeconds()).padStart(2, "0");
      const row = document.createElement("div");
      row.innerHTML = `<time>${hh}:${mm}:${ss}</time><span class="ev-name">${name}</span> — ${detail}`;
      log.append(row);
      while (log.children.length > 6) log.firstElementChild.remove();
      if (aggAdvance) aggAdvance(); // the reading absorbs the event
    };
    setInterval(tick, 1600);
  }

})();
