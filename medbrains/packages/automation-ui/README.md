# @medbrains/automation-ui

The automation screen, for `apps/web`.

```tsx
import { AutomationScreen } from "@medbrains/automation-ui";

<Route path="/automation" element={<AutomationScreen />} />
```

## What this package is and is not

The editor is [`@r8r/editor`](../../../r8r/editor-ui) — a separate project with
its own tests and release cadence. This package is the adapter: it points that
editor at `/api/automation`, sends this app's session cookie, and hides the
editor's own tab bar because the app shell already provides navigation.

It deliberately does **not** provide a `MantineProvider` or a `Notifications`
portal. `apps/web` has both. A second Mantine provider would give the editor a
different theme from every other screen, which is the thing this package exists
to prevent.

## Replacing the old builder

This replaces `apps/web/src/components/Integration/` — `PipelineCanvas`,
`NodePalette`, `NodePropertyPanel`, `ExecutionPanel`, `VisualFieldMapper` and
the rest. The stack is the same (Mantine 9, Tabler, xyflow 12, React 19), so
the difference is that this one has an engine behind it.

## Expression language

Automation uses [Rhai], the engine's sandboxed language, for `{{ }}` in node
parameters. That is a different language from `@medbrains/expressions` (MBX),
which stays the language for print templates, computed fields and form
visibility rules.

The split is by domain and deliberate: MBX is evaluated in the browser against
form state, and automation expressions are evaluated in Rust against items
mid-run. Worth documenting wherever users meet both.

## Deployment

`apiBase` is the only thing that changes between the two deployments:

* **Embedded** — `/api/automation`, nested in `medbrains-server`. The default.
* **Standalone** — the automation service's own address, with CORS and cookie
  domain configured so the session still reaches it.

[Rhai]: https://rhai.rs
