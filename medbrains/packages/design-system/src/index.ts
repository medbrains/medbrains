/**
 * @medbrains/design-system — public API
 *
 * Three-tier token system + Mantine integration. Consumers should import:
 *   • `createMedBrainsTheme(opts)` — Mantine theme factory
 *   • `cssVariableResolver`        — Mantine CSS variable resolver
 *   • `lightScheme` / `darkScheme` — semantic role maps
 *   • `MEDBRAINS_FONT_*`           — font stack constants
 *
 * For advanced needs (extending ramps, custom semantic roles):
 *   • re-exported primitives — `blue`, `cinnabar`, `mint`, `ink`, etc.
 *   • re-exported tokens     — `space`, `radius`, `fontSize`, `duration`, etc.
 *
 * SCSS:
 *   • `@medbrains/design-system/styles/global.scss` — global app SCSS layer
 *
 * Font registration is the consumer's responsibility — call
 *   `import "@fontsource-variable/inter-tight"` etc. in your app entry.
 */

export * from "./theme/mantine";
export * from "./theme/primitives";
export * from "./theme/semantic";
