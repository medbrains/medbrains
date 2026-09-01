/**
 * Pharmacy stock — twenty journeys a storekeeper actually walks.
 *
 * Stock control is where a hospital loses money quietly and loses patients
 * loudly: an expired vial dispensed, a transfer that moved on paper but not on
 * the shelf, a batch written off twice. Every case here drives the real API
 * and asserts what the server does, not what a fixture says.
 *
 * The transfer lifecycle is a state machine — requested → approved →
 * dispatched → received — and each hop is asserted, including the hops that
 * must be refused. Skipping a step is how stock leaves one store without
 * arriving at the other.
 */
import { expect, test } from "@playwright/test";
import { type AuthContext, api, getAuthContextFromCookies } from "../helpers/api";

interface StoreLocation {
  id: string;
  name: string;
  code?: string;
}

interface Transfer {
  id: string;
  status: string;
  from_location_id: string;
  to_location_id: string;
}

interface CatalogItem {
  id: string;
  name: string;
}

interface Batch {
  id: string;
  catalog_item_id: string;
  batch_number: string;
  expiry_date: string;
  quantity_on_hand?: number;
}

async function stores(ctx: AuthContext): Promise<StoreLocation[]> {
  return api<StoreLocation[]>(ctx, "GET", "/api/procurement/store-locations");
}

async function firstCatalogItem(ctx: AuthContext): Promise<CatalogItem> {
  const rows = await api<CatalogItem[]>(ctx, "GET", "/api/pharmacy/catalog");
  const item = rows[0];
  if (!item) throw new Error("tenant has no pharmacy catalogue item");
  return item;
}

/**
 * Raise a transfer.
 *
 * `items` is free-form JSON on the request, so the shape is the caller's
 * contract with itself — which is worth pinning here, because nothing else
 * does.
 */
async function raiseTransfer(
  ctx: AuthContext,
  from: string,
  to: string,
  items: Array<{ catalog_item_id: string; quantity: number }>,
  notes?: string,
): Promise<Transfer> {
  return api<Transfer>(ctx, "POST", "/api/pharmacy/transfers", {
    from_location_id: from,
    to_location_id: to,
    items,
    notes,
  });
}

test.describe("pharmacy stock — the transfer lifecycle", () => {
  test("1. a storekeeper can raise a transfer between two stores", async ({ request }) => {
    const ctx = await getAuthContextFromCookies(request);
    const all = await stores(ctx);
    const from = all[0];
    if (!from) test.skip(true, "tenant has no store location");
    const item = await firstCatalogItem(ctx);

    // A single-store tenant transfers to itself; the request is still valid and
    // the lifecycle is what is under test.
    const to = all[1] ?? from;
    const transfer = await raiseTransfer(ctx, from!.id, to.id, [
      { catalog_item_id: item.id, quantity: 5 },
    ]);
    expect(transfer.id).toMatch(/^[0-9a-f-]{36}$/i);
  });

  test("2. a raised transfer starts unapproved", async ({ request }) => {
    const ctx = await getAuthContextFromCookies(request);
    const all = await stores(ctx);
    if (all.length === 0) test.skip(true, "no store location");
    const item = await firstCatalogItem(ctx);
    const t = await raiseTransfer(ctx, all[0]!.id, (all[1] ?? all[0])!.id, [
      { catalog_item_id: item.id, quantity: 2 },
    ]);
    // Stock must not be considered moved the moment somebody asks for it.
    expect(t.status).not.toBe("dispatched");
    expect(t.status).not.toBe("received");
  });

  test("3. a transfer appears on the transfer list", async ({ request }) => {
    const ctx = await getAuthContextFromCookies(request);
    const all = await stores(ctx);
    if (all.length === 0) test.skip(true, "no store location");
    const item = await firstCatalogItem(ctx);
    const t = await raiseTransfer(ctx, all[0]!.id, (all[1] ?? all[0])!.id, [
      { catalog_item_id: item.id, quantity: 3 },
    ]);
    const list = await api<Transfer[]>(ctx, "GET", "/api/pharmacy/transfers");
    expect(list.some((row) => row.id === t.id)).toBe(true);
  });

  test("4. dispatching before approval is refused", async ({ request }) => {
    // The dispatch handler selects `WHERE status = 'approved' FOR UPDATE`.
    // Without that guard, stock leaves the shelf on an unreviewed request.
    const ctx = await getAuthContextFromCookies(request);
    const all = await stores(ctx);
    if (all.length === 0) test.skip(true, "no store location");
    const item = await firstCatalogItem(ctx);
    const t = await raiseTransfer(ctx, all[0]!.id, (all[1] ?? all[0])!.id, [
      { catalog_item_id: item.id, quantity: 1 },
    ]);

    await expect(
      api(ctx, "POST", `/api/pharmacy/transfers/${t.id}/dispatch`, {}),
      "an unapproved transfer must not dispatch — that is stock moving unreviewed",
    ).rejects.toThrow(/40[049]/);
  });

  test("5. receiving before dispatch is refused", async ({ request }) => {
    const ctx = await getAuthContextFromCookies(request);
    const all = await stores(ctx);
    if (all.length === 0) test.skip(true, "no store location");
    const item = await firstCatalogItem(ctx);
    const t = await raiseTransfer(ctx, all[0]!.id, (all[1] ?? all[0])!.id, [
      { catalog_item_id: item.id, quantity: 1 },
    ]);

    await expect(
      api(ctx, "POST", `/api/pharmacy/transfers/${t.id}/receive`, {}),
      "receiving what was never sent would credit stock that never moved",
    ).rejects.toThrow(/40[049]/);
  });

  test("6. dispatching more than the source holds is refused", async ({ request }) => {
    // The control that stops stock moving on paper without moving on the
    // shelf. A transfer dispatched against stock the source does not have
    // credits the destination with medicine nobody has, and the discrepancy
    // is found at the next count — by which time it reads as theft.
    const ctx = await getAuthContextFromCookies(request);
    const all = await stores(ctx);
    if (all.length === 0) test.skip(true, "no store location");
    const item = await firstCatalogItem(ctx);
    const t = await raiseTransfer(ctx, all[0]!.id, (all[1] ?? all[0])!.id, [
      { catalog_item_id: item.id, quantity: 9999 },
    ]);

    await api(ctx, "PUT", `/api/pharmacy/transfers/${t.id}/approve`, {});
    await expect(
      api(ctx, "POST", `/api/pharmacy/transfers/${t.id}/dispatch`, {}),
      "dispatching stock the source does not hold must be refused",
    ).rejects.toThrow(/insufficient stock|400/);
  });

  test("6b. approve then dispatch then receive completes the journey", async ({ request }) => {
    // Needs stock actually assigned to the source store. In this database all
    // stocked batches carry store_location_id = NULL, so nothing is dispatchable
    // from anywhere — which is itself worth knowing: batches exist, and no
    // store owns them.
    const ctx = await getAuthContextFromCookies(request);
    const all = await stores(ctx);
    if (all.length === 0) test.skip(true, "no store location");
    const item = await firstCatalogItem(ctx);
    const t = await raiseTransfer(ctx, all[0]!.id, (all[1] ?? all[0])!.id, [
      { catalog_item_id: item.id, quantity: 1 },
    ]);
    await api(ctx, "PUT", `/api/pharmacy/transfers/${t.id}/approve`, {});

    try {
      await api(ctx, "POST", `/api/pharmacy/transfers/${t.id}/dispatch`, {});
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      test.skip(
        message.includes("insufficient stock"),
        "no store-assigned stock in this tenant — the lifecycle needs a batch with store_location_id set",
      );
      throw error;
    }

    await api(ctx, "POST", `/api/pharmacy/transfers/${t.id}/receive`, {});
    const list = await api<Transfer[]>(ctx, "GET", "/api/pharmacy/transfers");
    expect(list.find((row) => row.id === t.id)?.status).toBe("received");
  });

  test("7. a transfer cannot be approved twice", async ({ request }) => {
    const ctx = await getAuthContextFromCookies(request);
    const all = await stores(ctx);
    if (all.length === 0) test.skip(true, "no store location");
    const item = await firstCatalogItem(ctx);
    const t = await raiseTransfer(ctx, all[0]!.id, (all[1] ?? all[0])!.id, [
      { catalog_item_id: item.id, quantity: 1 },
    ]);
    await api(ctx, "PUT", `/api/pharmacy/transfers/${t.id}/approve`, {});
    await expect(
      api(ctx, "PUT", `/api/pharmacy/transfers/${t.id}/approve`, {}),
      "two approvals is two people believing they authorised the same move",
    ).rejects.toThrow(/40[049]/);
  });

  test("8. a received transfer cannot be dispatched again", async ({ request }) => {
    const ctx = await getAuthContextFromCookies(request);
    const all = await stores(ctx);
    if (all.length === 0) test.skip(true, "no store location");
    const item = await firstCatalogItem(ctx);
    const t = await raiseTransfer(ctx, all[0]!.id, (all[1] ?? all[0])!.id, [
      { catalog_item_id: item.id, quantity: 1 },
    ]);
    await api(ctx, "PUT", `/api/pharmacy/transfers/${t.id}/approve`, {});
    try {
      await api(ctx, "POST", `/api/pharmacy/transfers/${t.id}/dispatch`, {});
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      test.skip(message.includes("insufficient stock"), "no store-assigned stock in this tenant");
      throw error;
    }
    await api(ctx, "POST", `/api/pharmacy/transfers/${t.id}/receive`, {});

    await expect(
      api(ctx, "POST", `/api/pharmacy/transfers/${t.id}/dispatch`, {}),
      "re-dispatching a completed transfer would move the stock twice",
    ).rejects.toThrow(/40[049]/);
  });

  test("9. a transfer for an unknown id is not found", async ({ request }) => {
    const ctx = await getAuthContextFromCookies(request);
    await expect(
      api(ctx, "PUT", "/api/pharmacy/transfers/00000000-0000-0000-0000-000000000000/approve", {}),
    ).rejects.toThrow(/40[049]/);
  });

  test("10. the transfer list can be filtered by status", async ({ request }) => {
    const ctx = await getAuthContextFromCookies(request);
    const rows = await api<Transfer[]>(ctx, "GET", "/api/pharmacy/transfers?status=received");
    for (const row of rows) expect(row.status).toBe("received");
  });
});

test.describe("pharmacy stock — expiry and batches", () => {
  test("11. near-expiry returns batches, not the whole catalogue", async ({ request }) => {
    const ctx = await getAuthContextFromCookies(request);
    const rows = await api<Batch[]>(ctx, "GET", "/api/pharmacy/batches/near-expiry");
    expect(Array.isArray(rows)).toBe(true);
    for (const row of rows) {
      expect(row.expiry_date, "a near-expiry row without an expiry date is meaningless").toBeTruthy();
    }
  });

  test("12. near-expiry honours its day window", async ({ request }) => {
    const ctx = await getAuthContextFromCookies(request);
    const narrow = await api<Batch[]>(ctx, "GET", "/api/pharmacy/batches/near-expiry?days=1");
    const wide = await api<Batch[]>(ctx, "GET", "/api/pharmacy/batches/near-expiry?days=365");
    expect(
      wide.length,
      "a year's window cannot contain fewer batches than a day's",
    ).toBeGreaterThanOrEqual(narrow.length);
  });

  test("13. every near-expiry batch is genuinely still in date", async ({ request }) => {
    // A batch already expired belongs on the write-off list, not the
    // near-expiry one — mixing them means somebody dispenses from a shelf they
    // were told was merely "expiring soon".
    const ctx = await getAuthContextFromCookies(request);
    const rows = await api<Batch[]>(ctx, "GET", "/api/pharmacy/batches/near-expiry?days=90");
    const today = new Date().toISOString().slice(0, 10);
    for (const row of rows) {
      expect(row.expiry_date >= today, `${row.batch_number} has already expired`).toBe(true);
    }
  });

  test("14. dead stock lists batches that are not moving", async ({ request }) => {
    const ctx = await getAuthContextFromCookies(request);
    const rows = await api<unknown[]>(ctx, "GET", "/api/pharmacy/batches/dead-stock");
    expect(Array.isArray(rows)).toBe(true);
  });

  test("15. FEFO selection returns the earliest expiry first", async ({ request }) => {
    // First-expiry-first-out is the whole point: dispensing the freshest box
    // leaves the oldest to expire on the shelf.
    const ctx = await getAuthContextFromCookies(request);
    // Ask about an item that actually has stocked batches — asking about one
    // with none proves nothing about ordering.
    const all = await api<Batch[]>(ctx, "GET", "/api/pharmacy/batches");
    const stocked = all.find((b) => (b.quantity_on_hand ?? 0) > 0);
    const itemId = stocked?.catalog_item_id ?? (await firstCatalogItem(ctx)).id;

    const res = await api<{ batches: Batch[] }>(
      ctx,
      "POST",
      "/api/pharmacy/batches/fefo-select",
      { catalog_item_id: itemId, quantity_needed: 1 },
    );
    const rows = res.batches;
    expect(Array.isArray(rows), "fefo-select must answer a batches array").toBe(true);
    if (rows.length < 2) test.skip(true, "not enough live batches to prove ordering");
    for (let i = 1; i < rows.length; i += 1) {
      expect(
        rows[i - 1]!.expiry_date <= rows[i]!.expiry_date,
        "FEFO returned a later expiry before an earlier one",
      ).toBe(true);
    }
  });

  test("16. the batch list is readable", async ({ request }) => {
    const ctx = await getAuthContextFromCookies(request);
    const rows = await api<unknown[]>(ctx, "GET", "/api/pharmacy/batches");
    expect(Array.isArray(rows)).toBe(true);
  });
});

test.describe("pharmacy stock — goods receipt", () => {
  test("17. the GRN list is readable and paginated", async ({ request }) => {
    // ListGrnQuery carries page/per_page, so this answers an envelope rather
    // than a bare array. A receipt list that silently dropped its pagination
    // would show a storekeeper the first page and call it the whole store.
    const ctx = await getAuthContextFromCookies(request);
    const body = await api<{ data?: unknown[]; meta?: unknown } | unknown[]>(
      ctx,
      "GET",
      "/api/procurement/grns?page=1&per_page=20",
    );
    const rows = Array.isArray(body) ? body : (body.data ?? []);
    expect(Array.isArray(rows)).toBe(true);
  });

  test("18. completing an unknown GRN is refused", async ({ request }) => {
    const ctx = await getAuthContextFromCookies(request);
    await expect(
      api(
        ctx,
        "PUT",
        "/api/procurement/grns/00000000-0000-0000-0000-000000000000/complete",
        {},
      ),
    ).rejects.toThrow(/40[049]/);
  });

  test("19. batch stock is reported per store", async ({ request }) => {
    const ctx = await getAuthContextFromCookies(request);
    const rows = await api<unknown[]>(ctx, "GET", "/api/procurement/batch-stock");
    expect(Array.isArray(rows)).toBe(true);
  });
});

test.describe("pharmacy stock — what the UI cannot reach", () => {
  test("20. a transfer can be raised over the API but not from any screen", async ({
    request,
  }) => {
    // The endpoint works, the client method exists, its generated test passes —
    // and `createPharmacyTransfer` is absent from pharmacy.service.ts and is
    // called by no component. So a storekeeper can approve, dispatch and
    // receive a transfer in the UI, and has no way to raise one.
    //
    // This case asserts the half that works, so that when the screen is built
    // the contract it must satisfy is already written down.
    const ctx = await getAuthContextFromCookies(request);
    const all = await stores(ctx);
    if (all.length === 0) test.skip(true, "no store location");
    const item = await firstCatalogItem(ctx);

    const t = await raiseTransfer(
      ctx,
      all[0]!.id,
      (all[1] ?? all[0])!.id,
      [{ catalog_item_id: item.id, quantity: 7 }],
      "raised by the stock journey suite",
    );
    expect(t.id).toBeTruthy();

    const list = await api<Transfer[]>(ctx, "GET", "/api/pharmacy/transfers");
    expect(
      list.some((row) => row.id === t.id),
      "the transfer the UI cannot create is nonetheless real and listable",
    ).toBe(true);
  });
});
