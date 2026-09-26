/**
 * Message simulator — what the patient's phone shows after the hospital
 * messages them (RFCs/modules/RFC-MODULE-notification-simulator.md, S1).
 *
 * Needs a backend started with MEDBRAINS_NOTIFY_SIMULATOR=true (make dev reads
 * it from .env). Every step is one a person does: an admin turns on the
 * token-call SMS, a desk calls the patient from the console, and the phone
 * view shows the SMS the patient would have received.
 */
import { expect, test } from "@playwright/test";
import { routeApiDirect } from "../helpers";
import { api, getAuthContextFromCookies } from "../helpers/api";
import { createEncounter, createPatientApi } from "../helpers/journey-steps";
import { getOpdDept } from "../helpers/seed-resolvers";

test.describe("message simulator — the patient's phone", () => {
  test("a patient called from the console receives the token SMS", async ({ page, request }) => {
    const ctx = await getAuthContextFromCookies(request);
    const settings = await api<Array<{ key: string; value: unknown }>>(
      ctx,
      "GET",
      "/api/setup/settings?category=notifications",
    );
    const wasOn = settings.find((row) => row.key === "token_call_sms")?.value === true;
    await api(ctx, "PUT", "/api/setup/settings", {
      category: "notifications",
      key: "token_call_sms",
      value: true,
    });

    try {
      const patient = await createPatientApi(ctx, { firstName: "Asha" });
      const opd = await getOpdDept(ctx);
      await createEncounter(ctx, patient.id, { departmentId: opd.id });

      // The desk calls them.
      await routeApiDirect(page);
      await page.goto("/token-console");
      // A desk works its own department's queue, not the whole hospital's.
      const department = page.getByPlaceholder("All departments");
      await department.click();
      await department.fill(opd.name);
      await page.getByRole("option", { name: opd.name, exact: true }).click();
      const row = page.getByRole("row", { name: new RegExp(`Asha ${patient.last_name}`) });
      await row.getByRole("button", { name: "Call", exact: true }).click();
      await expect(row.getByText("Called", { exact: true })).toBeVisible();

      // What their phone got.
      await page.goto("/admin/message-simulator");
      const picker = page.getByRole("textbox", { name: "Patient" });
      await picker.fill(patient.uhid);
      await page.getByRole("option", { name: new RegExp(patient.uhid) }).click();

      const phone = page.getByLabel("Simulated phone");
      const called = phone
        .getByTestId("simulated-message")
        .filter({ hasText: "sms.token_called" });
      await expect(called).toContainText(
        new RegExp(`Token .* has been called\\. Please come to ${opd.name}\\.`),
        { timeout: 20_000 },
      );
    } finally {
      await api(ctx, "PUT", "/api/setup/settings", {
        category: "notifications",
        key: "token_call_sms",
        value: wasOn,
      });
    }
  });

  test("a number nobody has messaged shows an empty phone, not an error", async ({ page }) => {
    await routeApiDirect(page);
    await page.goto("/admin/message-simulator");
    await page.getByText("Number or email", { exact: true }).click();
    await page.getByLabel("Phone number or email").fill("+91 90000 00001");
    await expect(page.getByText("No SMS sent to this person yet.")).toBeVisible();
  });
});
