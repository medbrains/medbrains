/**
 * The hospital decides which notices go out (#205). The administrator sees
 * every notice the system can send — report ready, claim approved,
 * prescription expiring, low stock, serious incident — on the Integration Hub,
 * switches one off, and finds it still off when they come back.
 */
import { expect, test } from "./support/world";

const NOTICES = [
  "Tell the patient their lab report is ready",
  "Tell the patient their imaging report is ready",
  "SMS the patient when the insurer approves their claim",
  "SMS the patient three days before a prescription with refills left expires",
  "Email the pharmacists when a drug falls to its reorder level",
  "Email quality and administration about a major or sentinel incident",
];

test("the administrator switches a patient notice off and it stays off", async ({ hospital }) => {
  test.setTimeout(90_000);
  const page = await hospital.asAdmin();
  await page.goto("/admin/integration-hub");
  for (const notice of NOTICES) {
    await expect(page.getByRole("row").filter({ hasText: notice })).toBeVisible();
  }

  const row = page.getByRole("row").filter({ hasText: NOTICES[2] });
  const toggle = row.getByRole("switch");
  await expect(toggle).toBeChecked();
  await toggle.click({ force: true });
  await expect(row).toContainText("Disabled");

  await page.reload();
  const again = page.getByRole("row").filter({ hasText: NOTICES[2] });
  await expect(again).toContainText("Disabled");
  await expect(again.getByRole("switch")).not.toBeChecked();

  // Put it back for the rest of the suite.
  await again.getByRole("switch").click({ force: true });
  await expect(again).toContainText("Active");
});
