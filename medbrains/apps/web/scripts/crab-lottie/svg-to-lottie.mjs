// Turns the crab mascot SVGs (apps/web/src/assets/mascot) into Lottie shape
// groups. It reads only what that art uses: g, path (M L C Q Z v h), circle,
// ellipse and line; translate/rotate/scale transforms; fill, stroke and
// opacity. Colours must be `var(--crab-*)` and become Lottie slots
// (`crab_*`), which dotLottie themes override.
// ponytail: a regex XML reader is enough for our own art; swap in a real
// parser if the art ever gains defs, gradients or text.

const TAG = /<(\/?)([a-zA-Z]+)([^>]*?)(\/?)>/g;
const ATTR = /([\w:-]+)="([^"]*)"/g;

/** Parses SVG text into `{ tag, attrs, children }` nodes. */
export function parseSvg(text) {
  const root = { tag: "root", attrs: {}, children: [] };
  const stack = [root];
  for (const [, close, tag, rawAttrs, selfClose] of text.matchAll(TAG)) {
    if (close) {
      stack.pop();
      continue;
    }
    const attrs = Object.fromEntries([...rawAttrs.matchAll(ATTR)].map(([, k, v]) => [k, v]));
    const node = { tag, attrs, children: [] };
    stack.at(-1).children.push(node);
    if (!selfClose) stack.push(node);
  }
  return root.children[0];
}

const prop = (k) => ({ a: 0, k });

/** A group transform; `extra` overrides any field with an animated one. */
export function tr(extra = {}) {
  return {
    ty: "tr",
    a: prop([0, 0]),
    p: prop([0, 0]),
    s: prop([100, 100]),
    r: prop(0),
    o: prop(100),
    sk: prop(0),
    sa: prop(0),
    ...extra,
  };
}

export const group = (nm, items, transform = tr()) => ({ ty: "gr", nm, it: [...items, transform] });

/** SVG transform list → nested groups, outermost first. */
function withTransform(nm, items, transformAttr) {
  const ops = [...(transformAttr ?? "").matchAll(/(translate|rotate|scale)\(([^)]*)\)/g)];
  let inner = items;
  for (const [, op, args] of ops.reverse()) {
    const n = args.split(/[\s,]+/).filter(Boolean).map(Number);
    let t;
    if (op === "translate") t = tr({ p: prop([n[0], n[1] ?? 0]) });
    else if (op === "scale") t = tr({ s: prop([n[0] * 100, (n[1] ?? n[0]) * 100]) });
    else t = tr({ a: prop([n[1] ?? 0, n[2] ?? 0]), p: prop([n[1] ?? 0, n[2] ?? 0]), r: prop(n[0]) });
    inner = [group(`${nm}:${op}`, inner, t)];
  }
  return inner;
}

function cubicFromQuad(p0, q, p1) {
  const c1 = [p0[0] + (2 / 3) * (q[0] - p0[0]), p0[1] + (2 / 3) * (q[1] - p0[1])];
  const c2 = [p1[0] + (2 / 3) * (q[0] - p1[0]), p1[1] + (2 / 3) * (q[1] - p1[1])];
  return [c1, c2];
}

/** Path `d` → Lottie bezier subpaths `{ c, v, i, o }` (tangents are relative). */
export function pathToBeziers(d) {
  const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e-?\d+)?/g);
  const subs = [];
  let cur = null;
  let pos = [0, 0];
  let i = 0;
  const num = () => Number(tokens[i++]);
  const pt = () => [num(), num()];
  const lineTo = (p) => {
    cur.v.push(p);
    cur.i.push([0, 0]);
    cur.o.push([0, 0]);
    pos = p;
  };
  const curveTo = (c1, c2, p) => {
    const last = cur.v.length - 1;
    cur.o[last] = [c1[0] - pos[0], c1[1] - pos[1]];
    cur.v.push(p);
    cur.i.push([c2[0] - p[0], c2[1] - p[1]]);
    cur.o.push([0, 0]);
    pos = p;
  };
  let cmd = "";
  while (i < tokens.length) {
    if (/[a-zA-Z]/.test(tokens[i])) cmd = tokens[i++];
    if (cmd === "M") {
      pos = pt();
      cur = { c: false, v: [pos], i: [[0, 0]], o: [[0, 0]] };
      subs.push(cur);
      cmd = "L";
    } else if (cmd === "L") lineTo(pt());
    else if (cmd === "v") lineTo([pos[0], pos[1] + num()]);
    else if (cmd === "h") lineTo([pos[0] + num(), pos[1]]);
    else if (cmd === "C") curveTo(pt(), pt(), pt());
    else if (cmd === "Q") {
      const q = pt();
      const p = pt();
      const [c1, c2] = cubicFromQuad(pos, q, p);
      curveTo(c1, c2, p);
    } else if (cmd === "Z" || cmd === "z") {
      closeSub(cur);
      cmd = "";
    } else throw new Error(`Unsupported path command "${cmd}" in ${d}`);
  }
  return subs;
}

function closeSub(sub) {
  sub.c = true;
  const n = sub.v.length - 1;
  const [a, b] = [sub.v[0], sub.v[n]];
  if (n > 0 && Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6) {
    sub.i[0] = sub.i[n];
    for (const k of ["v", "i", "o"]) sub[k].pop();
  }
}

const sh = (b) => ({ ty: "sh", d: 1, ks: prop(b) });

function shapesOf(node) {
  const a = node.attrs;
  const n = (k) => Number(a[k] ?? 0);
  switch (node.tag) {
    case "circle":
      return [{ ty: "el", d: 1, p: prop([n("cx"), n("cy")]), s: prop([n("r") * 2, n("r") * 2]) }];
    case "ellipse":
      return [{ ty: "el", d: 1, p: prop([n("cx"), n("cy")]), s: prop([n("rx") * 2, n("ry") * 2]) }];
    case "line":
      return [sh({ c: false, v: [[n("x1"), n("y1")], [n("x2"), n("y2")]], i: [[0, 0], [0, 0]], o: [[0, 0], [0, 0]] })];
    case "path":
      return pathToBeziers(a.d).map(sh);
    default:
      throw new Error(`Unsupported element <${node.tag}>`);
  }
}

/** `var(--crab-fill)` → slot colour property `crab_fill`. */
function colour(value, slots) {
  const m = /var\(--crab-([a-z]+)\)/.exec(value);
  if (!m) throw new Error(`Crab colours must be var(--crab-*), got "${value}"`);
  const sid = `crab_${m[1]}`;
  slots.add(sid);
  return { a: 0, k: [0, 0, 0, 1], sid };
}

const INHERITED = ["fill", "stroke", "stroke-width"];

/**
 * Converts a node tree to Lottie items. `wrap(node, items)` lets the caller
 * wrap any node (matched by id or class) in an animated group. Our art never
 * relies on SVG's default black fill, so an unset fill means none.
 */
export function convert(node, ctx, inherited = {}) {
  const own = node.attrs;
  const style = { ...inherited };
  for (const k of INHERITED) if (own[k] !== undefined) style[k] = own[k];
  const nm = own.id ?? own.class ?? node.tag;
  let items;
  if (node.tag === "g" || node.tag === "svg") {
    // Lottie draws earlier items on top; SVG draws later children on top.
    const kids = node.children.flatMap((c) => convert(c, ctx, style)).reverse();
    items = [group(nm, kids, tr({ o: prop(Number(own.opacity ?? 1) * 100) }))];
  } else {
    const opacity = Number(own.opacity ?? 1);
    const styles = [];
    if (style.stroke && style.stroke !== "none") {
      styles.push({
        ty: "st",
        c: colour(style.stroke, ctx.slots),
        o: prop(opacity * Number(own["stroke-opacity"] ?? 1) * 100),
        w: prop(Number(style["stroke-width"] ?? 1)),
        lc: 2,
        lj: 2,
        ml: 4,
      });
    }
    if (style.fill && style.fill !== "none") {
      styles.push({
        ty: "fl",
        c: colour(style.fill, ctx.slots),
        o: prop(opacity * Number(own["fill-opacity"] ?? 1) * 100),
        r: 1,
      });
    }
    items = [group(nm, [...shapesOf(node), ...styles])];
  }
  items = withTransform(nm, items, own.transform);
  return ctx.wrap(node, items);
}
