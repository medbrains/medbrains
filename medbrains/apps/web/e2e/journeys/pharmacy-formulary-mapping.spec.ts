/**
 * A prescriber types a drug the formulary does not know ("MONTEH-IC"). The
 * pharmacist is told before approving, maps the line to the real product,
 * and approval goes through — billed and ordered as that product.
 *
 * Before this, approval failed with "Map … to the pharmacy formulary" and no
 * screen offered a way to map it.
 */
import { api, getAuthContextFromCookies, loginAsRoleApi, withStepUp } from "../helpers/api";
import { createEncounter, createPatientApi } from "../helpers/journey-steps";
import { expect, test } from "./support/world";

test("a pharmacist maps an unknown drug to the formulary and approves", async ({ hospital, request }) => {
  test.setTimeout(120_000);
  const admin = await getAuthContextFromCookies(request);
  const doctor = await withStepUp(await loginAsRoleApi(request, "doctor"));
  const patient = await createPatientApi(admin);
  const encounterId = await createEncounter(doctor, patient.id);
  const rx = await api<{ pharmacy_rx_queue_id: string }>(
    doctor,
    "POST",
    `/api/opd/encounters/${encounterId}/prescriptions`,
    {
      items: [
        { drug_name: "MONTEH-IC", dosage: "1 tab", frequency: "OD", duration: "5 days", route: "oral" },
      ],
    },
  );
  expect(rx.pharmacy_rx_queue_id, "the line reaches the pharmacist's queue").toBeTruthy();
  // The product the pharmacist will map to: on the shelf, and not a
  // controlled drug (which brings its own register into the approval).
  const catalog = await api<
    { name: string; is_active: boolean; current_stock: number; is_controlled: boolean }[]
  >(admin, "GET", "/api/pharmacy/catalog");
  const product = catalog.find((c) => c.is_active && !c.is_controlled && c.current_stock >= 10);
  if (!product) throw new Error("a stocked, uncontrolled product to map to");

  const page = await hospital.as("pharmacist");
  await page.goto("/pharmacy#rx-queue");
  // The queue is long; the pharmacist finds the patient as a person would.
  await page.getByRole("textbox", { name: "Search prescriptions" }).fill(patient.first_name);
  const row = page.getByRole("row").filter({ hasText: patient.first_name });
  // Two identifiers on the row: the name and the UHID.
  await expect(row).toContainText(patient.uhid);
  await row.getByRole("button", { name: "Approve prescription review" }).click();
  const dialog = page.getByRole("dialog", { name: "Approve and bill prescription" });

  // Told before pressing anything, and the button waits for it.
  await expect(dialog.getByText('Map "MONTEH-IC" to a formulary product to approve.')).toBeVisible();
  const approve = dialog.getByRole("button", { name: "Approve & Create Billing Indent" });
  await expect(approve).toBeDisabled();

  const picker = dialog.getByRole("combobox", { name: 'Map "MONTEH-IC" to formulary' });
  await picker.fill(product.name);
  await page.getByRole("option", { name: new RegExp(`^${escapeRegExp(product.name)}`) }).first().click();
  await expect(dialog.getByText(`Mapped to ${product.name}`)).toBeVisible();
  await expect(approve).toBeEnabled();
  const reviewed = page.waitForResponse((r) => /\/api\/pharmacy\/rx-queue\/[^/]+\/review$/.test(r.url()));
  await approve.click();
  const response = await reviewed;
  expect(response.status(), await response.text()).toBe(200);
  await expect(dialog).toBeHidden();

  // The order is for the product the pharmacist chose.
  const orders = await api<{ orders: { id: string }[] }>(
    admin,
    "GET",
    `/api/pharmacy/orders?patient_id=${patient.id}`,
  );
  expect(orders.orders.length, "approval raised one order").toBe(1);
  const order = await api<{ items: { catalog_item_id: string | null }[] }>(
    admin,
    "GET",
    `/api/pharmacy/orders/${orders.orders[0]?.id}`,
  );
  expect(order.items[0]?.catalog_item_id, "ordered as a formulary product").toBeTruthy();
});

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
