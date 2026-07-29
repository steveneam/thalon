import { pathToFileURL } from "node:url";
const puppeteer = (await import("puppeteer")).default;
const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 940, deviceScaleFactor: 2 });
await page.goto(pathToFileURL("/home/deploy/work/thalon/docs/research/mock-sheets/Composer.dc.html").href, { waitUntil: "networkidle0" });
const r = await page.evaluate(() => {
  const box = (el, n) => el ? { n, top: Math.round(el.getBoundingClientRect().top), bottom: Math.round(el.getBoundingClientRect().bottom), h: Math.round(el.getBoundingClientRect().height) } : { n, missing: true };
  const cards = [...document.querySelectorAll(".cmp-right > .card")].map((c,i)=>box(c,"card"+i));
  return {
    screen: box(document.querySelector(".screen"),"screen"),
    grid: box(document.querySelector(".cmp-grid"),"grid"),
    cards,
    pv: box(document.querySelector(".pv"),"pv"),
    actions: box(document.querySelector(".pv-actions"),"actions"),
    caveat: box(document.querySelector(".cmp-right .card:last-child > div > span.t-label"),"caveat"),
    tip: box(document.querySelector(".tip"),"tip"),
  };
});
console.log(JSON.stringify(r, null, 2));
await browser.close();
