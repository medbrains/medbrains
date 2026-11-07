# @medbrains/react-to-slint

Converts React + Mantine screens into Slint view skeletons, for the native OS GUI (`docs/architecture/OS-NATIVE-GUI.md`). The web app stays React; this gives each module's Slint version a correct starting point and a list of what a person still has to do.

## Use

```sh
pnpm --filter @medbrains/react-to-slint exec react-to-slint apps/web/src/pages/pharmacy --out /tmp/pharmacy-slint
```

It writes one `.slint` file per converted `.tsx` file and prints a summary:

```text
files 69, components 86, elements 882
mapped 789 (89%)
translated strings converted to @tr(): 23
unmapped: DrugSearchSelect 6, PharmacyPatientContext 5, …
raw HTML: b 4, form 2, div 1
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
- **Our own components across files.** A component defined in another file shows as unmapped until that file is converted too.

## Test

```sh
pnpm --filter @medbrains/react-to-slint test
```
