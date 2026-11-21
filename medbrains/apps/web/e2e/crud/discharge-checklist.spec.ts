import { expect, test } from "@playwright/test";
import { navigateTo } from "../helpers";
import { api, getAuthContextFromCookies } from "../helpers/api";
import { admitPatientToOpen } from "../helpers/journey-steps";

/**
 * The discharge checklist, which nothing could ever create.
 *
 * `initDischargeChecklist` posts no body; the handler demanded one, so the
 * pair had never been exercised and the table could not gain a row. The tab
 * hid its block behind `items.length > 0`, and the checkbox was readOnly — so
 * even a populated checklist could not be worked through. An MRD deficiency
 * metric counted the permanently empty table.
 */
test.describe("IPD discharge checklist", () => {
  test("the tab offers a way to start one, or shows the items", async ({ page, request }) => {
    // The workspace addresses its sections by hash, which is steadier than
    // clicking through an action rail whose labels carry readiness counts.
    const { admissionId } = await admitPatientToOpen(await getAuthContextFromCookies(request));
    await navigateTo(page, `/ipd/admissions/${admissionId}#discharge`);

    // Either the maker (none started) or the checklist itself — never a blank
    // panel, which was the old behaviour and read as "nothing to do".
    await expect(
      page
        .getByRole("button", { name: /start checklist/i })
        .or(page.getByText(/Discharge Checklist/i))
        .first(),
    ).toBeVisible({ timeout: 15000 });
  });

  test("a started checklist shows its items as tickable", async ({ page, request }) => {
    // The workspace addresses its sections by hash, which is steadier than
    // clicking through an action rail whose labels carry readiness counts.
    const ctx = await getAuthContextFromCookies(request);
    const { admissionId } = await admitPatientToOpen(ctx);
    await api(ctx, "POST", `/api/ipd/admissions/${admissionId}/discharge-checklist`);
    await navigateTo(page, `/ipd/admissions/${admissionId}#discharge`);

    const box = page.getByRole("checkbox", { name: /Discharge summary prepared/i });
    await expect(box).toBeVisible({ timeout: 15000 });
    await expect(box).toBeEnabled();
  });
});
