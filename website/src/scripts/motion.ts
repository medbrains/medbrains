// Scroll-linked motion, Apple-style, without a library: every element with
// `data-scroll` gets `--p`, its progress from 0 to 1, and CSS does the rest.
//   data-scroll="view"  0 as the top enters the viewport, 1 as the bottom leaves
//   data-scroll="pin"   0..1 through a tall section whose inner part is sticky
// A pinned section with `data-steps="N"` also gets `data-active` = the step.
// With reduced motion nothing moves: --p is fixed at 1 and steps show stacked.

const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const els = [...document.querySelectorAll<HTMLElement>("[data-scroll]")];
const clamp = (n: number) => Math.min(1, Math.max(0, n));

function progress(el: HTMLElement, vh: number): number {
  const r = el.getBoundingClientRect();
  if (el.dataset.scroll === "pin") return clamp(-r.top / Math.max(1, r.height - vh));
  return clamp((vh - r.top) / (vh + r.height));
}

let queued = false;
function update() {
  queued = false;
  const vh = innerHeight;
  for (const el of els) {
    const p = progress(el, vh);
    el.style.setProperty("--p", p.toFixed(4));
    const steps = Number(el.dataset.steps);
    if (steps) el.dataset.active = String(Math.min(steps - 1, Math.floor(p * steps)));
  }
}
const request = () => {
  if (!queued) { queued = true; requestAnimationFrame(update); }
};

if (reduce) {
  document.documentElement.classList.add("still");
  for (const el of els) el.style.setProperty("--p", "1");
} else {
  addEventListener("scroll", request, { passive: true });
  addEventListener("resize", request);
  update();
}

// Numbers count up once, when they come into view.
const counters = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    counters.unobserve(e.target);
    const el = e.target as HTMLElement;
    const target = Number(el.dataset.count);
    const suffix = el.dataset.suffix ?? "";
    if (reduce) continue;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 1400);
      const eased = 1 - (1 - t) ** 3;
      el.textContent = Math.round(target * eased).toLocaleString("en-IN") + suffix;
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
});
document.querySelectorAll<HTMLElement>("[data-count]").forEach((el) => counters.observe(el));

// Sections rise in as they arrive.
const reveal = new IntersectionObserver(
  (entries) => entries.forEach((e) => e.isIntersecting && (e.target.classList.add("in"), reveal.unobserve(e.target))),
  { rootMargin: "0px 0px -10% 0px" },
);
document.querySelectorAll(".reveal").forEach((el) => reveal.observe(el));
