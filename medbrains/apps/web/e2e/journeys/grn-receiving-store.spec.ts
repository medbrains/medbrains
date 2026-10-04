/**
 * Goods received go into a store. A store keeper receives a purchase order
 * on screen and the stock lands in the store they chose; a receipt naming no
 * store is refused, because stock no store owns can be neither issued nor
 * moved.
 */
import { api, getAuthContextFromCookies, loginAsRoleApi } from "../helpers/api";
import {
  approvePurchaseOrder,
  createProcurementVendor,
  createPurchaseOrder,
  sendPurchaseOrderToVendor,
} from "../helpers/journey-steps";
import { expect, test } from "./support/world";

test("a store keeper receives a purchase order into a store", async ({ hospital, request }) => {
  test.setTimeout(120_000);
  const admin = await getAuthContextFromCookies(request);
  // Separation of duties: the officer raises the order, someone else approves.
  const officer = await loginAsRoleApi(request, "procurement_officer");
  const vendor = await createProcurementVendor(officer, {});
  const created = await createPurchaseOrder(officer, { vendorId: vendor.id, quantity: 4 });
  const po = { ...created.purchase_order, items: created.items };
  await approvePurchaseOrder(admin, po.id);
  await sendPurchaseOrderToVendor(officer, po.id);
  const stores = await api<{ id: string; name: string; is_active: boolean }[]>(
    admin,
    "GET",
    "/api/procurement/store-locations",
  );
  const store = stores.find((s) => s.is_active);
  if (!store) throw new Error("the seed has a store to receive into");

  // Refused without a store, whoever calls.
  await expect(
    api(admin, "POST", "/api/procurement/grns", {
      po_id: po.id,
      items: [
        {
          po_item_id: po.items[0]?.id,
          item_name: po.items[0]?.item_name,
          quantity_received: 1,
          quantity_accepted: 1,
          quantity_rejected: 0,
          unit_price: "1.00",
        },
      ],
    }),
  ).rejects.toThrow(/422/);

  const page = await hospital.as("store_keeper");
  await page.goto("/materials");
  await page.getByRole("tab", { name: "Procurement" }).click();
  await page.getByRole("tab", { name: "GRN" }).click();
  await page.getByRole("button", { name: "New GRN" }).click();
  const drawer = page.getByRole("dialog", { name: "Create GRN" });
  await drawer.getByRole("combobox", { name: "Purchase Order" }).click();
  await page.getByRole("option", { name: new RegExp(po.po_number) }).click();
  const storePicker = drawer.getByRole("combobox", { name: "Receive into store" });
  if (stores.filter((s) => s.is_active).length > 1) {
    await storePicker.click();
    await page.getByRole("option", { name: store.name, exact: true }).click();
  }
  await expect(storePicker).toHaveValue(store.name);
  await drawer.getByRole("button", { name: "Create GRN", exact: true }).click();
  await expect(drawer).toBeHidden();

  const grns = await api<{ grns: { po_id: string; store_location_id: string | null }[] }>(
    admin,
    "GET",
    "/api/procurement/grns?page=1&per_page=100",
  );
  const grn = grns.grns.find((g) => g.po_id === po.id);
  expect(grn?.store_location_id, "the receipt names its store").toBe(store.id);
});
