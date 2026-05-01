#!/usr/bin/env node
/**
 * `medbrains-setup-tenant-dns` — interactive scaffolder for the DNS
 * portion of a tenant's terraform.tfvars. Asks the operator for the
 * apex zone, the DNS provider, and the matching credentials, then
 * writes:
 *
 *   infra/terraform/envs/tenants/<tenant-id>/terraform.tfvars  (DNS keys only)
 *   infra/terraform/envs/tenants/<tenant-id>/env.sh            (sources keychain at runtime)
 *
 * Credential storage:
 *
 *   API-key providers (GoDaddy / Cloudflare / DigitalOcean /
 *   Namecheap) — secrets stored in the OS keychain (macOS Keychain
 *   or Linux libsecret). env.sh runs `security find-generic-password`
 *   / `secret-tool lookup` at source-time. Plaintext never lands on
 *   disk.
 *
 *   Native auth-flow providers (AWS Route53 / Azure / Google) —
 *   env.sh verifies the operator's existing session is active
 *   (`aws sts get-caller-identity`, `az account show`, `gcloud auth
 *   application-default print-access-token`) and bails with
 *   instructions otherwise. The script never asks for those creds.
 *
 *   Fallback (no keychain) — operator passes `--no-keychain` or runs
 *   on an unsupported platform; env.sh writes plaintext exports with
 *   a strong warning.
 *
 * Run from the workspace root:
 *
 *   node medbrains/tools/setup-tenant-dns/src/index.mjs
 *
 * Or with flags for non-interactive use:
 *
 *   node medbrains/tools/setup-tenant-dns/src/index.mjs --tenant=hospital-a
 *   node medbrains/tools/setup-tenant-dns/src/index.mjs --no-keychain
 */

import { existsSync, mkdirSync, writeFileSync, appendFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ask, askChoice, askSecret, askYesNo, closePrompts } from "./prompts.mjs";
import {
  isKeychainSupported,
  platformName,
  retrievalSnippet,
  storeSecret,
} from "./keychain.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..", "..", "..", "..");
const TENANT_BASE = join(REPO_ROOT, "medbrains", "infra", "terraform", "envs", "tenants");

const PROVIDERS = [
  { value: "godaddy", label: "GoDaddy (currently the only one with active credentials)" },
  { value: "cloudflare", label: "Cloudflare (recommended for new tenants)" },
  { value: "route53", label: "AWS Route53 (uses your existing aws sso login)" },
  { value: "azure", label: "Azure DNS (uses your existing az login)" },
  { value: "google", label: "Google Cloud DNS (uses your existing gcloud auth)" },
  { value: "digitalocean", label: "DigitalOcean" },
  { value: "namecheap", label: "Namecheap" },
];

const NATIVE_AUTH_PROVIDERS = new Set(["route53", "azure", "google"]);

function parseArgs(argv) {
  const flags = {};
  for (const a of argv) {
    const m = a.match(/^--([\w-]+)(?:=(.*))?$/u);
    if (m) flags[m[1]] = m[2] ?? "true";
  }
  return flags;
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));
  const useKeychain = flags["no-keychain"] !== "true" && isKeychainSupported();
  console.log("\nMedBrains — tenant DNS setup\n");
  if (useKeychain) {
    console.log(`  Credentials will be stored in ${platformName()}.`);
  } else if (flags["no-keychain"] === "true") {
    console.log("  --no-keychain set — secrets will be written to env.sh in plaintext.");
  } else {
    console.log("  No keychain backend detected — secrets will be written to env.sh in plaintext.");
  }

  const tenantId =
    flags.tenant ?? (await ask("\nTenant id (lowercase, hyphenated)", "hospital-a"));
  if (!/^[a-z][a-z0-9-]{2,40}$/u.test(tenantId)) {
    throw new Error(`invalid tenant id: ${tenantId}`);
  }

  const tenantDir = join(TENANT_BASE, tenantId);
  if (!existsSync(tenantDir)) {
    console.log(`\nNo env dir at ${tenantDir} — creating it.`);
    mkdirSync(tenantDir, { recursive: true });
  }

  const tfvarsPath = join(tenantDir, "terraform.tfvars");
  const envPath = join(tenantDir, "env.sh");

  if (existsSync(tfvarsPath)) {
    const overwrite = await askYesNo(
      `${tfvarsPath} already exists. Overwrite the DNS section?`,
      false,
    );
    if (!overwrite) {
      console.log("Aborted.");
      process.exit(0);
    }
  }

  const provider = await askChoice("Which DNS provider hosts this tenant's zone?", PROVIDERS, 0);
  const zoneName = await ask("Apex zone (e.g. acmehealthcare.com — no trailing dot)");
  if (!zoneName.includes(".")) {
    throw new Error(`invalid zone: ${zoneName}`);
  }
  const subdomain = await ask(
    'Subdomain prefix for tenant records (empty = at the apex; e.g. "hospitals" → headscale.hospitals.<zone>)',
    "",
  );

  const extras = await collectProviderExtras(provider);
  const credentials = NATIVE_AUTH_PROVIDERS.has(provider)
    ? {}
    : await collectCredentials(provider);

  if (provider === "godaddy") {
    await preflightGoDaddy(credentials.GODADDY_API_KEY, credentials.GODADDY_API_SECRET);
  }

  const storedKeys = useKeychain ? persistToKeychain(tenantId, credentials) : [];

  writeTfvars(tfvarsPath, { tenantId, provider, zoneName, subdomain, extras });
  writeEnv(envPath, {
    provider,
    tenantId,
    credentials,
    storedKeys,
    useKeychain,
  });

  console.log(`\nWrote:\n  ${tfvarsPath}\n  ${envPath}`);
  if (useKeychain && storedKeys.length > 0) {
    console.log(`\nStored ${storedKeys.length} secret(s) in ${platformName()}.`);
  }
  console.log("\nNext steps:");
  console.log(`  1. cd ${tenantDir}`);
  console.log("  2. source ./env.sh");
  if (NATIVE_AUTH_PROVIDERS.has(provider)) {
    console.log(`     (env.sh will verify your ${provider} session is active)`);
  }
  console.log("  3. terraform init && terraform plan\n");
}

function writeTfvars(path, ctx) {
  const lines = [
    "# DNS section — generated by medbrains-setup-tenant-dns.",
    "# Edit by hand or re-run the tool to regenerate.",
    "",
    `tenant_id            = "${ctx.tenantId}"`,
    `provision_dns        = true`,
    `dns_provider         = "${ctx.provider}"`,
    `dns_zone_name        = "${ctx.zoneName}"`,
    `dns_record_subdomain = "${ctx.subdomain}"`,
  ];
  for (const [k, v] of Object.entries(ctx.extras)) {
    if (v !== "" && v != null) {
      lines.push(`${k.padEnd(24)} = ${typeof v === "boolean" ? v : `"${v}"`}`);
    }
  }
  lines.push("");

  if (existsSync(path)) {
    appendFileSync(path, "\n" + lines.join("\n"));
  } else {
    writeFileSync(path, lines.join("\n"));
  }
}

function persistToKeychain(tenantId, credentials) {
  const stored = [];
  for (const [k, v] of Object.entries(credentials)) {
    if (v != null && v !== "") {
      storeSecret(tenantId, k, String(v));
      stored.push(k);
    }
  }
  return stored;
}

function writeEnv(path, ctx) {
  const lines = [
    "#!/bin/sh",
    "# Tenant DNS credentials — source before running terraform.",
    "# Generated by medbrains-setup-tenant-dns.",
    "",
  ];

  if (ctx.provider === "route53") {
    lines.push(verifyAwsBlock());
  } else if (ctx.provider === "azure") {
    lines.push(verifyAzureBlock());
  } else if (ctx.provider === "google") {
    lines.push(verifyGoogleBlock());
  } else if (ctx.useKeychain) {
    lines.push(`# Pulls secrets from the OS keychain — no plaintext on disk.`);
    for (const key of ctx.storedKeys) {
      lines.push(retrievalSnippet(key, ctx.tenantId, key));
    }
    lines.push("");
    lines.push(verifyKeychainPopulated(ctx.storedKeys));
  } else {
    lines.push("# WARNING: plaintext credentials below. DO NOT COMMIT.");
    for (const [k, v] of Object.entries(ctx.credentials)) {
      lines.push(`export ${k}=${shellQuote(v)}`);
    }
  }
  lines.push("");
  writeFileSync(path, lines.join("\n"), { mode: 0o600 });
}

function shellQuote(v) {
  return `'${String(v).replace(/'/g, "'\\''")}'`;
}

function verifyAwsBlock() {
  return [
    "# AWS Route53 uses the operator's existing AWS credentials.",
    "# Run `aws sso login` (or set AWS_PROFILE) before sourcing this.",
    "",
    'if ! aws sts get-caller-identity >/dev/null 2>&1; then',
    '  echo "ERROR: aws sts get-caller-identity failed." >&2',
    '  echo "Run \\`aws sso login\\` or export AWS_PROFILE first." >&2',
    "  return 1 2>/dev/null || exit 1",
    "fi",
  ].join("\n");
}

function verifyAzureBlock() {
  return [
    "# Azure DNS uses the operator's existing az login session.",
    "# Run `az login` before sourcing this.",
    "",
    'if ! az account show >/dev/null 2>&1; then',
    '  echo "ERROR: az account show failed." >&2',
    '  echo "Run \\`az login\\` first." >&2',
    "  return 1 2>/dev/null || exit 1",
    "fi",
    "",
    'export ARM_SUBSCRIPTION_ID="$(az account show --query id -o tsv)"',
    'export ARM_TENANT_ID="$(az account show --query tenantId -o tsv)"',
  ].join("\n");
}

function verifyGoogleBlock() {
  return [
    "# Google Cloud DNS uses Application Default Credentials.",
    "# Run `gcloud auth application-default login` before sourcing.",
    "",
    'if ! gcloud auth application-default print-access-token >/dev/null 2>&1; then',
    '  echo "ERROR: gcloud ADC missing." >&2',
    '  echo "Run \\`gcloud auth application-default login\\` first." >&2',
    "  return 1 2>/dev/null || exit 1",
    "fi",
  ].join("\n");
}

function verifyKeychainPopulated(keys) {
  if (keys.length === 0) return "";
  const checks = keys.map(
    (k) =>
      `if [ -z "$${k}" ]; then echo "ERROR: ${k} not in keychain. Re-run setup-tenant-dns." >&2; return 1 2>/dev/null || exit 1; fi`,
  );
  return checks.join("\n");
}

async function collectProviderExtras(provider) {
  const out = {};
  if (provider === "azure") {
    out.dns_azure_resource_group = await ask("Azure resource group hosting the zone");
  } else if (provider === "google") {
    out.dns_google_project = await ask("GCP project id");
    out.dns_google_managed_zone = await ask(
      "GCP Cloud DNS managed zone resource name (often differs from zone)",
    );
  } else if (provider === "namecheap") {
    out.dns_namecheap_overwrite = await askYesNo(
      "Use Namecheap OVERWRITE mode (deletes existing records)?",
      false,
    );
  }
  return out;
}

async function collectCredentials(provider) {
  const out = {};
  switch (provider) {
    case "godaddy":
      out.GODADDY_API_KEY = await askSecret("GoDaddy API key");
      out.GODADDY_API_SECRET = await askSecret("GoDaddy API secret");
      break;
    case "cloudflare":
      out.CLOUDFLARE_API_TOKEN = await askSecret("Cloudflare API token");
      break;
    case "digitalocean":
      out.DIGITALOCEAN_TOKEN = await askSecret("DigitalOcean API token");
      break;
    case "namecheap":
      out.NAMECHEAP_USER_NAME = await ask("Namecheap account username");
      out.NAMECHEAP_API_USER = await ask("Namecheap API user", out.NAMECHEAP_USER_NAME);
      out.NAMECHEAP_API_KEY = await askSecret("Namecheap API key");
      out.NAMECHEAP_CLIENT_IP = await ask(
        "Namecheap client IP (must be allowlisted in Namecheap admin)",
      );
      break;
    default:
      throw new Error(`collectCredentials called for unsupported provider: ${provider}`);
  }
  return out;
}

async function preflightGoDaddy(key, secret) {
  console.log("\nRunning GoDaddy API pre-flight…");
  const result = await fetch("https://api.godaddy.com/v1/domains", {
    headers: { Authorization: `sso-key ${key}:${secret}` },
  });
  if (result.status === 200) {
    const domains = await result.json();
    console.log(
      `  OK — account qualifies (${Array.isArray(domains) ? domains.length : "?"} domains visible).`,
    );
    return;
  }
  if (result.status === 403) {
    console.error("  FAIL — 403 from GoDaddy. The account does NOT qualify for API access.");
    console.error(
      "  Recommended path: register / keep the domain at GoDaddy, but DELEGATE the apex's NS",
    );
    console.error(
      "  records to Cloudflare (free) and re-run this script with --provider=cloudflare.",
    );
    console.error("  See modules/dns/README.md for details.");
    process.exit(1);
  }
  console.error(`  FAIL — unexpected status ${result.status}: ${await result.text()}`);
  process.exit(1);
}

main()
  .catch((err) => {
    console.error(`\nfailed: ${err.message}\n`);
    process.exit(1);
  })
  .finally(closePrompts);
