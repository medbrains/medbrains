import path, { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { StorybookConfig } from "@storybook/react-vite";
import { mergeConfig } from "vite";

/**
 * Resolve absolute paths for monorepo addon packages. Required when a
 * workspace uses isolated node_modules.
 */
function getAbsolutePath(value: string): string {
  return dirname(fileURLToPath(import.meta.resolve(`${value}/package.json`)));
}

const currentDir = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(currentDir, "../../..");
const webSrc = path.resolve(workspaceRoot, "apps/web/src");
const designSystemSrc = path.resolve(workspaceRoot, "packages/design-system/src");

const config: StorybookConfig = {
  // Stories live next to components in apps/web and any future packages.
  // Storybook globs them into this app at build time.
  stories: [
    "../../web/src/**/*.mdx",
    "../../web/src/**/*.stories.@(js|jsx|mjs|ts|tsx)",
    "../../../packages/design-system/src/**/*.stories.@(js|jsx|mjs|ts|tsx)",
  ],
  addons: [
    getAbsolutePath("@chromatic-com/storybook"),
    getAbsolutePath("@storybook/addon-a11y"),
    getAbsolutePath("@storybook/addon-docs"),
  ],
  framework: getAbsolutePath("@storybook/react-vite"),
  viteFinal: (viteConfig) =>
    mergeConfig(viteConfig, {
      resolve: {
        alias: {
          "@": webSrc,
          "@medbrains/design-system": designSystemSrc,
        },
      },
    }),
};

export default config;
