/**
 * A patient on regular medicine comes back. The doctor repeats the last
 * visit's prescription in one action instead of typing it again — and a drug
 * the doctor took off that prescription is not quietly restarted.
 */
import { api, loginAsRoleApi, withStepUp } from "../helpers/api";
import { getE2EIdentity } from "../helpers/e2e-identities";
import { createEncounter, createPatientApi } from "../helpers/journey-steps";
import { expect, test } from "./support/world";

interface CatalogRow {
  id: string;
  name: string;
  is_active: boolean;
  is_controlled: boolean;
  drug_schedule: string | null;
}

test("a doctor repeats the last visit's prescription", async ({ hospital, request }) => {
  test.setTimeout(120_000);
  const doctorCtx = await withStepUp(await loginAsRoleApi(request, "doctor"));
  const patient = await createPatientApi(hospital.admin);
  const catalog = await api<CatalogRow[]>(hospital.admin, "GET", "/api/pharmacy/catalog");
  const [kept, stopped] = catalog.filter(
    (c) => c.is_active && !c.is_controlled && !["X", "H1", "NDPS"].includes(c.drug_schedule ?? ""),
  );
  if (!kept || !stopped) throw new Error("two uncontrolled formulary drugs");

  // Last visit: two drugs, then the doctor edits one of them off.
  const lastVisit = await createEncounter(doctorCtx, patient.id);
  const line = (c: CatalogRow) => ({
    drug_name: c.name,
    catalog_item_id: c.id,
    dosage: "1 tab",
    frequency: "OD",
    duration: "30 days",
    route: "oral",
  });
  const rx = await api<{ prescription: { id: string } }>(
    doctorCtx,
    "POST",
    `/api/opd/encounters/${lastVisit}/prescriptions`,
    { items: [line(kept), line(stopped)] },
  );
  await api(doctorCtx, "PUT", `/api/opd/prescriptions/${rx.prescription.id}`, {
    items: [line(kept)],
  });
  const today = await createEncounter(doctorCtx, patient.id);

  const page = await hospital.as("doctor");
  await page.goto(`/opd/encounters/${today}`);
  await page.getByRole("tab", { name: "Prescriptions" }).click();
  await page.getByRole("button", { name: "Repeat last prescription" }).click();

  // The save that lands after the doctor confirms (the first asks for it).
  const saved = page.waitForResponse(
    (r) =>
      r.url().endsWith(`/api/opd/encounters/${today}/prescriptions`) &&
      r.request().method() === "POST" &&
      r.status() !== 403,
  );
  // Prescribing asks the doctor to confirm it's them.
  await page.getByRole("button", { name: "Sign & save" }).click();
  const confirm = page.getByRole("dialog", { name: "Confirm it's you" });
  await confirm.getByLabel("Password").fill(getE2EIdentity("doctor").password);
  await confirm.getByRole("button", { name: "Confirm" }).click();
  const response = await saved;
  expect(response.status(), await response.text()).toBe(200);
  const body = (await response.json()) as {
    items: { catalog_item_id: string; duration: string; frequency: string }[];
  };
  expect(body.items.map((i) => i.catalog_item_id)).toEqual([kept.id]);
  expect(body.items[0]?.duration, "repeated as written, not re-defaulted").toContain("30");
  expect(body.items[0]?.frequency).toBe("OD");
});
