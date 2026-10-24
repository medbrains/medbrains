// Builds the four crab mascots as dotLottie files: one animation per crab
// with a marker per mood (idle, thinking, happy, tap), a state machine that
// follows a `mood` string input and plays `tap` on pointer down, and light,
// dark and onBrand themes from the design-system colour roles.
//
//   node apps/web/scripts/build-crab-lottie.mjs
//
// Output: packages/design-system/src/assets/mascot/crab-<variant>.lottie, shared
// by the web app and (later) the native apps' dotLottie players.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DotLottie } from "@dotlottie/dotlottie-js";
import { ramps, roles } from "../../../packages/design-system/src/theme/colors.generated.ts";
import { convert, group, parseSvg, tr } from "./crab-lottie/svg-to-lottie.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const ART = join(here, "../src/assets/mascot");
const OUT = join(here, "../../../packages/design-system/src/assets/mascot");

const FPS = 30;
// Frames per mood. Every animated value is neutral on each boundary, so a
// mood change never jumps.
// The art's claws, hops and thinking dots reach past its box (the SVG shows
// them with overflow: visible), so the composition adds this margin on every
// side and the web player's canvas overhangs the crab's box by the same share.
export const PAD = 0.12;
const SEG = { idle: [0, 120], thinking: [120, 240], happy: [240, 300], tap: [300, 330] };
const END = SEG.tap[1];

// ── keyframe helpers ────────────────────────────────────────────────────────
const still = (k) => ({ a: 0, k });
const EASE = { o: 0.42, i: 0.58 };

/** `keys` = [[frame, value], …]; `hold` steps instead of easing. */
function anim(keys, hold = false) {
  const dims = Array.isArray(keys[0][1]) ? keys[0][1].length : 1;
  const arr = (v) => (Array.isArray(v) ? v : [v]);
  const fill = (v) => Array(dims).fill(v);
  return {
    a: 1,
    k: keys.map(([t, v], idx) =>
      idx === keys.length - 1
        ? { t, s: arr(v) }
        : hold
          ? { t, s: arr(v), h: 1 }
          : { t, s: arr(v), o: { x: fill(EASE.o), y: fill(0) }, i: { x: fill(EASE.i), y: fill(1) } },
    ),
  };
}

/** Alternates `a`/`b` every `step` frames across [from, to], ending on `a`. */
function swing(from, to, step, a, b) {
  const keys = [];
  for (let t = from, n = 0; t <= to; t += step, n++) keys.push([t, n % 2 ? b : a]);
  if (keys.at(-1)[0] !== to) keys.push([to, a]);
  keys[keys.length - 1][1] = a;
  return keys;
}

/** A smooth 0→1→0 pulse, sampled; phase in frames. */
function pulse(from, to, period, phase, lo, hi) {
  const keys = [];
  for (let t = from; t <= to; t += 5) {
    const x = (t - from - phase) / period;
    keys.push([t, lo + (hi - lo) * (0.5 - 0.5 * Math.cos(2 * Math.PI * x))]);
  }
  keys[0][1] = lo;
  keys[keys.length - 1][1] = lo;
  return keys;
}

const at = (pivot, extra) => tr({ a: still(pivot), p: still(pivot), ...extra });
const offset = (pivot, keys) => anim(keys.map(([t, [dx, dy]]) => [t, [pivot[0] + dx, pivot[1] + dy]]));
const visibleIn = (from, to) => anim([[0, 0], [from + 0.5, 100], [to - 0.5, 0], [END, 0]], true);
// Happy and tap share the end of the timeline, so their eyes switch once.
const fromHappy = (before, after) => anim([[0, before], [SEG.happy[0] + 0.5, after], [END, after]], true);

// ── motion per part ─────────────────────────────────────────────────────────
function bodyMotion(pivot, u) {
  const [b, h, j] = [3 * u, 8 * u, 12 * u];
  const hops = [];
  for (let t = SEG.happy[0]; t < SEG.happy[1]; t += 20) hops.push([t, [0, 0]], [t + 8, [0, -h]], [t + 16, [0, 0]]);
  return at(pivot, {
    p: offset(pivot, [
      [0, [0, 0]], [30, [0, -b]], [60, [0, 0]], [90, [0, -b]], [120, [0, 0]],
      [240, [0, 0]], ...hops.slice(1), [300, [0, 0]],
      [305, [0, 0]], [313, [0, -j]], [321, [0, 0]], [330, [0, 0]],
    ]),
    s: anim([
      [0, [100, 100]], [240, [100, 100]], [248, [97, 104]], [256, [104, 95]], [260, [100, 100]],
      [268, [97, 104]], [276, [104, 95]], [280, [100, 100]], [288, [97, 104]], [296, [104, 95]],
      [300, [100, 100]], [305, [107, 91]], [313, [95, 107]], [321, [104, 96]], [330, [100, 100]],
    ]),
    r: anim([[0, 0], [120, 0], [150, 4], [180, 0], [210, -4], [240, 0], [END, 0]]),
  });
}

/** Claw rotation; `sign` mirrors it for the right claw. */
function clawMotion(pivot, sign, tapsWhileThinking) {
  const s = (v) => v * sign;
  const thinking = tapsWhileThinking ? swing(120, 240, 18, 0, 10) : [[120, 0], [240, 0]];
  return at(pivot, {
    r: anim([
      [0, 0], [30, s(-12)], [60, 0], [90, s(-6)], [120, 0],
      ...thinking.slice(1),
      ...swing(240, 300, 5, 0, s(-16)).slice(1),
      [310, s(-26)], [322, s(-26)], [330, 0],
    ]),
  });
}

const BLINK = [[0, [100, 100]], [84, [100, 100]], [87, [100, 8]], [91, [100, 100]], [196, [100, 100]], [199, [100, 8]], [203, [100, 100]]];

const blinkMotion = (pivot) => at(pivot, { s: anim([...BLINK, [END, [100, 100]]]) });

const lookMotion = (dx, dy) =>
  tr({ p: anim([[0, [0, 0]], [120, [0, 0]], [132, [dx, dy]], [228, [dx, dy]], [240, [0, 0]], [END, [0, 0]]]) });

// ── variants ────────────────────────────────────────────────────────────────
/** Bounding box of a node's own shapes (no transforms; enough for pivots). */
function bbox(node) {
  const pts = [];
  const walk = (n) => {
    const a = n.attrs;
    if (n.tag === "circle") pts.push([+a.cx - +a.r, +a.cy - +a.r], [+a.cx + +a.r, +a.cy + +a.r]);
    if (n.tag === "path") for (const m of a.d.matchAll(/(-?[\d.]+)[ ,](-?[\d.]+)/g)) pts.push([+m[1], +m[2]]);
    n.children.forEach(walk);
  };
  walk(node);
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}

const hasClass = (n, c) => (n.attrs.class ?? "").split(/\s+/).includes(c);

function smallParts(eyeY) {
  return (n) => {
    if (hasClass(n, "bodyg")) return bodyMotion([50, 90], 1);
    if (hasClass(n, "claw-l")) { const b = bbox(n); return clawMotion([b.maxX, b.maxY], 1, false); }
    if (hasClass(n, "claw-r")) { const b = bbox(n); return clawMotion([b.minX, b.maxY], -1, true); }
    if (hasClass(n, "open-e")) return { ...blinkMotion([50, eyeY]), o: fromHappy(100, 0) };
    if (hasClass(n, "happy-e")) return tr({ o: fromHappy(0, 100) });
    if (hasClass(n, "pupil")) return lookMotion(1.6, -2.4);
    if (hasClass(n, "think-d")) return tr({ o: visibleIn(...SEG.thinking) });
    return null;
  };
}

function chibiParts(n) {
  switch (n.attrs.id) {
    case "root": return bodyMotion([256, 446], 5.12);
    case "arm_L": return clawMotion([132, 300], 1, false);
    case "arm_R": return clawMotion([132, 300], 1, true); // inside a mirrored group
    case "eyeball_L": return blinkMotion([202, 202]);
    case "eyeball_R": return blinkMotion([310, 202]);
    case "look_L":
    case "look_R": return lookMotion(7, -8);
    default: return null;
  }
}

const VARIANTS = {
  geometric: { file: "crab-geometric.svg", box: 100, parts: smallParts(30) },
  line: { file: "crab-line.svg", box: 100, parts: smallParts(29.5) },
  medic: { file: "crab-medic.svg", box: 100, parts: smallParts(54) },
  chibi: { file: "crab-chibi.svg", box: 512, parts: chibiParts },
};

/** The small art has thinking dots; the chibi gets the same three. */
const thinkDots = (box) => (box === 100 ? null : [[318, 170, 10], [348, 136, 14], [388, 100, 18]]);

function dotPulses(items) {
  // Each dot in a thinking group breathes in turn.
  return items.map((it, idx) => ({
    ...it,
    it: it.it.map((x) => (x.ty === "tr" ? { ...x, o: anim(pulse(...SEG.thinking, 40, idx * 8, 25, 100)) } : x)),
  }));
}

function buildAnimation(name, v) {
  const svg = parseSvg(readFileSync(join(ART, v.file), "utf8"));
  const slots = new Set();
  const ctx = {
    slots,
    wrap: (node, items) => {
      const t = v.parts(node);
      if (!t) return items;
      if (hasClass(node, "think-d")) items = items.map((g) => ({ ...g, it: [...dotPulses(g.it.slice(0, -1)), g.it.at(-1)] }));
      return [group(`motion:${node.attrs.id ?? node.attrs.class}`, items, t)];
    },
  };
  const shapes = convert(svg, ctx);
  const extra = thinkDots(v.box);
  if (extra) {
    const dots = extra.map(([cx, cy, r]) =>
      group("dot", [
        { ty: "el", d: 1, p: still([cx, cy]), s: still([r * 2, r * 2]) },
        { ty: "fl", c: { a: 0, k: [0, 0, 0, 1], sid: "crab_accent" }, o: still(100), r: 1 },
      ]),
    );
    shapes.unshift(group("thought", dotPulses(dots), tr({ o: visibleIn(...SEG.thinking) })));
  }
  const theme = THEMES.light;
  const pad = v.box * PAD;
  const size = v.box + 2 * pad;
  return {
    v: "5.12.0",
    nm: `crab-${name}`,
    fr: FPS,
    ip: 0,
    op: END,
    w: size,
    h: size,
    ddd: 0,
    assets: [],
    markers: Object.entries(SEG).map(([cm, [a, b]]) => ({ cm, tm: a, dr: b - a })),
    slots: Object.fromEntries([...slots, "crab_accent"].map((sid) => [sid, { p: still(theme[sid]) }])),
    layers: [
      {
        ddd: 0, ind: 1, ty: 4, nm: "crab", sr: 1, ao: 0, ip: 0, op: END, st: 0, bm: 0,
        ks: { o: still(100), r: still(0), p: still([0, 0, 0]), a: still([0, 0, 0]), s: still([100, 100, 100]) },
        shapes: [group("art", shapes, tr({ p: still([pad, pad]) }))],
      },
    ],
  };
}

// ── themes (design-system roles; the crab's eyes stay white in both) ────────
const rgba = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).concat(1);
function palette(r, onBrand) {
  const fill = onBrand ? r.onPrimary : r.primary;
  return {
    crab_fill: rgba(fill),
    crab_edge: rgba(fill),
    crab_accent: rgba(r.tertiaryBrand),
    crab_ink: rgba(ramps.Site.ink),
    crab_eye: rgba(ramps.Site.paper),
    crab_hole: rgba(onBrand ? r.primary : r.surface),
    crab_line: rgba(onBrand ? r.onPrimary : r.onSurface),
  };
}
const THEMES = { light: palette(roles.light, false), dark: palette(roles.dark, false), onBrand: palette(roles.light, true) };

// ── state machine ───────────────────────────────────────────────────────────
const MOODS = ["idle", "thinking", "happy"];
const toMood = (m, extra = []) => ({
  type: "Transition",
  toState: m,
  guards: [...extra, { type: "String", inputName: "mood", conditionType: "Equal", compareTo: m }],
});
const STATE_MACHINE = {
  initial: "idle",
  inputs: [
    { type: "String", name: "mood", value: "idle" },
    { type: "Event", name: "tap" },
    { type: "Event", name: "tapDone" },
  ],
  states: [
    ...MOODS.map((m) => ({
      type: "PlaybackState",
      name: m,
      animation: "crab",
      segment: m,
      loop: true,
      autoplay: true,
      transitions: [
        ...MOODS.filter((o) => o !== m).map((o) => toMood(o)),
        { type: "Transition", toState: "tap", guards: [{ type: "Event", inputName: "tap" }] },
      ],
    })),
    {
      type: "PlaybackState",
      name: "tap",
      animation: "crab",
      segment: "tap",
      loop: false,
      autoplay: true,
      transitions: MOODS.map((m) => toMood(m, [{ type: "Event", inputName: "tapDone" }])),
    },
  ],
  interactions: [
    { type: "PointerDown", actions: [{ type: "Fire", inputName: "tap" }] },
    { type: "OnComplete", stateName: "tap", actions: [{ type: "Fire", inputName: "tapDone" }] },
  ],
};

// ── pack ────────────────────────────────────────────────────────────────────
mkdirSync(OUT, { recursive: true });
for (const [name, v] of Object.entries(VARIANTS)) {
  const data = buildAnimation(name, v);
  const lottie = new DotLottie({ generator: "medbrains/build-crab-lottie" })
    .addAnimation({ id: "crab", data, initialTheme: "light" })
    .addStateMachine({ id: "crab", data: STATE_MACHINE });
  for (const [id, colours] of Object.entries(THEMES)) {
    lottie.addTheme({ id, data: { rules: Object.entries(colours).map(([rid, value]) => ({ id: rid, type: "Color", value })) } });
  }
  const buf = Buffer.from(await (await lottie.build()).toArrayBuffer());
  writeFileSync(join(OUT, `crab-${name}.lottie`), buf);
  console.log(`crab-${name}.lottie ${(buf.length / 1024).toFixed(1)} KB`);
}
