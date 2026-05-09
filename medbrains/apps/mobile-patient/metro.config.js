// Workspace-aware Metro config — resolves `@medbrains/*` packages
// out of the monorepo even when symlinked via pnpm.
const { getDefaultConfig } = require("expo/metro-config");
const path = require("node:path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];
config.resolver.disableHierarchicalLookup = true;
const defaultGetModulesRunBeforeMainModule =
  config.serializer?.getModulesRunBeforeMainModule;
config.serializer = {
  ...config.serializer,
  getModulesRunBeforeMainModule(entryFile) {
    const defaults = defaultGetModulesRunBeforeMainModule?.(entryFile) ?? [];
    return [
      require.resolve("@medbrains/mobile-shell/runtime-polyfills"),
      ...defaults,
    ];
  },
};

module.exports = config;
