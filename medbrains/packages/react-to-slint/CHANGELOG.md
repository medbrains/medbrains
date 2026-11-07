# Changelog

This package follows semantic versioning. `mapping.json` carries its own `version`, written into every generated file, so a screen can be regenerated with the mapping it was made from.

## 0.2.0 (2026-11-07)

- Whole-project conversion: `--project DIR` indexes every component in the tree, so references to our own components convert, with an import of their generated file. The mapping table still wins over the index, so seam components map to the kit.
- Raw HTML converts to Slint (layouts, bold and plain text, tables, inputs, buttons, headings) and is still counted against the components-only rule.
- Mapping version 3: menus, charts, lists, steppers, accordions, radios, date and time pickers, file inputs, QR codes, rich text, pagination, timeline and more. Routing and providers are dropped; diagram editors (`ReactFlow`, `Handle`) are web-only by design and reported apart.
- On the whole web app (1,547 files, 29,601 elements): 99.6% of convertible elements mapped.

## 0.1.0 (2026-11-07)

- First release: converts React and Mantine screens to Slint view skeletons.
- Layout, text, inputs and display components from Mantine and the `components/ui` seam (mapping version 1).
- Translated text: `t("key")` becomes `@tr("key")`, with positional values for `t("key", { … })`.
- Conditions (`a && <X/>`, `a ? <X/> : <Y/>`) become `if`; `list.map(...)` becomes `for`.
- react-hook-form `Controller` converts the field its `render` returns; `Icon*` becomes `MbIcon`.
- Report: share of elements mapped, unmapped components, raw HTML, kit components needed, hooks to move into view models.
- On the Pharmacy pages: 69 files, 89% of elements mapped.
