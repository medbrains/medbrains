/**
 * A doctor authorises refills on a regular medicine; the prescription carries
 * its expiry; the pharmacist sees both, and the refill panel says when the
 * next one is due rather than offering it early. Issuing a due refill into
 * the queue is covered by the server's `prescription_refills_test`, which can
 * move the clock.
 */
import { api, getAuthContextFromCookies, loginAsRoleApi, withStepUp } from "../helpers/api";
import { getE2EIdentity } from "../helpers/e2e-identities";
import { createEncounter, createPatientApi } from "../helpers/journey-steps";
import { expect, test } from "./support/world";

interface CatalogRow {
  name: string;
  is_active: boolean;
  is_controlled: boolean;
  drug_schedule: string | null;
  current_stock: number;
}

const DAY_MS = 86_400_000;
const isoDay = (offsetDays: number) =>
  new Date(Date.now() + offsetDays * DAY_MS).toISOString().slice(0, 10);

test("a doctor authorises refills and the pharmacy holds them to the dates", async ({
  hospital,
  request,
}) => {
  test.setTimeout(150_000);
  const admin = await getAuthContextFromCookies(request);
  const doctorCtx = await withStepUp(await loginAsRoleApi(request, "doctor"));
  const patient = await createPatientApi(admin);
  const visit = await createEncounter(doctorCtx, patient.id);
  const catalog = await api<CatalogRow[]>(admin, "GET", "/api/pharmacy/catalog");
  const drug = catalog.find(
    (c) =>
      c.is_active &&
      !c.is_controlled &&
      !["X", "H1", "NDPS"].includes(c.drug_schedule ?? "") &&
      c.current_stock >= 60,
  );
  if (!drug) throw new Error("a stocked, uncontrolled drug");

  // The doctor writes it with two refills a month apart.
  const doctor = await hospital.as("doctor");
  await doctor.goto(`/opd/encounters/${visit}`);
  await doctor.getByRole("tab", { name: "Prescriptions" }).click();
  await doctor.getByRole("textbox", { name: "Search formulary" }).fill(drug.name);
  // Enter adds the top match once the formulary search has answered.
  await expect(async () => {
    await doctor.getByRole("textbox", { name: "Search formulary" }).press("Enter");
    await expect(doctor.getByText("1 medication", { exact: true })).toBeVisible({ timeout: 1_000 });
  }).toPass();
  await doctor.getByRole("textbox", { name: "Refills" }).fill("2");
  await expect(doctor.getByText("2 refills, at least 30 days apart.")).toBeVisible();
  const saved = doctor.waitForResponse(
    (r) =>
      r.url().endsWith(`/api/opd/encounters/${visit}/prescriptions`) &&
      r.request().method() === "POST" &&
      r.status() !== 403,
  );
  await doctor.getByRole("button", { name: "Sign & save" }).click();
  const confirm = doctor.getByRole("dialog", { name: "Confirm it's you" });
  await confirm.getByLabel("Password").fill(getE2EIdentity("doctor").password);
  await confirm.getByRole("button", { name: "Confirm" }).click();
  const response = await saved;
  expect(response.status(), await response.text()).toBe(200);
  const rx = (await response.json()) as {
    prescription: { repeats_allowed: number; repeat_interval_days: number; valid_until: string };
  };
  expect(rx.prescription).toMatchObject({
    repeats_allowed: 2,
    repeat_interval_days: 30,
    // Long enough for both refills.
    valid_until: isoDay(60),
  });

  // The pharmacist approves the prescription itself.
  const pharmacist = await hospital.as("pharmacist");
  await pharmacist.goto("/pharmacy#rx-queue");
  await pharmacist.getByRole("textbox", { name: "Search prescriptions" }).fill(patient.first_name);
  const row = pharmacist.getByRole("row").filter({ hasText: patient.first_name });
  await row.getByRole("button", { name: "Approve prescription review" }).click();
  const dialog = pharmacist.getByRole("dialog", { name: "Approve and bill prescription" });
  const reviewed = pharmacist.waitForResponse((r) => /\/rx-queue\/[^/]+\/review$/.test(r.url()));
  await dialog.getByRole("button", { name: "Approve & Create Billing Indent" }).click();
  expect((await reviewed).status()).toBe(200);

  // On the order, the refills wait for their date.
  const orders = await api<{ orders: { id: string }[] }>(
    admin,
    "GET",
    `/api/pharmacy/orders?patient_id=${patient.id}`,
  );
  await pharmacist.goto(`/pharmacy/orders/${orders.orders[0]?.id}`);
  const refills = pharmacist.getByRole("region", { name: "Refills" });
  await expect(refills).toContainText("0 of 2 used");
  await expect(refills).toContainText("The next refill is due on");
  await expect(refills.getByRole("button", { name: "Issue refill" })).toBeDisabled();
});
