/**
 * Token queue P0 — the desk's-eye view of the live defects fixed before the
 * queues become configurable (RFCs/modules/RFC-MODULE-token-queues.md §8).
 *
 * Each journey is something a front desk actually does: two receptionists
 * pressing Call next at once, a console left open while a colleague finishes
 * the patient, an admin turning on the token SMS. The server behaviour is
 * pinned by crates/medbrains-server/tests/token_queue_p0_test.rs; these pin
 * what the person at the screen sees.
 */
import { expect, type Page, test } from "@playwright/test";
import { routeApiDirect } from "../helpers";
import { type AuthContext, api, getAuthContextFromCookies } from "../helpers/api";

interface BoardToken {
  id: string;
  number: string;
  status: string;
}

/** A department of this test's own, so no other run shares its queue. */
async function ownDepartment(ctx: AuthContext): Promise<{ id: string; name: string }> {
  const suffix = crypto.randomUUID().slice(0, 8).toUpperCase();
  const name = `Queue P0 ${suffix}`;
  const dept = await api<{ id: string }>(ctx, "POST", "/api/setup/departments", {
    code: `QP${suffix}`,
    name,
    department_type: "clinical",
  });
  return { id: dept.id, name };
}

async function issue(ctx: AuthContext, departmentId: string): Promise<BoardToken> {
  return api<BoardToken>(ctx, "POST", "/api/tokens/issue", {
    module: "opd",
    scope: "department",
    scope_id: departmentId,
  });
}

async function board(ctx: AuthContext, departmentId: string): Promise<BoardToken[]> {
  return api<BoardToken[]>(
    ctx,
    "GET",
    `/api/tokens/board?module=opd&scope=department&scope_id=${departmentId}&include_finished=true`,
  );
}

/** Open the console on one department's OPD queue, the way a desk would. */
async function openConsole(page: Page, departmentName: string): Promise<void> {
  await routeApiDirect(page);
  await page.goto("/token-console");
  const department = page.getByPlaceholder("All departments");
  await department.click();
  await department.fill(departmentName);
  await page.getByRole("option", { name: departmentName }).click();
}

test.describe("token queue P0 — what the desk sees", () => {
  test("two desks pressing Call next together call two different patients", async ({
    browser,
    request,
  }) => {
    const ctx = await getAuthContextFromCookies(request);
    const dept = await ownDepartment(ctx);
    const first = await issue(ctx, dept.id);
    const second = await issue(ctx, dept.id);

    const storageState = "e2e/.auth/user.json";
    const deskA = await (await browser.newContext({ storageState })).newPage();
    const deskB = await (await browser.newContext({ storageState })).newPage();
    await Promise.all([openConsole(deskA, dept.name), openConsole(deskB, dept.name)]);
    await expect(deskA.getByRole("cell", { name: first.number })).toBeVisible();
    await expect(deskB.getByRole("cell", { name: second.number })).toBeVisible();

    await Promise.all([
      deskA.getByRole("button", { name: "Call next" }).click(),
      deskB.getByRole("button", { name: "Call next" }).click(),
    ]);

    // Neither desk is told the queue refused them: the one that lost the race
    // quietly took the next patient.
    await expect(deskA.getByText("The queue did not accept that")).toHaveCount(0);
    await expect(deskB.getByText("The queue did not accept that")).toHaveCount(0);
    await expect
      .poll(async () => (await board(ctx, dept.id)).filter((t) => t.status === "called").length)
      .toBe(2);
    await expect(deskA.getByText("Called", { exact: true })).toHaveCount(2);
  });

  test("a console left open cannot call a patient a colleague has finished", async ({
    page,
    request,
  }) => {
    const ctx = await getAuthContextFromCookies(request);
    const dept = await ownDepartment(ctx);
    const token = await issue(ctx, dept.id);

    await openConsole(page, dept.name);
    const row = page.getByRole("row", { name: new RegExp(token.number) });
    await expect(row.getByRole("button", { name: "Call" })).toBeVisible();

    // Freeze this screen at "waiting", as a console that has not refreshed is.
    const stale = await board(ctx, dept.id);
    await page.route(/\/api\/tokens\/board\?/, (route) => route.fulfill({ json: stale }));

    // Meanwhile a colleague sees the patient through.
    for (const step of ["call", "serve", "complete"]) {
      await api(ctx, "POST", `/api/tokens/${token.id}/${step}`, {});
    }

    await row.getByRole("button", { name: "Call" }).click();
    await expect(page.getByText("The queue did not accept that")).toBeVisible();
    await expect(page.getByText("Token is already completed; it cannot be set to called")).toBeVisible();
    const after = (await board(ctx, dept.id)).find((t) => t.id === token.id);
    expect(after?.status).toBe("completed");
  });

  test("an admin can turn the token SMS on and it stays on", async ({ page, request }) => {
    const ctx = await getAuthContextFromCookies(request);
    const before = await api<Array<{ key: string; value: unknown }>>(
      ctx,
      "GET",
      "/api/setup/settings?category=notifications",
    );
    const wasOn = before.find((row) => row.key === "token_call_sms")?.value === true;

    await routeApiDirect(page);
    await page.goto("/admin/settings#tokens");
    const sms = page.getByRole("switch", { name: "Text the patient when their token is called" });
    await expect(sms).toBeVisible();
    await expect(sms).toBeChecked({ checked: wasOn });

    // Scroll to the end, as an admin does: the switch is the last row, and the
    // assistant launcher floats over the bottom corner. The click fails if the
    // launcher still covers it — the page must leave room below.
    await page.mouse.wheel(0, 5000);
    // The visible track is what a person clicks; the input under it is hidden.
    await page.locator("label", { has: sms }).click();
    await expect(sms).toBeChecked({ checked: !wasOn });
    await page.reload();
    await expect(
      page.getByRole("switch", { name: "Text the patient when their token is called" }),
    ).toBeChecked({ checked: !wasOn });

    // Leave the hospital as it was found.
    await api(ctx, "PUT", "/api/setup/settings", {
      category: "notifications",
      key: "token_call_sms",
      value: wasOn,
    });
  });
});
