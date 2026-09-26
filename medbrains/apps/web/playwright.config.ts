import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = path.dirname(fileURLToPath(import.meta.url));
const authStatePath = path.join(webRoot, "e2e/.auth/user.json");

export default defineConfig({
  testDir: "./e2e",
  globalTeardown: "./e2e/global-teardown.ts",
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
    ignoreHTTPSErrors: true,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    { name: "setup", testMatch: /global-setup\.ts/ },
    // API-only layers. They talk HTTP and never open a page, so they neither
    // need a browser binary nor the browser login the `setup` project performs.
    { name: "api", testMatch: /(smoke\/.*\.smoke\.spec|identity\/identity\.spec)\.ts/ },

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
      // e2e/journeys/ used to fall through to the default project, which the
      // deploy gate never runs; four journey specs sat outside it.
      testMatch: /(scenarios|journeys)\/.*\.spec\.ts/,
      // Several roles on one dev server in parallel: screens take longer than 5s.
      expect: { timeout: 10_000 },
      use: {
        ...devices["Desktop Chrome"],
        storageState: authStatePath,
      },
      dependencies: ["setup"],
    },

    // Accessibility — UI journeys with WCAG 2 AAA machine-testable gates
    // Nothing breaks when used: every page and tab each role can reach.
    {
      name: "robustness",
      testMatch: /robustness\/.*\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
    },
    {
      name: "accessibility",
      testMatch: /accessibility\/.*\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        storageState: authStatePath,
      },
      dependencies: ["setup"],
    },

    // Linkages — one module's action asserted through another module's
    // effect. Longer per-test budget because pipeline effects are polled.
    {
      name: "linkages",
      testMatch: /linkages\/.*\.spec\.ts/,
      timeout: 90_000,
      use: {
        ...devices["Desktop Chrome"],
        storageState: authStatePath,
      },
      dependencies: ["setup"],
    },

    // Screens — every nav route rendered as a role that holds its gate, and
    // refused for one that does not. Logs in per role, so no storageState.
    {
      // Layer 1b — generated negatives: a write with its required fields
      // missing is refused as 400/422, a write against an absent record is
      // refused as 404. Logs in itself, like smoke.
      name: "writes",
      testMatch: /writes\/.*\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
    },
    {
      name: "screens",
      testMatch: /screens\/.*\.spec\.ts/,
      timeout: 60_000,
      use: { ...devices["Desktop Chrome"] },
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
      testIgnore:
        /(mock|smoke\/api|writes|crud|forms|analytics|rbac|passmark|scenarios|journeys|accessibility|robustness|linkages|screens)\/.*\.spec\.ts/,
    },

    {
      // AI-driven regression tests (opt-in). The specs self-skip unless PASSMARK_ENABLED=1 +
      // ANTHROPIC_API_KEY are set, so this project is inert in the normal gate. See e2e/passmark/README.md.
      name: "passmark",
      testMatch: /passmark\/.*\.passmark\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        storageState: authStatePath,
      },
      dependencies: ["setup"],
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
