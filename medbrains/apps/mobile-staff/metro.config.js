// Workspace-aware Metro config — resolves `@medbrains/*` packages
// out of the monorepo even when symlinked via pnpm.
const { getDefaultConfig } = require("expo/metro-config");
const fs = require("node:fs");
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
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith(".") && moduleName.endsWith(".js")) {
    const basePath = path.resolve(path.dirname(context.originModulePath), moduleName.slice(0, -3));
    for (const ext of [".ts", ".tsx"]) {
      const filePath = `${basePath}${ext}`;
      if (fs.existsSync(filePath)) {
        return { type: "sourceFile", filePath };
      }
    }
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
