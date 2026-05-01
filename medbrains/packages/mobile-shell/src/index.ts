/**
 * `@medbrains/mobile-shell` — Phase C of the mobile/TV/edge roadmap.
 *
 * Cross-cutting React Native package consumed by every generated
 * Expo Prebuild app. Provides:
 *   - Auth flow (LoginScreen, AuthProvider, biometric prompts/gate)
 *   - SecretStore wrapper over Keychain / Keystore
 *   - Biometric capability + unlock helpers
 *   - Offline bridge to medbrains-edge-rn (AuthzCache, JWT verify,
 *     revocation cache) via `@medbrains/edge-rn-bindings`
 *   - Module contract + ModuleNavigator
 *   - Device pairing (QR scan + mTLS handshake)
 *   - Forest+Copper theme tokens for React Native Paper v5
 */

export * from "./auth/index.js";
export * from "./biometric/index.js";
export * from "./nav/index.js";
export * from "./offline/index.js";
export * from "./pairing/index.js";
export * from "./secret-store/index.js";
export * from "./theme/index.js";
export { Shell } from "./shell.js";
export type { ShellProps } from "./shell.js";
export {
  filterAccessibleModules,
  userHasModuleAccess,
} from "./types.js";
export type {
  Module,
  ModuleBadge,
  ModuleList,
  ShellVariant,
  TenantIdentity,
} from "./types.js";
