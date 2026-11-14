# Changelog

This package follows semantic versioning. `mapping.json` carries its own `version`, written into every generated file, so a screen can be regenerated with the mapping it was made from.

## 0.4.0 (2026-11-07)

- Every conversion documented: docs/CONVERSIONS.md is generated from the rules, one row per Mantine and seam component the web app uses, with Mantine 9 and Slint 1.18 links; a test fails when it is stale.
- Mapping version 9. Values are written with the type each Slint property declares (official 1.18 reference, kit sources); Mantine, theme and seam default props apply first; props with no equivalent are dropped with the reason in the file and counted.
- Theme scale from the design system (spacing, type, headings, control heights, breakpoints, radius 0); colours only through tokens, CSS variables matched by measured light and dark values.
- Style props, responsive props, margins, CSS module layout declarations, Grid and SimpleGrid as GridLayout cells, early returns as branches, ternaries in text, destructured prop defaults, prop passing to our own components, JSX whitespace as React renders it.
- Lifecycle: useEffect to init and changed, timers to Timer, Mantine Menu to ContextMenuArea, Modal mounted under if, react-hook-form register to two-way bindings; logic for the Rust view model is marked `// rust:` and counted.
- Tabler icons as SVG images with colorize; the app shell has the web's top bar, module badges, group headings, breadcrumb and dot grid.
- Kit: keyboard focus with a 2px ring, Enter and Space, arrows on numbers and segments, Escape on modals, 24px targets, errors announced, password reveal, required marker, select placeholder and clear, multi-select menu; a live gallery; a test that fails when an interactive control has no accessible role, and an audit of unnamed controls.
- All 1,066 page files compile with the Slint 1.18.1 viewer (1,000 in 0.3.0); 86 of 129 menu entries open a native screen (69 in 0.3.0).

## 0.3.0 (2026-11-07)

- The preview kit draws the MedBrains design: Carbon-sharp buttons filled for primary, inputs with a label above and a bottom rule, flat cards, inline notifications with a tone rule, pill tags, IBM Plex fonts (OFL, converted to TTF), visible 2 px focus and keyboard activation.
- Every colour comes from `Tokens`, generated from the design system's one source, with light and dark both working (`Tokens.dark`).
- Mapping version 4: text, number and password inputs, selects, checkboxes and switches map to kit components with their labels.

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
