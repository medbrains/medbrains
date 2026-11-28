/**
 * Playwright for the staging update run (scripts/staging_update_e2e.sh): one
 * worker against the staging box, no dev server, no global setup. Results and
 * traces go to the run directory the script made.
 */
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: /update\.staging\.ts/,
  workers: 1,
  retries: 0,
  timeout: 300_000,
  outputDir: `${process.env.STAGING_RUN ?? "/tmp/medbrains-staging"}/playwright`,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL,
    // The production CSP refuses the axe script the journey page objects inject.
    bypassCSP: true,
    // A desk monitor: at 720 px the department list opens off-screen and cannot be clicked.
    viewport: { width: 1366, height: 1000 },
    trace: "retain-on-failure",
  },
});
