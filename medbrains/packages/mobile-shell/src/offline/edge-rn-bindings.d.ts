/**
 * Ambient module declaration for `@medbrains/edge-rn-bindings`.
 *
 * The actual package is auto-emitted at host-app prebuild time by
 * `@medbrains/uniffi-rn-plugin` (it runs `uniffi-bindgen-react-native`
 * against `crates/medbrains-edge-rn/src/edge_rn.udl`). This package
 * never imports the bindings at build time — only at runtime via
 * the lazy loader — so we declare the module shape here so
 * mobile-shell typechecks before any host runs prebuild.
 */

declare module "@medbrains/edge-rn-bindings" {
  import type { EdgeRnBindings } from "./edge-rn-contract.js";
  const bindings: EdgeRnBindings;
  export = bindings;
}
