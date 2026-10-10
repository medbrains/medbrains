/**
 * Home delivery: the pharmacist sends a dispensed order home with the
 * hospital's runner, cash on delivery; the patient is texted a code; the
 * runner, who sees only their own deliveries, hands the medicines over
 * against it and records the cash. Controlled and cold-chain rules, the
 * cash-on-delivery record and prepaid-before-dispatch are proven in the
 * server's `pharmacy_delivery_test`.
 */
import { api, getAuthContextFromCookies } from "../helpers/api";
import {
  createPatientApi,
  createPharmacyOrder,
  dispensePharmacyOrder,
} from "../helpers/journey-steps";
import { latestDeliveryCode } from "../helpers/patient-sms";
import { expect, test } from "./support/world";

interface CatalogRow {
  id: string;
  name: string;
  is_active: boolean;
  is_controlled: boolean;
  needs_cold_chain: boolean;
  drug_schedule: string | null;
  current_stock: number;
}

test("a runner delivers a dispensed order against the patient's code", async ({
  hospital,
  request,
}) => {
  test.setTimeout(180_000);
  const admin = await getAuthContextFromCookies(request);
  // Cash on delivery for everyone here, and a fee on the bill.
  await hospital.setting("pharmacy", "cod_min_deliveries", 0);
  await hospital.setting("pharmacy", "delivery_fee", 40);
  const phone = `9${String(Date.now()).slice(-9)}`;
  const patient = await createPatientApi(admin, { phone });
  const catalog = await api<CatalogRow[]>(admin, "GET", "/api/pharmacy/catalog");
  const drug = catalog.find(
    (c) =>
      c.is_active &&
      !c.is_controlled &&
      !c.needs_cold_chain &&
      !["X", "H1", "NDPS"].includes(c.drug_schedule ?? "") &&
      c.current_stock >= 10,
  );
  if (!drug) throw new Error("a stocked drug that can travel");
  const order = await createPharmacyOrder(admin, {
    patientId: patient.id,
    drugId: drug.id,
    drugName: drug.name,
    quantity: 2,
  });
  await dispensePharmacyOrder(admin, order.id);
  const runnerName = `Ravi Runner ${String(Date.now()).slice(-5)}`;
  const runner = await hospital.newStaff("delivery_runner", runnerName);

  // The pharmacist arranges it from the order.
  const pharmacist = await hospital.as("pharmacist");
  await pharmacist.goto(`/pharmacy/orders/${order.id}`);
  await pharmacist.getByRole("button", { name: "Arrange home delivery" }).click();
  const drawer = pharmacist.getByRole("dialog", { name: "Arrange home delivery" });
  await drawer.getByRole("textbox", { name: "Address" }).fill("12 Lake Road, Karaikudi");
  await drawer.getByRole("textbox", { name: "PIN code" }).fill("630001");
  await drawer.getByPlaceholder("Pick a runner").click();
  await pharmacist.getByRole("option", { name: runnerName }).click();
  await drawer.getByText("Cash on delivery", { exact: true }).click();
  await drawer.getByRole("button", { name: "Arrange delivery" }).click();

  // It waits on Home deliveries until dispatched.
  await expect(pharmacist).toHaveURL(/\/pharmacy\/deliveries/);
  await pharmacist.getByText("To dispatch", { exact: true }).first().click();
  const arranged = pharmacist.getByRole("row").filter({ hasText: patient.uhid });
  await expect(arranged).toContainText(runnerName);
  await expect(arranged).toContainText("Cash on delivery");
  await arranged.getByRole("button", { name: "Dispatch" }).click();
  await expect(arranged).toBeHidden();

  // The runner sees it on their list and hands it over against the code.
  const run = runner.page;
  await run.goto("/pharmacy/deliveries");
  const mine = run.getByRole("row").filter({ hasText: patient.uhid });
  await expect(mine).toContainText("12 Lake Road");
  await mine.getByRole("button", { name: "Delivered", exact: true }).click();
  const handover = run.getByRole("dialog", { name: "Hand over the medicines" });
  await handover.getByRole("textbox", { name: "Patient's code" }).fill("000000");
  await handover.getByRole("button", { name: "Delivered", exact: true }).click();
  await expect(run.getByText("That code doesn't match", { exact: false })).toBeVisible();
  await handover.getByRole("textbox", { name: "Patient's code" }).fill(latestDeliveryCode(phone));
  await handover.getByRole("button", { name: "Delivered", exact: true }).click();
  await expect(handover).toBeHidden();

  const list = await api<{ deliveries: { patient_id: string; status: string; cash_collected: string }[] }>(
    admin,
    "GET",
    "/api/pharmacy/deliveries?status=delivered",
  );
  const done = list.deliveries.find((d) => d.patient_id === patient.id);
  expect(done?.status).toBe("delivered");
  expect(Number(done?.cash_collected)).toBeGreaterThan(0);
});
