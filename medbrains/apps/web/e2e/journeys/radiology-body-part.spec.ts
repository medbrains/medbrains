/**
 * A radiology order's body part is picked on the body and stored as a code
 * and a side — wrong-side imaging starts as an ambiguous free-text field.
 */
import { api } from "../helpers/api";
import { createPatientApi } from "../helpers/journey-steps";
import { expect, test } from "./support/world";

interface OrderRow {
  patient_id: string;
  body_part: string | null;
  body_part_code: string | null;
  body_part_laterality: string | null;
}

test("a radiology order's body part is picked on the body", async ({ hospital }) => {
  test.setTimeout(120_000); // the anatomy model is ~33 MB on first open
  const patient = await createPatientApi(hospital.admin);
  const page = await hospital.asAdmin();
  await page.goto("/radiology");
  await page.getByRole("button", { name: "New Order" }).click();
  const order = page.getByRole("dialog", { name: "New Radiology Order" });

  await order.getByRole("textbox", { name: "Patient" }).fill(patient.uhid);
  await page.getByRole("option", { name: new RegExp(patient.uhid) }).click();
  await order.getByRole("combobox", { name: "Modality" }).click();
  await page.getByRole("option").first().click();

  await order.getByRole("button", { name: "Pick body part on the body" }).click();
  const picker = page.getByRole("dialog", { name: "Pick body part" });
  await picker.getByLabel("Find a region or structure").fill("Left patella");
  await page.getByRole("option", { name: "Left patella", exact: true }).click();
  await picker.getByRole("button", { name: "Use this site" }).click();
  await expect(order.getByRole("textbox", { name: "Body Part" })).toHaveValue("Left patella");

  await order.getByRole("button", { name: "Create Order" }).click();
  await expect(order).toBeHidden();

  const placed = await api<{ orders: OrderRow[] } | OrderRow[]>(
    hospital.admin,
    "GET",
    `/api/radiology/orders?patient_id=${patient.id}`,
  );
  const rows = Array.isArray(placed) ? placed : placed.orders;
  const mine = rows.find((r) => r.patient_id === patient.id);
  expect(mine?.body_part_code, "the picked structure's code is stored").toMatch(/^FMA\d+$/);
  expect(mine?.body_part_laterality).toBe("left");
});
