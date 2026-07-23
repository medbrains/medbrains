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

// `@medbrains/*` packages are consumed from TypeScript source and use the
// ESM convention of importing siblings with a `.js` extension. Metro resolves
// that literally and misses the `.ts` file, so map it back.
const upstreamResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith(".") && moduleName.endsWith(".js")) {
    const withoutExt = moduleName.slice(0, -3);
    for (const ext of [".ts", ".tsx"]) {
      try {
        return context.resolveRequest(context, withoutExt + ext, platform);
      } catch {
        // Fall through to the next candidate, then to the original specifier.
      }
    }
  }
  return (upstreamResolveRequest ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
