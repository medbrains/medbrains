# Changelog

This package follows semantic versioning. `mapping.json` carries its own `version`, written into every generated file, so a screen can be regenerated with the mapping it was made from.

## 0.1.0 (2026-11-07)

- First release: converts React and Mantine screens to Slint view skeletons.
- Layout, text, inputs and display components from Mantine and the `components/ui` seam (mapping version 1).
- Translated text: `t("key")` becomes `@tr("key")`, with positional values for `t("key", { … })`.
- Conditions (`a && <X/>`, `a ? <X/> : <Y/>`) become `if`; `list.map(...)` becomes `for`.
- react-hook-form `Controller` converts the field its `render` returns; `Icon*` becomes `MbIcon`.
- Report: share of elements mapped, unmapped components, raw HTML, kit components needed, hooks to move into view models.
- On the Pharmacy pages: 69 files, 89% of elements mapped.
