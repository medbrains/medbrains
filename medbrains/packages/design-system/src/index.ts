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
 *   `import "@fontsource/ibm-plex-sans/400.css"` etc. in your app entry.
 *
 * Colours: `colors.generated.ts` (M3 roles, from `figma-varspec.json`, regenerate
 *   with `pnpm --filter @medbrains/design-system gen:colors`).
 */

export * from "./theme/colors.generated";
export * from "./theme/mantine";
export * from "./theme/primitives";
export * from "./theme/semantic";
