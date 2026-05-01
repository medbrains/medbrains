import { test as setup, expect } from "@playwright/test";
import { seedAllFixtures } from "./helpers/seed-fixtures";

/**
 * Authenticate once and save browser storage state for reuse by all tests.
 * Runs as a project dependency before the main test suite.
 */
setup("authenticate as admin", async ({ page, request }) => {
  // Call backend directly (port 3000) — bypasses Vite proxy
  const loginResp = await request.post("http://127.0.0.1:3000/api/auth/login", {
    data: { username: "admin", password: "admin123" },
  });

  // eslint-disable-next-line no-console
  console.log("Login API status:", loginResp.status());

  if (loginResp.status() !== 200) {
    const body = await loginResp.text();
    // eslint-disable-next-line no-console
    console.log("Login error:", body);
    throw new Error(`Login failed with status ${loginResp.status()}`);
  }

  const data = await loginResp.json();

  // Navigate to the app and inject auth state
  await page.goto("/login");
  await expect(page.getByLabel("Username")).toBeVisible({ timeout: 10_000 });

  // Set localStorage auth state (Zustand persist format)
  await page.evaluate(
    (user) => {
      localStorage.setItem(
        "auth-storage",
        JSON.stringify({ state: { user }, version: 0 }),
      );
    },
    data.user,
  );

  // Add cookies from the login response to the browser context
  const setCookieHeader = loginResp.headersArray().filter(
    (h) => h.name.toLowerCase() === "set-cookie",
  );

  // eslint-disable-next-line no-console
  console.log("Set-Cookie headers:", setCookieHeader.length);

  const browserCookies = setCookieHeader
    .map((h) => {
      const parts = h.value.split(";").map((p: string) => p.trim());
      const [nameVal] = parts;
      if (!nameVal) return null;
      const eqIdx = nameVal.indexOf("=");
      if (eqIdx < 0) return null;
      const name = nameVal.slice(0, eqIdx);
      const value = nameVal.slice(eqIdx + 1);

      const httpOnly = parts.some(
        (p: string) => p.toLowerCase() === "httponly",
      );
      const pathMatch = parts.find((p: string) =>
        p.toLowerCase().startsWith("path="),
      );
      const path = pathMatch ? pathMatch.split("=")[1] : "/";

      // Add the cookie under both hosts so request fixtures hitting either
      // 127.0.0.1:3000 (E2E_BACKEND_URL default) or localhost:5173 (Vite)
      // see them. The browser strictly distinguishes 127.0.0.1 ≠ localhost.
      return ["127.0.0.1", "localhost"].map((domain) => ({
        name,
        value,
        domain,
        path: path ?? "/",
        httpOnly,
        secure: false,
        sameSite: "Lax" as const,
      }));
    })
    .filter(Boolean)
    .flat() as Array<{
    name: string;
    value: string;
    domain: string;
    path: string;
    httpOnly: boolean;
    secure: boolean;
    sameSite: "Lax";
  }>;

  if (browserCookies.length > 0) {
    // eslint-disable-next-line no-console
    console.log(
      "Adding cookies:",
      browserCookies.map((c) => `${c.name}@${c.domain}`),
    );
    await page.context().addCookies(browserCookies);
  }

  // Navigate to dashboard — app reads localStorage and renders authenticated state
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });

  // Persist authenticated state
  await page.context().storageState({ path: "e2e/.auth/user.json" });

  // Seed canonical fixtures so smoke + e2e tests hit real rows.
  // Idempotent — skips entities that already exist.
  const csrfToken = data.csrf_token ?? "";
  if (csrfToken) {
    const seedResult = await seedAllFixtures({
      baseUrl: "http://127.0.0.1:3000",
      csrfToken,
      request,
      verbose: process.env.E2E_SEED_VERBOSE === "1",
    });
    // eslint-disable-next-line no-console
    console.log(
      `[seed] created=${seedResult.created.length} reused=${seedResult.reused.length} failed=${seedResult.failed.length}`,
    );
    if (seedResult.failed.length > 0 && process.env.E2E_SEED_STRICT === "1") {
      throw new Error(
        `Seed failures (strict mode): ${seedResult.failed.map((f) => `${f.key}: ${f.reason}`).join("; ")}`,
      );
    }
  }
});
