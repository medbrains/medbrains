#!/usr/bin/env node
/**
 * Writes docs/CONVERSIONS.md from the converter's own tables, so the document and the code
 * cannot drift: mapping.json (rules), mantine-defaults.json (defaults applied), the Slint
 * reference and kit declarations (target types), and the web app's usage counts (bin/usage.mjs).
 *
 *   conversions-doc [--web apps/web/src] [--out docs/CONVERSIONS.md]
 */
import fs from "node:fs";
import path from "node:path";
import { DEFAULTS, loadMapping } from "../src/convert.mjs";
import { REFERENCE } from "../src/values.mjs";
import { countUsage } from "./usage.mjs";

const HERE = path.dirname(new URL(import.meta.url).pathname);
const PKG = path.resolve(HERE, "..");
const SLINT = "https://releases.slint.dev/1.18.0/docs/slint";
const KIT = "../preview/kit.slint";
const esc = (s) => String(s).replace(/\|/g, "\\|").replace(/\n/g, " ");

/** `.tsx` files of the web app, without tests and stories. */
function tsxFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? tsxFiles(p) : p.endsWith(".tsx") && !/\.(test|stories)\.tsx$/.test(p) ? [p] : [];
  });
}

/** Mantine documentation URL for a rule's `mantine` path. */
const mantineUrl = (p) => (p ? `https://mantine.dev/${p.startsWith("x/") ? p : p}/` : null);

/** A Slint element's reference page, or the kit file for a kit component. */
function slintLink(name) {
  const el = REFERENCE.elements[name];
  if (el) return `[${name}](${el.doc})`;
  if (name.startsWith("Mb")) return `[${name}](${KIT})`;
  return name;
}

/** The type the target declares, for the table. */
function typeOf(types, slint, prop) {
  const p = types.describe(slint).properties[prop.replace(/!$/, "")];
  const cb = types.describe(slint).callbacks[prop];
  if (cb !== undefined) return `callback(${cb})`;
  return p ? p.type : "?";
}

function componentRows(mapping, usage) {
  const rows = [];
  const byTag = new Map();
  for (const [key, u] of Object.entries(usage)) {
    const [lib, tag] = key.split(" ");
    const entry = byTag.get(tag) ?? { libs: new Set(), count: 0, props: {} };
    entry.libs.add(lib);
    entry.count += u.count;
    for (const [p, n] of Object.entries(u.props)) entry.props[p] = (entry.props[p] ?? 0) + n;
    byTag.set(tag, entry);
  }
  for (const [tag, u] of [...byTag].sort((a, b) => b[1].count - a[1].count)) {
    const lib = [...u.libs].includes("seam") ? "seam" : "mantine";
    const rule = mapping.rules[`${lib}:${tag}`] ?? mapping.rules[tag] ?? (tag.includes(".") ? { slint: "_passthrough", props: {}, inherited: tag.split(".")[0] } : null);
    if (!rule) {
      rows.push(`| \`${tag}\` (${[...u.libs].join(", ")}) | ${u.count} | not mapped | | reported as unmapped | |`);
      continue;
    }
    const target = rule.slint === "_passthrough" ? "children only" : rule.wrapping || rule.grid ? `${slintLink(rule.slint)} (see layouts)` : slintLink(rule.slint);
    const used = Object.entries(u.props).sort((a, b) => b[1] - a[1]).map(([p]) => p);
    const mapped = [];
    const gaps = [];
    for (const p of used) {
      const to = rule.props?.[p];
      if (typeof to === "string" && !to.startsWith("_")) mapped.push(`\`${p}\` → \`${to.replace(/!$/, "")}\`${to.endsWith("!") ? " (negated)" : ""}: ${typeOf(mapping.types, rule.slint === "_passthrough" ? "VerticalLayout" : rule.slint, to)}`);
      else if (rule.handled?.[p]) mapped.push(`\`${p}\`: ${rule.handled[p]}`);
      else if (rule.gaps?.[p]) gaps.push(`\`${p}\`: ${rule.gaps[p]}`);
      else if (mapping.styleProps[p] || mapping.commonProps[p]) continue;
      else if (mapping.commonProps[`_${p}`]) gaps.push(`\`${p}\`: ${mapping.commonProps[`_${p}`]}`);
      else if (p !== "children" && p !== "{...}") gaps.push(`\`${p}\`: no Slint equivalent, dropped with a note`);
    }
    if (rule.text) mapped.push(`children → \`${rule.text}\` (text)`);
    if (rule.iconChild) mapped.push(`icon child → \`${rule.iconChild}\` (image)`);
    for (const [k, v] of Object.entries(rule.fixed ?? {})) mapped.push(`always \`${k}: ${v}\``);
    const defaults = DEFAULTS[lib === "seam" ? "seam" : "components"][tag] ?? DEFAULTS.components[tag];
    const defText = defaults ? Object.entries(defaults).filter(([k]) => rule.props?.[k] || mapping.styleProps[k]).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(", ") : "";
    const docs = [mantineUrl(rule.mantine) && `[Mantine](${mantineUrl(rule.mantine)})`, ...(rule.uses ?? []).map(slintLink), REFERENCE.elements[rule.slint] ? `[Slint](${REFERENCE.elements[rule.slint].doc})` : null].filter(Boolean).join(", ");
    rows.push(`| \`${tag}\` (${[...u.libs].join(", ")}) | ${u.count} | ${target}${rule.rust ? `, marks \`rust: ${rule.rust}\`` : ""} | ${esc(mapped.slice(0, 14).join("; ")) || "children"}${defText ? `<br>defaults: ${esc(defText)}` : ""} | ${esc(gaps.slice(0, 10).join("; "))} | ${docs} |`);
  }
  return rows;
}

function styleRows(mapping) {
  return Object.entries(mapping.styleProps).filter(([k]) => !k.startsWith("_")).map(([k, v]) => {
    const how = typeof v === "string" ? `\`${v}\`` : Array.isArray(v) ? v.map((s) => `\`${s}\``).join(" and ") : v.margin ? `padding of a wrapping layout (${v.margin.join(", ")})` : v.background ? "`background`, or a wrapping Rectangle on a layout" : v.transform ? "`to-uppercase()` / `to-lowercase()` on the text" : v.clamp ? "`max-lines` + `overflow: elide` (lineClamp); `wrap: no-wrap` + `elide` (truncate)" : v.visibleFrom || v.hiddenFrom ? "an `if` on `Tokens.viewport-width` against `Tokens.breakpoint-*`" : `\`${v.to}\` (${v.kind})`;
    return `| \`${k}\` | ${how} |`;
  });
}

export function conversionsDoc({ webSrc }) {
  const mapping = loadMapping();
  const usage = countUsage(tsxFiles(webSrc));
  const commons = Object.entries(mapping.commonProps).filter(([k]) => !k.startsWith("_") || k.length > 1).map(([k, v]) => (k.startsWith("_") ? `| \`${k.slice(1)}\` | not converted: ${v} |` : `| \`${k}\` | \`${v}\` |`)).filter((r) => !r.includes("`doc`"));
  return `# React + Mantine to Slint: conversions

Generated by \`bin/conversions-doc.mjs\` from \`src/mapping.json\` (mapping version ${mapping.version}), \`src/mantine-defaults.json\`, \`src/slint-reference.json\` and the kit's own declarations. Do not edit by hand: change the tables and regenerate. Counts are uses in \`apps/web/src\` (\`bin/usage.mjs\`).

Sources: Mantine 9.3.2 (\`node_modules/@mantine/*\`, https://mantine.dev and its LLM pages https://mantine.dev/llms.txt), Slint 1.18 (reference ${SLINT}/reference/overview/; the 1.18.1 viewer compiles against it).

## How a value converts

Every value is written with the type the Slint property declares: builtin and std-widget types from the [Slint reference](${SLINT}/reference/overview/), kit types parsed from \`preview/*.slint\` (following \`inherits\`). Mantine's own default props, then the app theme's \`components.<Name>.defaultProps\`, then the seam wrapper's defaults apply before the source's props ([default props](https://mantine.dev/theming/default-props/)).

| Kind | Rule | Slint doc |
|---|---|---|
| length | number → px (Mantine \`rem(n)\` is n px at the 16 px root); \`Npx\`; \`Nrem\` × 16; theme key \`xs\`…\`5xl\` → \`Tokens.space-*\` (or \`Tokens.font-*\` for font sizes); \`N%\` only on width, height and preferred sizes; \`auto\`, \`calc()\`, \`vh\`, \`var()\` dropped | [numeric types](${SLINT}/reference/property-types/numeric-types/), [type conversions](${SLINT}/reference/language/type-conversions/) |
| colour | \`c="red"\` → \`--mantine-color-red-text\`, \`red.6\` → \`--mantine-color-red-6\`, \`dimmed\`, \`var(--mb-*)\` → the semantic token with the same light and dark value (\`src/css-vars.json\`, measured from the built app); raw hex and unmatched shades dropped | [colors and brushes](${SLINT}/reference/property-types/colors-and-brushes/) |
| enum | CSS keyword → Slint enum value, qualified (\`LayoutAlignment.start\`) so a property named \`start\` cannot shadow it; checked against the reference | [builtin enums](${SLINT}/reference/property-types/builtin-enums/) |
| int, float, bool, string | literal of the declared type; text → \`@tr("English sentence", …)\` | [strings](${SLINT}/reference/property-types/strings/), [translations](${SLINT}/guide/development/translations/) |
| image | a Tabler icon element → \`@image-url("@medbrains-gui-kit/icons/<name>.svg")\` drawn with \`colorize\` | [images](${SLINT}/reference/property-types/images/), [Image](${SLINT}/reference/elements/image/) |
| anything else | a typed \`in\` property for the view model | [properties](${SLINT}/reference/language/properties/) |

Theme scale (tokens.ts, mantine.ts → \`preview/tokens.slint\`): spacing 3xs 4, 2xs 8, xs 10, sm 12, md 16, lg 20, xl 24 px; font xs 13, sm 14, md 17, lg 19, xl 21 px; headings h1–h6 33/27/23/21/19/17 px; input heights sm 32, md 40, lg 48; button heights xs 24 … xl 64; radius 0 everywhere (Carbon); breakpoints xs 576 … xl 1408 px.

## Style props (all components)

[Mantine style props](https://mantine.dev/styles/style-props/) · [Slint layouts](${SLINT}/reference/layouts/overview/) · [Text](${SLINT}/reference/elements/text/)

| Mantine | Slint |
|---|---|
${styleRows(mapping).join("\n")}

Responsive values (\`cols={{ base: 1, md: 3 }}\`) become one expression on \`Tokens.viewport-width\`; the app sets it from the window width ([responsive styles](https://mantine.dev/styles/responsive/)).

## Common props

| Prop | Slint |
|---|---|
${commons.join("\n")}

## Components

One row per component the web app renders. "Defaults" are the Mantine, theme or seam defaults the converter applies when the prop is absent.

| Component | Uses | Slint | Props mapped (type) | No equivalent, and how it is handled | Docs |
|---|---|---|---|---|---|
${componentRows(mapping, usage).join("\n")}

## Layouts

- **Stack** → \`VerticalLayout\` with \`alignment: start\` (CSS flex-start; Slint's default would stretch).
- **Group** → \`HorizontalLayout\`, cross axis centred. Mantine's Group wraps when its row overflows; Slint's [FlexboxLayout](${SLINT}/reference/layouts/flexboxlayout/) reports a one-column preferred width inside a row, so it would wrap where the web does not. The one case that differs is a Group too wide for its row.
- **SimpleGrid / Grid** with written-out children → [GridLayout](${SLINT}/reference/layouts/gridlayout/): compile-time row and column per child, equal columns, \`Grid.Col span\` as \`colspan\`; a responsive \`cols\`/\`span\` becomes one GridLayout per breakpoint range under \`if\`. Over a list (\`.map\`) → rows of \`cols\` equal cells (\`for grid-row … for grid-col\`), never widths read from the grid (a binding loop).
- **Flex** → \`HorizontalLayout\`, or \`FlexboxLayout\` with \`wrap="wrap"\`.
- **CSS modules** (\`className={classes.x}\`): plain \`.class\` rules convert width/min/max sizes, \`min(Npx, 100%)\`, flex grow, gap, padding, justify-content, align-items, token colours, font size and weight, text-transform and a card's left accent; every other declaration is noted in the file.

## Hooks and patterns

| React | Slint today | Doc |
|---|---|---|
| \`useState\` | \`in-out property\` with the starting value; setter calls with a literal, \`!v\` or \`(v) => !v\` become assignments in the handler | [properties](${SLINT}/reference/language/properties/), [reactivity](${SLINT}/guide/language/concepts/reactivity/) |
| \`useDisclosure\` | \`opened\` is an \`in-out\` bool; \`open\`, \`close\`, \`toggle\` assign true, false, not | |
| \`value\` + \`onChange\` on state | two-way binding \`<=>\` | [two-way bindings](${SLINT}/reference/language/two-way-bindings/) |
| \`useMemo\`, \`useCallback\` | \`in\` property computed by the view model; marked \`rust: derived\` | |
| react-hook-form \`register("x")\` | \`text <=> root.form-x\` (\`in-out\`) ; \`Controller\` converts what \`render\` returns; \`useForm\` marked \`rust: form\` | |
| TanStack Query | values become \`in\` properties; \`useQuery\`/\`useMutation\` marked \`rust: query\`/\`mutation\` | |
| conditions \`a && <X/>\`, \`a ? <X/> : <Y/>\` | \`if\` blocks; in text, a Slint conditional expression | [repetition and conditionals](${SLINT}/reference/language/repetition-and-conditional-elements/) |
| early \`if (c) return <X/>\` | a branch under \`if\`, every earlier condition negated; the main view when none applies | same |
| \`list.map(...)\` and \`key\` | \`for item in root.list\`; \`key\` is React's diffing and has no Slint counterpart (models track rows) | same |
| children and slots | our components end in \`@children\`; JSX children of a kit control go where its \`@children\` is | [container components](${SLINT}/reference/language/container-components/) |
| props of our components | pass 1 records each component's properties; pass 2 passes matching attributes with their declared type; destructured defaults start the property | |
| refs | marked \`rust: ref\` | |
| \`Modal\` / \`Drawer\` | \`MbModal\` mounted under \`if opened\` (Mantine keepMounted=false); Escape closes; content drawn in place because a [PopupWindow](${SLINT}/reference/window/popupwindow/) cannot take bound content from outside (slint #4438) | |
| \`Menu\` | [ContextMenuArea + Menu + MenuItem](${SLINT}/reference/window/contextmenuarea/): Slint draws the popup and handles arrows, Enter, Escape, disabled items; a button target opens it from its own \`clicked\` | |
| \`Tabs\` with state or \`defaultValue\` | \`MbTab\` rows setting the tab property; each panel under \`if tab == value\` | |
| \`Table\` | [StandardTableView](${SLINT}/reference/std-widgets/views/standardtableview/) with columns from the header cells; rows come from the view model | |
| Tabler icons | SVG files copied from \`@tabler/icons\` into \`preview/icons\` (stroke variants rewritten), \`@image-url\` + \`colorize\` | [Image](${SLINT}/reference/elements/image/) |
| translations | \`t("k")\` → \`@tr("English")\`; \`{{name}}\` → \`{}\` with values in order; literal braces escaped | [translations](${SLINT}/guide/development/translations/) |

## React lifecycle and web APIs

Lines marked \`// rust: <kind>\` in a generated file are counted in the report ("moves to Rust view models"). Nothing is dropped silently.

| Web | Converter today | Should, and where |
|---|---|---|
| \`useEffect(fn, [])\` | \`callback effect-N(); init => { root.effect-N(); }\` | done; the view model implements the callback ([init](${SLINT}/reference/language/functions/)) |
| \`useEffect(fn, [state])\` | one \`changed <prop> => { … }\` per state property, calling each effect in order | done for local state; other dependencies marked \`rust: effect\` for the view model |
| \`useEffect\` without deps | marked \`rust: effect\` (runs after every render on the web) | view model |
| effect cleanup (\`return () => …\`) | marked \`rust: cleanup\` | the view model releases in its teardown |
| \`setInterval(fn, ms)\` / \`setTimeout(fn, ms)\` with a literal delay | [Timer](${SLINT}/reference/timer/) \`{ interval; running; triggered }\`, a timeout stops itself | done; computed delays marked \`rust: timer\` |
| \`useRef\` | marked \`rust: ref\` | view model (element focus via \`FocusScope.focus()\` in the kit) |
| context and providers | providers render their children; \`useContext\` marked \`rust: context\` | view model, or a Slint [global](${SLINT}/reference/language/globals/) |
| list \`key\` | not converted (React diffing) | none needed |
| \`Suspense\`, \`lazy\` | dropped wrappers: Slint compiles every screen ahead of time | none needed |
| error boundaries | render their children | the view model shows a fallback state |
| portals, \`Modal\` | portals dropped; \`Modal\` → \`MbModal\` under \`if\` | a PopupWindow-based dialog once Slint lets popups take bound content |
| router, URL, params | the app shell's \`route\` property and \`Shell\` global (route, crumb, module badge); \`useNavigate\`/\`useParams\` marked \`rust: route\` | the view model owns the route |
| \`fetch\`, TanStack Query | marked \`rust: fetch\`/\`query\`/\`mutation\` | Rust view model |
| \`localStorage\` | marked \`rust: storage\` | Rust persistence |
| resize, media queries | \`hiddenFrom\`/\`visibleFrom\`/responsive props read \`Tokens.viewport-width\`; \`matchMedia\` marked \`rust: media\` | done for props |
| CSS transitions, keyframes | not converted (CSS) | kit \`animate\` with \`Metrics.fast\`, which is 0 ms when \`Metrics.reduced-motion\` is set ([animations](${SLINT}/reference/language/animations/), [states](${SLINT}/reference/language/states-and-transitions/)) |
| focus, keyboard, shortcuts | kit controls use [FocusScope](${SLINT}/reference/keyboard-input/focusscope/) (Tab order, Enter/Space, arrows, Escape); \`addEventListener\` marked \`rust: event\`, \`useHotkeys\` marked \`rust: shortcut\` | shortcuts as FocusScope key handlers or MenuBar shortcuts |
| clipboard | marked \`rust: clipboard\` | Rust, through the DLP policy (copy restriction applies as on the web) |
| print | marked \`rust: print\` | Rust print path |
| file upload | \`FileInput\`/\`FileButton\` → \`MbFileInput\` (\`picked\` callback), marked \`rust: file\` | native file dialog in Rust |
| download | marked \`rust: download\` | Rust |
| drag and drop | dnd-kit wrappers render children, marked \`rust: drag-drop\` | Slint 1.18 has [DragArea](${SLINT}/reference/drag-and-drop/dragarea/) and [DropArea](${SLINT}/reference/drag-and-drop/droparea/) |
| WebSockets | marked \`rust: socket\` | Rust |
| notifications, sounds | \`notifications.show\`/\`toast\` marked \`rust: notification\` | Rust |
| \`<title>\`, \`document.title\` | marked \`rust: title\`; the window title is the app's \`title\` | view model sets \`Window.title\` |

## Accessibility (WCAG 2.2 AA)

Every interactive kit component sets \`accessible-role\` (a test fails otherwise), takes its accessible label from its label, text, placeholder or \`aria-label\`, and reports \`accessible-value\`/\`accessible-checked\` where it applies, with \`accessible-action-default\` (and increment/decrement on numbers). Each has a [FocusScope](${SLINT}/reference/keyboard-input/focusscope/) in reading order with a 2 px focus ring (\`FocusRing\`), Enter/Space activation, Escape on modals, 24 px minimum targets, field errors as \`accessible-description\`, and state shown by a mark or weight, not colour alone. \`bin/a11y-audit.mjs\` counts converted interactive elements without a name. [Slint accessibility properties](${SLINT}/reference/common/).
`;
}

function main(argv) {
  const flag = (n, d) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : d);
  const webSrc = path.resolve(flag("--web", path.resolve(PKG, "../../apps/web/src")));
  const out = flag("--out", path.join(PKG, "docs/CONVERSIONS.md"));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, conversionsDoc({ webSrc }));
  process.stdout.write(`wrote ${out}\n`);
  return 0;
}

if (path.resolve(process.argv[1] ?? "") === path.resolve(new URL(import.meta.url).pathname)) {
  process.exit(main(process.argv.slice(2)));
}
