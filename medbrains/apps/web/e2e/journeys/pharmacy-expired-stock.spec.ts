/**
 * A pharmacist finds stock past its date apart from "expiring soon", and
 * writes it off under a witnessed certificate. Controlled drugs are never in
 * that write-off — they are destroyed through the NDPS register (proven in
 * pharmacy_expired_stock_test).
 */
import { api, getAuthContextFromCookies } from "../helpers/api";
import { expect, test } from "./support/world";

interface CatalogItem {
  id: string;
  is_controlled?: boolean;
}

test("a pharmacist writes off expired stock with a witness", async ({ hospital, request }) => {
  const admin = await getAuthContextFromCookies(request);
  const items = await api<CatalogItem[]>(admin, "GET", "/api/pharmacy/catalog");
  const item = items.find((i) => !i.is_controlled);
  if (!item) throw new Error("no ordinary drug in the catalogue");
  const batchNumber = `EXP-${Date.now()}`;
  await api(admin, "POST", "/api/pharmacy/batches", {
    catalog_item_id: item.id,
    batch_number: batchNumber,
    expiry_date: "2020-01-31",
    quantity_received: 4,
  });

  const page = await hospital.as("pharmacist");
  await page.goto("/pharmacy");
  await page.getByRole("tab", { name: "Batch & Expiry" }).click();
  await page.getByText("Near Expiry", { exact: true }).click();

  const panel = page.getByTestId("expired-stock-panel");
  await expect(panel.getByText(batchNumber)).toBeVisible();
  await expect(panel.getByText("do not dispense")).toBeVisible();

  await panel.getByTestId("write-off-expired").click();
  await page.getByTestId("write-off-witness").fill("Head Pharmacist");
  await page.getByTestId("write-off-confirm").click();
  await expect(page.getByText(/Written off — certificate DEST-/)).toBeVisible();
  await expect(page.getByText(batchNumber)).toHaveCount(0);
});
