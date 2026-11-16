/// <reference types="vite/client" />
/// <reference types="vite-plugin-svgr/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "*.module.scss" {
  const classes: Record<string, string>;
  export default classes;
}

// Injected by vite.config.ts `define` at build time. Declared here so the
// build identity is type-checked like anything else rather than reached for
// through `any`.
declare const __APP_VERSION__: string;
declare const __APP_COMMIT__: string;
/** The error-tracking release (src/lib/release-name.ts): the tag's or the commit. */
declare const __APP_RELEASE__: string;
declare const __APP_BUILT__: string;
