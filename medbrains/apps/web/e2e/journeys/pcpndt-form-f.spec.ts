/**
 * A radiologist opens an ultrasound ordered for a pregnant woman. The order
 * shows that a PC-PNDT Form F is required; it is completed in place —
 * indication, performing doctor, children, result, both declarations — and
 * the order then shows it complete, ready to print.
 */
import { api } from "../helpers/api";
import { createPatientApi } from "../helpers/journey-steps";
import { expect, test } from "./support/world";

test("an ultrasound for a pregnant woman carries its Form F, completed from the order", async ({
  hospital,
}) => {
  test.setTimeout(90_000);
  const t = Date.now().toString(36).toUpperCase().slice(-6);
  const patient = await createPatientApi(hospital.admin, {
    firstName: "Meena",
    lastName: `FormF${t}`,
    gender: "female",
  });
  const usg = await api<{ id: string }>(hospital.admin, "POST", "/api/radiology/modalities", {
    code: `USJ${t}`,
    name: `Ultrasound ${t}`,
    is_ultrasound: true,
  });
  const order = await api<{ id: string }>(hospital.admin, "POST", "/api/radiology/orders", {
    patient_id: patient.id,
    modality_id: usg.id,
    body_part: "Obstetric",
    patient_pregnant: true,
  });

  const page = await hospital.asAdmin();
  await page.goto("/radiology");
  const row = page.getByRole("row").filter({ hasText: `FormF${t}` }).first();
  await row.getByRole("button", { name: "View details" }).click();
  const drawer = page.getByRole("dialog", { name: "Order Detail" });
  const notice = drawer.getByTestId("order-form-f");
  await expect(notice).toContainText("Required for this scan");

  await notice.getByRole("button", { name: "Complete Form F" }).click();
  const form = page.getByRole("form", { name: "Complete Form F" });
  await form.getByRole("button", { name: "Complete Form F" }).click();
  await expect(form.getByText("Her declaration is required")).toBeVisible();

  await form.getByRole("combobox", { name: "Indication" }).click();
  await page.getByRole("option", { name: "Estimation of gestational age (dating)" }).click();
  await form.getByRole("textbox", { name: "Performed by" }).click();
  await page.getByRole("option").first().click();
  await form.getByRole("textbox", { name: "Living sons" }).fill("1");
  await form.getByRole("textbox", { name: "Result of the scan" }).fill("Viable intrauterine pregnancy.");
  await form.getByLabel("She has declared she does not want to know the sex of her foetus").check();
  await form.getByLabel("I declare I have neither detected nor disclosed the sex of the foetus").check();
  await form.getByRole("button", { name: "Complete Form F" }).click();

  await expect(notice).toContainText("Complete, with both declarations.");
  const [form_f] = await api<Array<{ status: string }>>(
    hospital.admin,
    "GET",
    `/api/regulatory/pcpndt-forms?radiology_order_id=${order.id}`,
  );
  expect(form_f?.status).toBe("submitted");
});
