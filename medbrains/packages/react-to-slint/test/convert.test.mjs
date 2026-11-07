/**
 * Behaviour of the converter: each test fails if the mapping it names breaks.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { convertSource } from "../src/convert.mjs";

const convert = (src) => convertSource(src, "fixture.tsx");

test("layout and text map to Slint layouts and Text", () => {
  const { slint, stats } = convert(`export function Card() {
    return <Stack gap="md"><Text>Hello</Text></Stack>;
  }`);
  assert.match(slint, /export component Card inherits Rectangle/);
  assert.match(slint, /VerticalLayout \{\s+spacing: Tokens\.space-md;\s+Text \{\s+text: "Hello";/);
  assert.equal(stats.mapped, 2);
});

test("translated text becomes @tr, never a property", () => {
  const { slint, stats } = convert(`export function T() {
    return <Button onClick={save}>{t("rx.save")}</Button>;
  }`);
  assert.match(slint, /clicked => \{ root\.click\(\); \}/);
  assert.match(slint, /callback click\(\);/);
  assert.equal(stats.strings, 0, "children of a Button are its label, read as text only");
  const titled = convert(`export function T() { return <Panel title={t("rx.title")} />; }`);
  assert.match(titled.slint, /title: @tr\("rx\.title"\);/);
  assert.equal(titled.stats.strings, 1);
});

test("conditions and lists become if and for", () => {
  const { slint } = convert(`export function L() {
    return <Stack>{failed && <Alert title="Down" />}{rows.map((r) => <Badge>{r}</Badge>)}</Stack>;
  }`);
  assert.match(slint, /if root\.failed : VerticalLayout/);
  assert.match(slint, /for item in root\.rows : VerticalLayout/);
  assert.match(slint, /in property <bool> failed;/);
  assert.match(slint, /in property <\[string\]> rows;/);
});

test("disabled becomes a negated enabled, numbers stay numbers", () => {
  const { slint } = convert(`export function F() {
    return <Stack><TextInput disabled={busy} /><NumberInput min={0} max={600} /></Stack>;
  }`);
  assert.match(slint, /enabled: !root\.busy;/);
  assert.match(slint, /minimum: 0;\s+maximum: 600;/);
});

test("react-hook-form Controller converts the field it renders", () => {
  const { slint, stats } = convert(`export function C() {
    return <Controller name="x" render={({ field }) => <Select data={opts} value={field.value} />} />;
  }`);
  assert.match(slint, /ComboBox \{/);
  assert.deepEqual(stats.unmapped, {});
});

test("raw HTML and unknown components are reported, not silently dropped", () => {
  const { slint, stats } = convert(`export function R() {
    return <Stack><div>x</div><Mystery /></Stack>;
  }`);
  assert.equal(stats.rawHtml.div, 1);
  assert.equal(stats.unmapped.Mystery, 1);
  assert.match(slint, /\/\/ unmapped: <Mystery>/);
});

test("hooks are counted as logic for the view model", () => {
  const { stats } = convert(`export function H() {
    const [a] = useState(1); const q = useQuery({}); return <Text>{a}</Text>;
  }`);
  assert.deepEqual(stats.hooks, { useState: 1, useQuery: 1 });
});

test("raw HTML is converted to Slint and still reported against the components rule", () => {
  const { slint, stats } = convert(`export function H() {
    return <div><b>Due</b><button onClick={go}>Open</button></div>;
  }`);
  assert.match(slint, /Rectangle \{/);
  assert.match(slint, /Text \{\s+font-weight: 700;\s+text: "Due";/);
  assert.match(slint, /MbButton \{[\s\S]*clicked => \{ root\.click\(\); \}[\s\S]*text: "Open";/);
  assert.deepEqual(stats.rawHtml, { div: 1, b: 1, button: 1 });
  assert.deepEqual(stats.unmapped, {});
});

test("components defined in other files convert as references with an import", () => {
  const known = new Map([["DrugSearchSelect", "/x/drug-search-select.tsx"]]);
  const { slint, stats } = convertSource(`export function P() { return <Stack><DrugSearchSelect /></Stack>; }`, "p.tsx", undefined, known);
  assert.match(slint, /import \{ DrugSearchSelect \} from "\.\/drug-search-select\.slint";/);
  assert.match(slint, /DrugSearchSelect \{ \}/);
  assert.deepEqual(stats.unmapped, {});
});

test("Mantine sizes and colours become tokens, and Text children merge into one string", () => {
  const { slint } = convert(`export function M() {
    return <Text size="sm" c="dimmed">Due {count} today</Text>;
  }`);
  assert.match(slint, /font-size: Tokens\.font-sm;/);
  assert.match(slint, /color: Tokens\.color-text-muted;/);
  assert.match(slint, /text: "Due" \+ root\.count \+ "today";/);
});
