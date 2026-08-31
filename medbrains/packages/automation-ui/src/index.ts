/**
 * Workflow automation, for the MedBrains web app.
 *
 * The editor itself is `@r8r/editor` — a separate project. This package is the
 * thin layer that makes it a MedBrains screen rather than a bolted-on tool: it
 * points the editor at the automation API behind this app's session, and lets
 * it inherit the design system instead of carrying r8r's own theme.
 *
 * There is no second Mantine provider and no second notifications portal. The
 * web app already has both, and nesting another would cut the editor off from
 * the host's theme.
 */

export type { AutomationScreenProps } from "./AutomationScreen";
export { AutomationScreen } from "./AutomationScreen";
