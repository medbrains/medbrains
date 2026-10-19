/**
 * A visitor pass from desk to gate: front office registers the visitor and
 * issues a pass, prints it with its QR, and the security guard scans the
 * pass number at the gate — valid while it stands, "Not valid" once revoked.
 */
import { api } from "../helpers/api";
import { expect, test } from "./support/world";

test("a pass issued at the desk is checked at the gate until it is revoked", async ({
  hospital,
}) => {
  const suffix = crypto.randomUUID().slice(0, 6).toUpperCase();
  const visitor = `Visitor ${suffix}`;

  const { page: desk } = await hospital.newStaff("front_office_staff", `Desk ${suffix}`);
  await desk.goto("/front-office#visitors");
  await desk.getByRole("button", { name: "Register Visitor" }).click();
  await desk.getByLabel("Visitor Name").fill(visitor);
  await desk.getByLabel("Phone").fill("9000000003");
  await desk.getByLabel("Relationship").fill("Daughter");
  await desk.getByRole("button", { name: "Register", exact: true }).click();
  const row = desk.getByRole("row", { name: new RegExp(visitor) });
  await row.getByRole("button", { name: "Issue Pass" }).click();
  await desk.getByRole("button", { name: "Issue Pass", exact: true }).last().click();

  // This visitor's own pass: the list also holds every earlier run's.
  const passNumberOf = async () => {
    const visitors = await api<Array<{ id: string; visitor_name: string }>>(
      hospital.admin,
      "GET",
      "/api/front-office/visitors",
    );
    const mine = visitors.find((v) => v.visitor_name === visitor);
    if (!mine) return "";
    const passes = await api<Array<{ pass_number: string }>>(
      hospital.admin,
      "GET",
      `/api/front-office/passes?registration_id=${mine.id}`,
    );
    return passes[0]?.pass_number ?? "";
  };
  await expect.poll(passNumberOf).toMatch(/^VP-/);
  const passNumber = await passNumberOf();
  const passRow = desk.getByRole("row", { name: new RegExp(passNumber) });
  await expect(passRow).toBeVisible();

  await passRow.getByRole("button", { name: "Print pass" }).click();
  const dialog = desk.getByRole("dialog", { name: "Print pass" });
  await expect(dialog.getByAltText(`QR code for pass ${passNumber}`)).toBeVisible();
  await expect(dialog.getByText(visitor)).toBeVisible();
  await desk.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  const { page: gate } = await hospital.newStaff("security_guard", `Guard ${suffix}`);
  await gate.goto("/front-office#gate");
  const check = async () => {
    await gate.getByTestId("gate-pass-code").fill(passNumber);
    await gate.getByRole("button", { name: "Check pass" }).click();
  };
  await check();
  await expect(gate.getByTestId("gate-result")).toContainText("Valid — let in");
  await expect(gate.getByTestId("gate-result")).toContainText(visitor);

  await passRow.getByRole("button", { name: "Revoke" }).click();
  await check();
  await expect(gate.getByTestId("gate-result")).toContainText("Not valid");
  await expect(gate.getByTestId("gate-result")).toContainText("revoked");
});
