/**
 * One test per conversion rule in docs/CONVERSIONS.md: each fails if its rule breaks.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { convertSource, jsxText, loadMapping, previewBool } from "../src/convert.mjs";
import { iconFile } from "../src/icons.mjs";
import { parseKit } from "../src/slint-types.mjs";
import { colorOf, lengthOf, responsive } from "../src/values.mjs";

const MANTINE = 'import { Stack, Group, Text, Title, Card, SimpleGrid, Grid, Box, Badge, Modal, NumberInput, TextInput } from "@mantine/core";\n';
const SEAM = 'import { Button, Badge as SBadge } from "@/components/ui";\n';
const ICONS = 'import { IconUserPlus } from "@tabler/icons-react";\n';
const mapping = loadMapping();
const convert = (body, options = {}) => convertSource(MANTINE + SEAM + ICONS + body, "fixture.tsx", mapping, new Map(), options);

test("Stack takes Mantine's defaults: gap md, start alignment, stretched cross axis", () => {
  const { slint } = convert("export function A() { return <Stack><Text>x</Text></Stack>; }");
  assert.match(slint, /VerticalLayout \{\s+spacing: Tokens\.space-md;\s+cross-axis-alignment: CrossAxisAlignment\.stretch;\s+alignment: LayoutAlignment\.start;/);
});

test("Group is a HorizontalLayout centred on the cross axis, with justify as alignment", () => {
  const { slint } = convert('export function A() { return <Group justify="space-between"><Text>a</Text></Group>; }');
  assert.match(slint, /HorizontalLayout \{\s+alignment: LayoutAlignment\.space-between;/);
  assert.match(slint, /cross-axis-alignment: CrossAxisAlignment\.center;/);
});

test("Text wraps like a block, takes the theme body colour and the md size unless sized", () => {
  const plain = convert("export function A() { return <Text>Hello</Text>; }").slint;
  assert.match(plain, /wrap: word-wrap;/);
  assert.match(plain, /color: Tokens\.color-content-on-surface;/);
  assert.match(plain, /font-size: Tokens\.font-md;/);
  const sized = convert('export function A() { return <Text size="sm" c="dimmed">Hi</Text>; }').slint;
  assert.match(sized, /font-size: Tokens\.font-sm;/);
  assert.match(sized, /color: Tokens\.color-content-on-surface-variant;/);
});

test("Title order sets the theme heading size and weight", () => {
  const { slint } = convert("export function A() { return <Title order={3}>T</Title>; }");
  assert.match(slint, /font-size: Tokens\.heading-3-size;/);
  assert.match(slint, /font-weight: Tokens\.heading-3-weight;/);
});

test("a prop with no Slint equivalent is dropped with its reason and counted", () => {
  const { slint, stats } = convert('export function A() { return <Card radius="lg">x</Card>; }');
  assert.match(slint, /\/\/ not converted: radius \(Carbon corners are 0/);
  assert.equal(stats.droppedProps["Card.radius"], 1);
});

test("margins become the padding of a wrapping layout", () => {
  const { slint } = convert('export function A() { return <Stack><Text mt="lg" mb={8}>x</Text></Stack>; }');
  assert.match(slint, /VerticalLayout \{\s+padding-top: Tokens\.space-lg;\s+padding-bottom: 8px;\s+Text \{/);
});

test("hiddenFrom and visibleFrom become an if on the window width", () => {
  const { slint } = convert('export function A() { return <Stack><Text hiddenFrom="sm">m</Text></Stack>; }');
  assert.match(slint, /if Tokens\.viewport-width < Tokens\.breakpoint-sm : VerticalLayout \{/);
});

test("SimpleGrid with written-out children is a GridLayout per breakpoint range", () => {
  const { slint } = convert("export function A() { return <SimpleGrid cols={{ base: 1, md: 2 }}><Text>a</Text><Text>b</Text></SimpleGrid>; }");
  assert.match(slint, /if Tokens\.viewport-width < Tokens\.breakpoint-md : GridLayout \{/);
  assert.match(slint, /if Tokens\.viewport-width >= Tokens\.breakpoint-md : GridLayout \{/);
  assert.match(slint, /row: 0; col: 1;/, "two columns from md: b sits beside a");
  assert.match(slint, /row: 1; col: 0;/, "one column below md: b sits under a");
});

test("Grid.Col span is a colspan of the 12 columns", () => {
  const { slint } = convert("export function A() { return <Grid><Grid.Col span={8}><Text>a</Text></Grid.Col><Grid.Col span={4}><Text>b</Text></Grid.Col></Grid>; }");
  assert.match(slint, /row: 0; col: 0; colspan: 8;/);
  assert.match(slint, /row: 0; col: 8; colspan: 4;/);
});

test("a grid over a list becomes rows of equal cells, never widths read from the grid", () => {
  const { slint } = convert("export function A() { return <SimpleGrid cols={3}>{rows.map((r) => <Text>{r}</Text>)}</SimpleGrid>; }");
  assert.match(slint, /for grid-row in ceil\(root\.rows\.length \/ 3\) : HorizontalLayout/);
  assert.match(slint, /if grid-row \* 3 \+ grid-col < root\.rows\.length/);
  assert.doesNotMatch(slint, /\.width - /);
});

test("Tabler icons become their SVG as an image, and a section icon becomes the kit's icon", () => {
  const { slint, stats } = convert("export function A() { return <Stack><IconUserPlus size={16} /><Button leftSection={<IconUserPlus size={16} />}>Add</Button></Stack>; }");
  assert.match(slint, /MbIcon \{ source: @image-url\("@medbrains-gui-kit\/icons\/user-plus\.svg"\); size: 16px; \}/);
  assert.match(slint, /MbButton \{[\s\S]*icon: @image-url\("@medbrains-gui-kit\/icons\/user-plus\.svg"\);/);
  assert.ok(stats.icons.has("user-plus.svg"));
  assert.deepEqual(iconFile("IconSquareNumber1"), { style: "outline", base: "square-number-1", file: "square-number-1.svg", stroke: 2 });
  assert.equal(iconFile("IconStarFilled").file, "filled-star.svg");
  assert.equal(iconFile("IconHelp", 1.5).file, "help-s1_5.svg");
});

test("t() becomes @tr with the English sentence, its values in order, and braces escaped", () => {
  const strings = new Map([["rx.count", "{{count}} waiting for {{who}}"], ["rx.brace", "Use {x}"]]);
  const a = convert('export function A() { return <Text>{t("rx.count", { who: name, count: n })}</Text>; }', { strings }).slint;
  assert.match(a, /@tr\("\{\} waiting for \{\}", root\.n, root\.name\)/);
  const b = convert('export function A() { return <Text>{t("rx.brace")}</Text>; }', { strings }).slint;
  assert.match(b, /@tr\("Use \{\{x\}\}"\)/);
});

test("early returns are branches, each shown only when the earlier ones do not apply", () => {
  const { slint } = convert("export function A() { if (isLoading) return <Text>Wait</Text>; if (failed) return <Text>Down</Text>; return <Text>Ward</Text>; }");
  assert.match(slint, /if root\.isloading : VerticalLayout/);
  assert.match(slint, /if root\.failed && !root\.isloading : VerticalLayout/);
  assert.match(slint, /if !root\.isloading && !root\.failed : VerticalLayout \{[\s\S]*"Ward"/);
});

test("useEffect: mount runs in init, state deps in one changed handler, cleanup is marked for Rust", () => {
  const { slint, stats } = convert(`export function A() {
    const [tab, setTab] = useState("a");
    useEffect(() => { load(); }, []);
    useEffect(() => { a(); }, [tab]);
    useEffect(() => { b(); return () => stop(); }, [tab]);
    return <Text>{tab}</Text>;
  }`);
  assert.match(slint, /init => \{ root\.effect-0\(\); \}/);
  assert.match(slint, /changed tab => \{ root\.effect-1\(\); root\.effect-2\(\); \}/);
  assert.match(slint, /\/\/ rust: cleanup: effect-2 returns a cleanup/);
  assert.equal(stats.rust.cleanup, 1);
});

test("setInterval and setTimeout with a literal delay become a Slint Timer", () => {
  const { slint } = convert("export function A() { useEffect(() => { setInterval(tick, 5000); setTimeout(done, 300); }, []); return <Text>x</Text>; }");
  assert.match(slint, /Timer \{ interval: 5000ms; running: true; triggered => \{ root\.tick-\d+\(\); \} \}/);
  assert.match(slint, /Timer \{ interval: 300ms; running: true; triggered => \{ self\.running = false; root\.timeout-\d+\(\); \} \}/);
});

test("useDisclosure handlers set the state, and a Modal mounts only while opened", () => {
  const { slint } = convert(`export function A() {
    const [opened, { open, close }] = useDisclosure(false);
    return <Stack><Button onClick={open}>Open</Button><Modal opened={opened} onClose={close} title="T"><Text>Body</Text></Modal></Stack>;
  }`);
  assert.match(slint, /clicked => \{ root\.opened = true; \}/);
  assert.match(slint, /if root\.opened : VerticalLayout \{\s+MbModal \{/);
  assert.match(slint, /closed => \{ root\.opened = false; \}/);
});

test("react-hook-form register() binds the field both ways", () => {
  const { slint } = convert('export function A() { return <TextInput label="Name" {...form.register("name")} />; }');
  assert.match(slint, /text <=> root\.form-name;/);
  assert.match(slint, /in-out property <string> form-name;/);
});

test("a CSS module class converts its layout declarations and notes the rest", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "r2s-"));
  fs.writeFileSync(path.join(dir, "a.module.scss"), ".bar { gap: var(--mantine-spacing-xs); flex: 1; box-shadow: 0 1px red; }\n.bar:hover { gap: 0; }\n");
  const src = `${MANTINE}import classes from "./a.module.scss";\nexport function A() { return <Group><Stack className={classes.bar}><Text>x</Text></Stack></Group>; }`;
  const { slint, stats } = convertSource(src, "a.tsx", mapping, new Map(), { absFile: path.join(dir, "a.tsx") });
  assert.match(slint, /spacing: Tokens\.space-xs;/);
  assert.match(slint, /horizontal-stretch: 1;/, "flex: 1 in a row grows horizontally");
  assert.match(slint, /not converted: \.bar \(box-shadow: 0 1px red \(no Slint equivalent\)\)/);
  assert.equal(stats.cssClasses, 1);
});

test("colours come only from tokens: raw colours and unmatched palette shades are dropped", () => {
  assert.equal(colorOf("var(--mb-text-secondary)").code, "Tokens.color-content-on-surface-variant");
  assert.match(colorOf("#ff0000").drop, /raw colour/);
  assert.match(colorOf("gray.3").drop ?? "", /no token/);
  const { slint } = convert('export function A() { return <Box bg="#fff"><Text>x</Text></Box>; }');
  assert.doesNotMatch(slint, /background: #fff/);
});

test("lengths: numbers are px, rem is 16 px, theme keys read the scale, percent only where Slint allows", () => {
  assert.equal(lengthOf(12, "width").code, "12px");
  assert.equal(lengthOf("1.5rem", "padding").code, "24px");
  assert.equal(lengthOf("md", "font-size").code, "Tokens.font-md");
  assert.equal(lengthOf("md", "spacing").code, "Tokens.space-md");
  assert.equal(lengthOf("100%", "width").code, "100%");
  assert.ok(lengthOf("100%", "max-width").drop);
  assert.ok(lengthOf("calc(100vh - 2px)", "height").drop);
  assert.equal(responsive({ responsive: { base: 1, sm: 2 } }, (v) => ({ code: String(v) })).code, "(Tokens.viewport-width >= Tokens.breakpoint-sm ? 2 : 1)");
});

test("our own components convert from their source and receive the props they declare", () => {
  const known = new Map([["DataTable", { file: "components/DataTable.tsx", props: new Map([["emptyTitle", { name: "emptytitle", type: "string" }]]), callbacks: new Map() }]]);
  const { slint } = convertSource('import { DataTable } from "../components/DataTable";\nexport function P() { return <DataTable emptyTitle="None" />; }', "pages/p.tsx", mapping, known);
  assert.match(slint, /import \{ DataTable \} from "\.\.\/components\/DataTable\.slint";/);
  assert.match(slint, /DataTable \{\s+emptytitle: "None";/);
  assert.doesNotMatch(slint, /StandardTableView/, "a library rule of the same name does not replace our component");
});

test("destructured prop defaults start the properties", () => {
  const { slint } = convert('export function E({ title = "No data found" }) { return <Text>{title}</Text>; }');
  assert.match(slint, /in property <string> title: "No data found";/);
});

test("JSX text keeps its spaces and drops indentation, as React renders it", () => {
  assert.equal(jsxText("Due "), "Due ");
  assert.equal(jsxText("\n      Ward census\n    "), "Ward census");
  const { slint } = convert("export function A() { return <Text>Due {n} today</Text>; }");
  assert.match(slint, /text: "Due " \+ root\.n \+ " today";/);
});

test("a ternary in text is a Slint conditional", () => {
  const { slint } = convert('export function A() { return <Text>{busy ? "Saving" : "Save"}</Text>; }');
  assert.match(slint, /text: \(root\.busy \? "Saving" : "Save"\);/);
});

test("preview values mirror the mocked web: permitted, loaded, no errors, empty lists", () => {
  assert.equal(previewBool("canCreate"), true);
  assert.equal(previewBool("isLoading"), false);
  assert.equal(previewBool("error"), false);
  assert.equal(previewBool("rows.length === 0"), true);
  assert.equal(previewBool("rows.length > 0"), false);
  assert.equal(previewBool("!data"), true);
  assert.equal(previewBool("columnCount === 0"), false);
});

test("queries, mutations and browser APIs are marked for the Rust view model and counted", () => {
  const { slint, stats } = convert('export function A() { const q = useQuery({}); localStorage.setItem("k", "v"); navigator.clipboard.writeText("x"); return <Text>x</Text>; }');
  assert.match(slint, /\/\/ rust: query: useQuery/);
  assert.equal(stats.rust.storage, 1);
  assert.equal(stats.rust.clipboard, 1);
});

test("lineClamp, truncate and tt map to max-lines, elide and string case", () => {
  const { slint } = convert('export function A() { return <Stack><Text lineClamp={2}>a</Text><Text truncate>b</Text><Text tt="uppercase">c</Text></Stack>; }');
  assert.match(slint, /max-lines: 2;\s+overflow: elide;/);
  assert.match(slint, /wrap: no-wrap;\s+overflow: elide;|overflow: elide;/);
  assert.match(slint, /text: \("c"\)\.to-uppercase\(\);/);
});

test("Mantine colour names become kit tones; seam tones pass through", () => {
  const { slint } = convert('export function A() { return <Stack><Badge color="green">a</Badge><SBadge tone="warning">b</SBadge></Stack>; }');
  assert.match(slint, /tone: "success";/);
  assert.match(slint, /tone: "warning";/);
});

test("values are written with the type the kit declares", () => {
  const kit = parseKit("export component X inherits Rectangle { in-out property <float> value; in property <[string]> model; callback edited(float); accessible-role: spinbox; width: 2px; }");
  const x = kit.get("X");
  assert.deepEqual(x.properties.value, { type: "float", dir: "in-out" });
  assert.equal(x.properties.model.type, "[string]");
  assert.ok(x.role);
  assert.ok(x.bound.has("width"));
  const { slint } = convert("export function A() { return <NumberInput value={dose} min={0} />; }");
  assert.match(slint, /value: root\.dose;/);
  assert.match(slint, /in property <float> dose;/);
});

test("raw HTML converts where it can and is always reported against the components rule", () => {
  const { slint, stats } = convert("export function H() { return <div><b>Due</b></div>; }");
  assert.match(slint, /Text \{\s+font-weight: 700;\s+text: "Due";/);
  assert.deepEqual(stats.rawHtml, { div: 1, b: 1 });
});

test("an unknown component is reported, not dropped", () => {
  const { slint, stats } = convert('import { Mystery } from "mystery-lib";\nexport function R() { return <Stack><Mystery /></Stack>; }');
  assert.equal(stats.unmapped.Mystery, 1);
  assert.match(slint, /\/\/ unmapped: <Mystery>/);
});

test("Mantine Menu is Slint's ContextMenuArea, opened by the target button's own clicked", () => {
  const src = 'import { Menu, ActionIcon } from "@mantine/core";\nexport function M() { return <Menu><Menu.Target><ActionIcon aria-label="More" /></Menu.Target><Menu.Dropdown><Menu.Item onClick={edit}>Edit</Menu.Item><Menu.Divider /><Menu.Item disabled>Delete</Menu.Item></Menu.Dropdown></Menu>; }';
  const { slint } = convertSource(src, "m.tsx", mapping, new Map());
  assert.match(slint, /menu-\d+ := ContextMenuArea \{\s+Menu \{\s+MenuItem \{ title: "Edit"; activated => \{ root\.[\w-]+\(\); \} \}\s+MenuSeparator \{ \}\s+MenuItem \{ title: "Delete"; enabled: false; \}/);
  assert.match(slint, /MbIconButton \{[\s\S]*clicked => \{ menu-\d+\.show\(\{ x: 0px, y: self\.height \}\); \}/);
  assert.doesNotMatch(slint, /FocusScope \{ key-pressed/, "a button target adds no second tab stop");
});

test("docs/CONVERSIONS.md is generated from the current tables", async () => {
  // Fails when mapping.json, the defaults or the kit change without regenerating the document.
  const { conversionsDoc } = await import("../bin/conversions-doc.mjs");
  const here = path.dirname(new URL(import.meta.url).pathname);
  const web = path.resolve(here, "../../../apps/web/src");
  if (!fs.existsSync(web)) return;
  assert.equal(fs.readFileSync(path.resolve(here, "../docs/CONVERSIONS.md"), "utf8"), conversionsDoc({ webSrc: web }));
});

test("every interactive kit component declares an accessible role and a way to label it", () => {
  // Fails when a kit control could reach a screen without a role or label (WCAG 2.2 SC 4.1.2).
  const { kit, describe } = mapping.types;
  const interactive = [...kit.keys()].filter((n) => n.startsWith("Mb") && Object.keys(kit.get(n).callbacks).some((c) => /clicked|edited|toggled|selected|changed|picked/.test(c)));
  assert.ok(interactive.length >= 15, `found ${interactive.length} interactive kit components`);
  // Controls whose role sits on the widget inside them, and stand-ins not drawn yet.
  const delegated = { MbSelect: "Slint ComboBox (combobox)", MbMultiSelect: "its field box (combobox)", MbFileInput: "MbButton (button)", MbPagination: "MbButton (button)", MbRating: "stub, not drawn yet" };
  const missing = interactive.filter((n) => !describe(n).role && !delegated[n]);
  assert.deepEqual(missing, [], "interactive kit components without accessible-role");
});
