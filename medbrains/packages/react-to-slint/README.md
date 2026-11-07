# @medbrains/react-to-slint

Converts React + Mantine screens into Slint view skeletons, for the native OS GUI (`docs/architecture/OS-NATIVE-GUI.md`). The web app stays React; this gives each module's Slint version a correct starting point and a list of what a person still has to do.

## Use

```sh
pnpm --filter @medbrains/react-to-slint exec react-to-slint apps/web/src/pages/pharmacy --project apps/web/src --out /tmp/pharmacy-slint
```

It writes one `.slint` file per converted `.tsx` file and prints a summary:

```text
files 1547, components 2154, elements 29601
mapped 29479 of 29582 convertible (99.7%); web-only by design: Handle 16, ReactFlow 3
translated strings converted to @tr(): 236
unmapped: SpotlightSearch 1, FormProvider 1, …
raw HTML (breaks the components rule; converted where possible): div 776, span 264, …
kit components needed: MbAlert, MbBadge, MbButton, …
hooks to move into view models: useState 100, useHasPermission 68, useQuery 62, …
```

## What it converts

| React | Slint |
|---|---|
| `Stack`, `Group`, `SimpleGrid`, `Box` | `VerticalLayout`, `HorizontalLayout`, `GridLayout`, `Rectangle` |
| `Text`, `Title` | `Text` |
| `TextInput`, `Select`, `Checkbox`, `Switch`, `NumberInput` | `LineEdit`, `ComboBox`, `CheckBox`, `Switch`, `SpinBox` |
| `Button`, `Badge`, `Card`, `Panel`, `Alert`, `Modal` | the `Mb*` components of `medbrains-gui-kit` |
| `t("ns.key")` | `@tr("ns.key")` |
| `{a && <X/>}`, `{a ? <X/> : <Y/>}` | `if root.a : …` |
| `{rows.map(r => <X/>)}` | `for item in root.rows : …` |
| `disabled={x}` | `enabled: !root.x` |
| `onClick={fn}` | `clicked => { root.click(); }` plus `callback click();` |

The full table is `src/mapping.json`. Add a component there, bump its `version`, and note it in `CHANGELOG.md`.

## What it does not do

- **Logic.** Hooks, queries, mutations and handlers are not converted. Each value a view needs becomes an `in property`, each handler a `callback`, and the report counts the hooks: that is the Rust view model to write.
- **Compile checks.** The output is a skeleton to finish, not code that is guaranteed to compile. Run it through the Slint compiler and fix what it reports.
- **Diagram editors.** `ReactFlow` and its handles are web-only by design and reported apart.

`--project DIR` indexes every component under `DIR` first, so a reference to one of our own components in another file converts, with an import of that file's generated `.slint`.

## Test

```sh
pnpm --filter @medbrains/react-to-slint test
```
