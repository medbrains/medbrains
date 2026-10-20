/**
 * The customer display (#4883): a tablet at the billing counter, paired to
 * that counter, shows the patient what they are paying while the cashier
 * works the Collect drawer — the department lines, the UPI QR, then
 * "Paid ✓" with a chime and a spoken thank-you. Two browsers in one test:
 * the cashier's, and the tablet's, which never signs anybody in.
 *
 * Server pins: crates/medbrains-server/tests/counter_display_test.rs.
 * DB asserts read `E2E_DATABASE_URL` (the server's own database).
 */
import type { Page } from "@playwright/test";
import { routeApiDirect } from "../helpers";
import { api } from "../helpers/api";
import { createPatientApi } from "../helpers/journey-steps";
import { DevicesAdmin } from "./pages/devices-admin";
import { expectScreenAccessible } from "./support/a11y";
import { billOf, collectDrawer, db, grantView, savedInvoice, shotPath } from "./support/collect";
import { expect, test } from "./support/world";

/** Speech and sound, recorded instead of played: the test hears what the patient would. */
async function recordAudio(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const heard: string[] = [];
    (window as unknown as { __heard: string[] }).__heard = heard;
    HTMLMediaElement.prototype.play = function play() {
      heard.push("chime");
      setTimeout(() => this.dispatchEvent(new Event("ended")), 10);
      return Promise.resolve();
    };
    Object.defineProperty(window, "speechSynthesis", {
      value: {
        speak: (u: SpeechSynthesisUtterance) => heard.push(`speak:${u.text}`),
        cancel: () => undefined,
        getVoices: () => [],
      },
    });
  });
}

const heard = (page: Page) => page.evaluate(() => (window as unknown as { __heard: string[] }).__heard);

test("the counter's display mirrors the drawer: lines, QR, then Paid with the announcement", async ({
  hospital,
  browser,
}) => {
  test.setTimeout(180_000);
  await hospital.setting("payments", "upi_vpa", "hospital@okaxis");
  const tag = crypto.randomUUID().slice(0, 6).toUpperCase();
  const counter = await api<{ id: string; name: string }>(hospital.admin, "POST", "/api/stations", {
    code: `CD-${tag}`,
    name: `Billing counter ${tag}`,
    station_type: "billing_counter",
  });

  // The tablet: nobody signed in, sound recorded.
  const tablet = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const display = await tablet.newPage();
  await routeApiDirect(display);
  await recordAudio(display);
  await display.goto("/screen");
  const shown = display.getByTestId("screen-pairing-code");
  await expect(shown).toBeVisible({ timeout: 20_000 });
  const admin = new DevicesAdmin(await hospital.asAdmin());
  await admin.open();
  await admin.approveCounterDisplay((await shown.innerText()).trim(), counter.name);

  await expect(display.getByTestId("cd-idle")).toContainText(counter.name, { timeout: 20_000 });
  // Someone taps the tablet once when it is set up: browsers need that for sound.
  await display.mouse.click(10, 10);
  await expectScreenAccessible(display, "customer display idle");
  await display.screenshot({ path: shotPath("customer-display-idle") });
  const [device] = db(
    `SELECT app_variant, board_module, station_id FROM paired_devices
      WHERE station_id = '${counter.id}' AND revoked_at IS NULL`,
  );
  expect(device, "paired as a display of this counter").toBe(`tv|counter_display|${counter.id}`);

  // The cashier, at that counter.
  const patient = await createPatientApi(hospital.admin, { firstName: "Ravi", lastName: "Sharma" });
  const bill = await billOf(hospital.admin, patient.id, "pharmacy", 600);
  const cashier = await hospital.newStaff("billing_clerk", "Counter Cashier");
  grantView(cashier.id, patient.id);
  const page = cashier.page;
  await page.addInitScript((id) => localStorage.setItem("payments.counter-station", id), counter.id);
  await page.goto("/billing/counter");
  await page.getByLabel("Patient").first().fill(patient.uhid);
  await page.getByRole("option", { name: new RegExp(patient.uhid) }).first().click();
  await page.getByRole("button", { name: "Collect ₹600.00" }).click();
  const drawer = collectDrawer(page);
  await expect(drawer.getByTestId("customer-display-status")).toHaveText(
    "Customer display: connected",
  );
  await expect(drawer.getByRole("switch", { name: "Show QR on display" })).toBeChecked();

  // 1. The lines and the total, with the first name and an initial only.
  const session = display.getByTestId("cd-session");
  await expect(session).toContainText("Hello, Ravi S.", { timeout: 10_000 });
  await expect(session).toContainText("Pharmacy");
  await expect(display.getByTestId("cd-total")).toHaveText("₹600.00");
  await expect(display.getByText(patient.uhid)).toHaveCount(0);
  await expect(display.getByText(/Sharma/)).toHaveCount(0);
  await expectScreenAccessible(display, "customer display session");
  await display.screenshot({ path: shotPath("customer-display-session") });

  // 2. Card: the prompt to use the machine.
  await drawer.getByRole("radio", { name: /Card/ }).click();
  await expect(display.getByTestId("cd-card")).toContainText("Insert or tap your card");
  await display.screenshot({ path: shotPath("customer-display-card") });

  // 3. UPI: the QR, large, with the amount.
  await drawer.getByRole("radio", { name: /UPI/ }).click();
  await drawer.getByRole("button", { name: "Show QR for ₹600.00" }).click();
  const qr = display.getByTestId("cd-qr");
  await expect(qr).toContainText("₹600.00", { timeout: 10_000 });
  await expect(qr.getByTitle("UPI QR code")).toBeVisible();
  await expectScreenAccessible(display, "customer display QR");
  await display.screenshot({ path: shotPath("customer-display-qr") });

  // 4. Paid: on the screen, and said out loud — the chime first, then the voice.
  await drawer.getByRole("textbox", { name: /UTR/ }).fill("UTR4883");
  await drawer.getByRole("button", { name: "Collect ₹600.00" }).click();
  await expect(drawer.getByText("₹600.00 received")).toBeVisible();
  const paid = display.getByTestId("cd-paid");
  await expect(paid).toContainText("Paid ✓ ₹600.00");
  await expect(paid).toContainText("Thank you");
  await expectScreenAccessible(display, "customer display paid");
  await display.screenshot({ path: shotPath("customer-display-paid") });
  await expect
    .poll(() => heard(display))
    .toEqual(["chime", "speak:Payment of rupees 600 received, thank you."]);
  expect(savedInvoice(bill)).toEqual({ status: "paid", paid: 600 });

  // 5. It clears itself: the next patient never sees this one's payment.
  await expect(display.getByTestId("cd-idle")).toBeVisible({ timeout: 15_000 });
  await page.keyboard.press("Escape");
  await expect(heard(display)).resolves.toHaveLength(2);

  // 6. The hospital unreachable: it says so, never a stale "Paid".
  await tablet.setOffline(true);
  await expect(display.getByTestId("cd-reconnecting")).toBeVisible({ timeout: 60_000 });
  await display.screenshot({ path: shotPath("customer-display-reconnecting") });
  await tablet.setOffline(false);
  await expect(display.getByTestId("cd-idle")).toBeVisible({ timeout: 60_000 });
  await tablet.close();
});
