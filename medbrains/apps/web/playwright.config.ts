import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = path.dirname(fileURLToPath(import.meta.url));
const authStatePath = path.join(webRoot, "e2e/.auth/user.json");

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [
    ...(process.env.CI
      ? [["github" as const]]
      : [["html" as const]]),
  ],
  timeout: 30_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    { name: "setup", testMatch: /global-setup\.ts/ },

    // Layer 1 — API smoke (auto-generated, REST-only, no UI auth needed)
    {
      name: "smoke",
      testMatch: /smoke\/api\/.*\.smoke\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
    },

    // Layer 2 — Module CRUD (REST-only)
    {
      name: "crud",
      testMatch: /crud\/.*\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        storageState: authStatePath,
      },
      dependencies: ["setup"],
    },

    // Layer 3 — Form-field validation (UI)
    {
      name: "forms",
      testMatch: /forms\/.*\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        storageState: authStatePath,
      },
      dependencies: ["setup"],
    },

    // Layer 4 — Analytics endpoints (REST-only)
    {
      name: "analytics",
      testMatch: /analytics\/.*\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        storageState: authStatePath,
      },
      dependencies: ["setup"],
    },

    // Layer 6 — RBAC matrix (REST-only, multi-role login per spec)
    {
      name: "rbac",
      testMatch: /rbac\/.*\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
    },

    // Layer 5 — End-to-end journeys (hybrid UI + REST)
    {
      name: "journeys",
      testMatch: /scenarios\/.*\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        storageState: authStatePath,
      },
      dependencies: ["setup"],
    },

    // Default project — every spec not in a layered directory.
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: authStatePath,
      },
      dependencies: ["setup"],
      testIgnore: /(mock|smoke\/api|crud|forms|analytics|rbac)\/.*\.spec\.ts/,
    },

    {
      name: "mock-chromium",
      testMatch: /mock\/.*\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],
});
