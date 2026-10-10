/**
 * A patient on a regular medicine asks for a refill from the portal. The drug
 * needs the doctor's say-so, so the request waits in the prescriber's
 * sign-offs; the doctor approves it, it lands in the pharmacy's queue as a
 * refill, and the patient's portal says so. The pharmacy-only route (no
 * doctor) needs a month to pass and is covered by the server's
 * `patient_refill_requests_test`.
 */
import { api, getAuthContextFromCookies, loginAsRoleApi, withStepUp } from "../helpers/api";
import {
  createEncounter,
  createPatientApi,
  dispensePharmacyOrder,
} from "../helpers/journey-steps";
import { latestPortalCode } from "../helpers/patient-sms";
import { expect, test } from "./support/world";

interface CatalogRow {
  id: string;
  name: string;
  is_active: boolean;
  is_controlled: boolean;
  drug_schedule: string | null;
  refill_policy: string;
  current_stock: number;
}

test("a patient asks for a refill and the doctor sends it to the pharmacy", async ({
  hospital,
  request,
}) => {
  test.setTimeout(180_000);
  const admin = await getAuthContextFromCookies(request);
  const doctorCtx = await withStepUp(await loginAsRoleApi(request, "doctor"));
  const tenant = await api<{ code: string }>(admin, "GET", "/api/setup/tenant");
  const phone = `9${String(Date.now()).slice(-9)}`;
  const patient = await createPatientApi(admin, { phone });
  const visit = await createEncounter(doctorCtx, patient.id);
  const catalog = await api<CatalogRow[]>(admin, "GET", "/api/pharmacy/catalog");
  const drug = catalog.find(
    (c) =>
      c.is_active &&
      !c.is_controlled &&
      !["X", "H1", "NDPS"].includes(c.drug_schedule ?? "") &&
      c.refill_policy === "doctor_approval" &&
      c.current_stock >= 60,
  );
  if (!drug) throw new Error("a formulary drug that needs the doctor to refill");
  const written = await api<{ pharmacy_rx_queue_id: string }>(
    doctorCtx,
    "POST",
    `/api/opd/encounters/${visit}/prescriptions`,
    {
    items: [
      {
        drug_name: drug.name,
        catalog_item_id: drug.id,
        dosage: "1 tab",
        frequency: "OD",
        duration: "30 days",
        route: "oral",
      },
    ],
    },
  );
  // The first supply was dispensed at that visit.
  const pharmacistCtx = await loginAsRoleApi(request, "pharmacist");
  await api(pharmacistCtx, "PUT", `/api/pharmacy/rx-queue/${written.pharmacy_rx_queue_id}/review`, {
    action: "approved",
  });
  const orders = await api<{ orders: { id: string }[] }>(
    admin,
    "GET",
    `/api/pharmacy/orders?patient_id=${patient.id}`,
  );
  await dispensePharmacyOrder(pharmacistCtx, orders.orders[0]?.id ?? "");

  // The patient signs in with the code texted to them, and asks.
  const portal = await hospital.asPublic();
  await portal.goto(`/portal/${tenant.code}`);
  await portal.getByRole("textbox", { name: "Mobile number" }).fill(phone);
  await portal.getByRole("button", { name: "Send code" }).click();
  await portal.getByRole("textbox", { name: "Code" }).fill(latestPortalCode(phone));
  await portal.getByRole("button", { name: "Sign in" }).click();
  await portal.getByRole("tab", { name: "Medicines" }).click();
  const card = portal.getByRole("region", { name: `Refill: ${drug.name}` });
  await expect(card).toContainText("approves it first");
  await card.getByRole("button", { name: "Request refill" }).click();
  await expect(card).toContainText("With your doctor");

  // The prescriber finds it in their sign-offs and approves.
  const doctor = await hospital.as("doctor");
  await doctor.goto("/doctor/signoffs");
  await doctor.getByRole("tab", { name: /Refill request/ }).click();
  const row = doctor
    .getByRole("tabpanel")
    .locator(".mantine-Card-root")
    .filter({ hasText: patient.uhid });
  await expect(row).toContainText(drug.name);
  const decided = doctor.waitForResponse((r) => /refill-requests\/[^/]+\/decide$/.test(r.url()));
  await row.getByRole("button", { name: "Approve refill" }).click();
  expect((await decided).status()).toBe(200);

  // The pharmacy's queue has it, marked as a refill.
  const pharmacist = await hospital.as("pharmacist");
  await pharmacist.goto("/pharmacy#rx-queue");
  await pharmacist.getByRole("textbox", { name: "Search prescriptions" }).fill(patient.first_name);
  const queued = pharmacist.getByRole("row").filter({ hasText: patient.first_name });
  await expect(queued).toContainText("Refill 1");

  // And the patient sees where it went.
  await portal.reload();
  await portal.getByRole("tab", { name: "Medicines" }).click();
  await expect(portal.getByText("Sent to the pharmacy").first()).toBeVisible();
});
