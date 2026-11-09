/**
 * The TPA desk's pre-auth board. Two things a billing clerk must be able to
 * trust: a board that failed to load says so, rather than showing five empty
 * stages (which reads as "no patient is waiting on an insurer"), and each
 * claim opens from the keyboard as well as the mouse.
 *
 * The claims list is answered by the test (a fault, or one claim): creating a
 * real cashless claim needs a policy, an admission and an insurer, none of
 * which this screen is about.
 */
import type { Page } from "@playwright/test";
import { expect, test } from "./support/world";

const CLAIMS = "**/api/billing/insurance-claims*";

/** One pre-auth waiting on the insurer, as the list endpoint returns it. */
const CLAIM = {
  id: "00000000-0000-4000-8000-00000000c1a1",
  claim_number: "PA-UX-0001",
  insurance_provider: "Test Insurer",
  tpa_name: "Test TPA",
  status: "pre_auth_requested",
  pre_auth_amount: "50000",
  approved_amount: null,
  created_at: new Date().toISOString(),
  submitted_at: new Date().toISOString(),
};

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

test("a claim on the board opens from the keyboard", async ({ hospital }) => {
  const page = await hospital.as("billing_clerk");
  await answerClaims(page, 200, [CLAIM]);
  await page.goto("/billing/tpa-pipeline");
  const link = page.getByRole("link", { name: CLAIM.claim_number });
  await link.focus();
  await expect(link).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(new RegExp(`claim_id=${CLAIM.id}`));
});
