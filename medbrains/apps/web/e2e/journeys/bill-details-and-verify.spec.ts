/**
 * The details a bill prints come from a screen, not the database: an
 * administrator sets the GSTIN, drug licence numbers and UPI ID on Billing
 * settings, and they stay. A printed bill's QR opens a public page that
 * confirms the bill — and refuses a code it didn't print.
 */
import { api } from "../helpers/api";
import { expect, test } from "./support/world";

test("bill details are set on screen and a bill verifies publicly by its code", async ({
  hospital,
}) => {
  const suffix = crypto.randomUUID().slice(0, 6).toUpperCase();
  const licence = `TN-20B-${suffix} / TN-21B-${suffix}`;
  await hospital.setting("billing", "drug_licence", null);
  await hospital.setting("payments", "upi_vpa", null);

  const admin = await hospital.asAdmin();
  await admin.goto("/billing");
  await admin.getByRole("tab", { name: "Settings" }).click();
  const licenceField = admin.getByLabel("Drug licence numbers");
  await licenceField.fill(licence);
  await licenceField.blur();
  const upi = admin.getByLabel("UPI ID");
  await upi.fill("hospital@okaxis");
  await upi.blur();
  await expect
    .poll(async () => {
      const rows = await api<Array<{ key: string; value: unknown }>>(
        hospital.admin,
        "GET",
        "/api/setup/settings?category=billing",
      );
      return rows.find((r) => r.key === "drug_licence")?.value;
    })
    .toBe(licence);
  await admin.reload();
  await admin.getByRole("tab", { name: "Settings" }).click();
  await expect(admin.getByLabel("Drug licence numbers")).toHaveValue(licence);
  await expect(admin.getByLabel("UPI ID")).toHaveValue("hospital@okaxis");

  // A bill, and the code its QR carries.
  const patient = await api<{ id: string }>(hospital.admin, "POST", "/api/patients", {
    first_name: "Verify",
    last_name: `Bill${suffix}`,
    gender: "female",
    date_of_birth: "1990-01-01",
    phone: `98${String(Date.now()).slice(-8)}`,
  });
  const invoice = await api<{ id: string; invoice_number: string }>(
    hospital.admin,
    "POST",
    "/api/billing/invoices",
    { patient_id: patient.id },
  );
  const printed = await api<{ verify_url: string | null }>(
    hospital.admin,
    "GET",
    `/api/print-data/gst-invoice/${invoice.id}`,
  );
  expect(printed.verify_url, "every printed bill carries its verification link").toBeTruthy();
  const link = new URL(printed.verify_url ?? "");

  const visitor = await hospital.asPublic();
  await visitor.goto(`/verify/bill${link.search}`);
  await expect(visitor.getByText("Genuine")).toBeVisible();
  await expect(visitor.getByText(`Bill ${invoice.invoice_number}`, { exact: false })).toBeVisible();
  await visitor.goto(`/verify/bill?n=${encodeURIComponent(invoice.invoice_number)}&c=000000`);
  await expect(visitor.getByText("This bill could not be verified")).toBeVisible();
});
