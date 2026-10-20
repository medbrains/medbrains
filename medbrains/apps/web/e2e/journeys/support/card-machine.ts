/**
 * Card machines at the counter (#4874), for the POS journeys.
 *
 * The server under test runs with `MEDBRAINS_POS_SIMULATOR=true`, so a
 * terminal can be a simulated machine. Its counter and machine are made
 * through the API (starting data); the cashier's steps are all on screen;
 * the patient at the machine is the test, through the simulator's API —
 * exactly what a person tapping the card would make the machine report.
 */
import type { Locator, Page } from "@playwright/test";
import { api, E2E_BACKEND_URL } from "../../helpers/api";
import type { AuthContext } from "../../helpers/types";
import { expect } from "./world";

export interface Machine {
  terminalId: string;
  label: string;
  stationName: string;
}

/** Why the card-machine journeys cannot run here, or `null` when they can. */
export async function simulatorUnavailable(admin: AuthContext): Promise<string | null> {
  const providers = await api<{ simulator_enabled: boolean }>(
    admin,
    "GET",
    "/api/payments/terminal-providers",
  );
  return providers.simulator_enabled
    ? null
    : "Start the server with MEDBRAINS_POS_SIMULATOR=true (never in production)";
}

/** A counter of the test's own, with a simulated card machine on it. */
export async function counterWithMachine(
  admin: AuthContext,
  stationType: "billing_counter" | "pharmacy_counter",
): Promise<Machine> {
  const tag = `${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`.toUpperCase();
  const stationName = `E2E counter ${tag}`;
  const station = await api<{ id: string }>(admin, "POST", "/api/stations", {
    code: `E2E-POS-${tag}`,
    name: stationName,
    station_type: stationType,
  });
  const label = `Card machine ${tag}`;
  const terminal = await api<{ id: string }>(admin, "POST", "/api/payments/terminals", {
    provider: "simulator",
    kind: "pos",
    connection: "cloud",
    label,
    station_id: station.id,
  });
  return { terminalId: terminal.id, label, stationName };
}

/** A replaced machine: retired so it no longer crowds the counter picker. */
export async function retire(admin: AuthContext, machine: Machine): Promise<void> {
  await api(admin, "POST", `/api/payments/terminals/${machine.terminalId}/retire`);
}

/** The simulated machine's cable, pulled or plugged back in. */
export async function power(admin: AuthContext, machine: Machine, on: boolean): Promise<void> {
  await api(admin, "POST", `/api/payments/simulator/terminals/${machine.terminalId}/power`, { on });
}

/** Wait for the sale the cashier sent to reach the machine; its id. */
export async function saleAtMachine(admin: AuthContext, machine: Machine): Promise<string> {
  let id = "";
  await expect
    .poll(
      async () => {
        const sales = await api<Array<{ transaction_id: string; terminal_id: string }>>(
          admin,
          "GET",
          "/api/payments/simulator/sales",
        );
        id = sales.find((s) => s.terminal_id === machine.terminalId)?.transaction_id ?? "";
        return id;
      },
      { message: "the sale reached the card machine", timeout: 15_000 },
    )
    .not.toBe("");
  return id;
}

/** The patient at the machine: what the card did. */
export async function cardDoes(
  admin: AuthContext,
  saleId: string,
  outcome: "approve" | "decline" | "timeout",
): Promise<void> {
  await api(admin, "POST", `/api/payments/simulator/sales/${saleId}`, { outcome });
}

/** The sale as the server holds it. */
export async function savedSale(admin: AuthContext, saleId: string) {
  return api<{ stage: string; reference: string | null; card_last4: string | null }>(
    admin,
    "GET",
    `/api/payments/pos-sale/${saleId}`,
  );
}

/** The cashier sends the amount to the machine at their counter. */
export async function sendToMachine(page: Page, scope: Locator, machine: Machine, amount: string) {
  const panel = scope.getByTestId("card-terminal-panel");
  await expect(panel).toBeVisible();
  const counter = panel.getByRole("combobox", { name: "Your counter" });
  if (await counter.count()) {
    await counter.click();
    await page.getByRole("option", { name: machine.stationName, exact: true }).click();
  }
  await expect(panel.getByTestId("terminal-status")).toBeVisible();
  const send = panel.getByRole("button", { name: `Send ${amount} to ${machine.label}` });
  await send.click();
  return panel;
}

/** A request as this browser's signed-in user, CSRF and all. */
export async function asUser(page: Page, path: string, data: unknown) {
  const cookies = await page.context().cookies();
  const csrf = cookies.find((c) => c.name === "csrf_token")?.value;
  expect(csrf, "the cashier is signed in").toBeTruthy();
  return page.request.post(`${E2E_BACKEND_URL}${path}`, {
    headers: { "x-csrf-token": csrf ?? "" },
    data,
  });
}
