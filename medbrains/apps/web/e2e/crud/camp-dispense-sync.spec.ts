import { expect, test } from "@playwright/test";
import { api, getAuthContextFromCookies } from "../helpers/api";
import { createPatientApi } from "../helpers/journey-steps";

/**
 * Camp offline pharmacy dispense — the safety checks around a batched read.
 *
 * A camp syncs a day of offline dispensing in one call, and the handler used to
 * read pharmacy_catalog once per item to check schedule, controlled status and
 * stock. That read is now a single `id = ANY($2)` before the loop, with the map
 * kept in step as stock is decremented. These pin the semantics that refactor
 * had to preserve: stock is never oversold, and a rejected dispense leaves the
 * shelf exactly as it found it.
 */
interface StockRow {
  id: string;
  name: string;
  current_stock: number;
}

test.describe("camp pharmacy dispense sync", () => {
  test("an over-dispense is refused and leaves stock untouched", async ({ request }) => {
    const ctx = await getAuthContextFromCookies(request);

    const camps = await api<Array<{ id: string }>>(ctx, "GET", "/api/camp/camps");
    test.skip(camps.length === 0, "no camp seeded in this environment");

    const stock = await api<StockRow[]>(ctx, "GET", "/api/pharmacy/stock");
    const item = stock.find((row) => row.current_stock > 0);
    test.skip(!item, "no catalogue item holds stock in this environment");
    if (!item) return;

    const patient = await createPatientApi(ctx);
    const before = item.current_stock;

    // The same drug twice, each for the full shelf: together they exceed it.
    // Batching the catalogue read must not let the second line through on a
    // stock figure read before the first line was deducted.
    let applied: string[] = [];
    try {
      const body = await api<{ events?: Array<{ status: string }> }>(
        ctx,
        "POST",
        "/api/camp/sync/inbound",
        {
          camp_id: camps[0].id,
          device_id: `e2e-${Date.now()}`,
          events: [
            {
              idempotency_key: `e2e-overdispense-${Date.now()}`,
              event_type: "camp.pharmacy.dispense",
              payload: {
                patient_id: patient.id,
                notes: "e2e over-dispense guard",
                items: [
                  { catalog_item_id: item.id, drug_name: item.name, quantity: before, unit_price: "1.00" },
                  { catalog_item_id: item.id, drug_name: item.name, quantity: before, unit_price: "1.00" },
                ],
              },
            },
          ],
        },
      );
      applied = (body.events ?? []).filter((e) => e.status === "applied").map((e) => e.status);
    } catch {
      // A rejected batch may answer 4xx outright — equally a refusal.
      applied = [];
    }

    // However the refusal is reported, the shelf is what matters.
    expect(applied).toHaveLength(0);

    const after = await api<StockRow[]>(ctx, "GET", "/api/pharmacy/stock");
    const same = after.find((row) => row.id === item.id);
    expect(same?.current_stock).toBe(before);
  });
});
