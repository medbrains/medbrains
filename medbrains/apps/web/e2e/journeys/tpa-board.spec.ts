/**
 * The TPA desk's pre-auth board. A board that failed to load says so, rather
 * than showing five empty stages (which reads as "no patient is waiting on an
 * insurer").
 *
 * The claims list is answered by the test (a fault): creating a
 * real cashless claim needs a policy, an admission and an insurer, none of
 * which this screen is about.
 */
import type { Page } from "@playwright/test";
import { expect, test } from "./support/world";

const CLAIMS = "**/api/billing/insurance-claims*";

/** Answer the claims list with `body` at `status`. */
async function answerClaims(page: Page, status: number, body: unknown): Promise<void> {
  await page.route(CLAIMS, (route) =>
    route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) }),
  );
}

test("a board that did not load says so, not that no claim is waiting", async ({ hospital }) => {
  const page = await hospital.as("billing_clerk");
  await answerClaims(page, 500, { error: "internal" });
  await page.goto("/billing/tpa-pipeline");
  await expect(page.getByRole("alert").filter({ hasText: "Claims did not load" })).toBeVisible();
  await expect(page.getByText("Nothing here.")).toHaveCount(0);
});
