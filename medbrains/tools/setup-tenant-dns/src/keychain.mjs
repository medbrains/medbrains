/**
 * OS keychain helpers — store + retrieve API secrets without writing
 * them to a plaintext env.sh on disk.
 *
 *   macOS    → `security add-generic-password` / `find-generic-password`
 *   Linux    → `secret-tool store / lookup` (libsecret; install via apt
 *              install libsecret-tools, or dnf install libsecret)
 *
 * Service name convention:
 *   medbrains-dns/<tenant-id>/<credential-key>
 *
 * Example:
 *   medbrains-dns/hospital-a/GODADDY_API_KEY
 */

import { spawnSync } from "node:child_process";

export const SERVICE_PREFIX = "medbrains-dns";

export function isKeychainSupported() {
  if (process.platform === "darwin") {
    return spawnSync("which", ["security"]).status === 0;
  }
  if (process.platform === "linux") {
    return spawnSync("which", ["secret-tool"]).status === 0;
  }
  return false;
}

export function platformName() {
  switch (process.platform) {
    case "darwin":
      return "macOS Keychain";
    case "linux":
      return "Linux Secret Service (libsecret)";
    default:
      return process.platform;
  }
}

function serviceName(tenant, key) {
  return `${SERVICE_PREFIX}/${tenant}/${key}`;
}

export function storeSecret(tenant, key, value) {
  const service = serviceName(tenant, key);
  const account = process.env.USER ?? "operator";

  if (process.platform === "darwin") {
    const r = spawnSync(
      "security",
      ["add-generic-password", "-U", "-s", service, "-a", account, "-w", value],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    if (r.status !== 0) {
      throw new Error(`security add-generic-password failed: ${r.stderr?.toString() ?? r.status}`);
    }
    return { service, account };
  }

  if (process.platform === "linux") {
    const r = spawnSync(
      "secret-tool",
      ["store", "--label", `MedBrains DNS ${tenant}/${key}`, "service", service, "account", account],
      { input: value, stdio: ["pipe", "pipe", "pipe"] },
    );
    if (r.status !== 0) {
      throw new Error(`secret-tool store failed: ${r.stderr?.toString() ?? r.status}`);
    }
    return { service, account };
  }

  throw new Error(`Keychain not supported on ${process.platform}`);
}

/**
 * Build the shell snippet that retrieves a secret from the keychain
 * at runtime. Used inside env.sh.
 */
export function retrievalSnippet(envName, tenant, key) {
  const service = serviceName(tenant, key);
  const account = process.env.USER ?? "operator";

  if (process.platform === "darwin") {
    return `export ${envName}="$(security find-generic-password -s '${service}' -a '${account}' -w 2>/dev/null)"`;
  }
  if (process.platform === "linux") {
    return `export ${envName}="$(secret-tool lookup service '${service}' account '${account}' 2>/dev/null)"`;
  }
  throw new Error(`Keychain not supported on ${process.platform}`);
}
