/**
 * A wristband prints on the ward's Zebra (#221), with the real bridge in the
 * middle: the administrator sets the printer up on the Printers screen, the
 * nurse presses Wristband → Send to print queue on the admission, the bridge
 * delivers it as ZPL to the printer, and the print queue shows it completed.
 *
 * Needs the bridge binary (BRIDGE_BIN, default the dev build); skipped
 * without it rather than failing on a missing build.
 */
import { type ChildProcess, spawn } from "node:child_process";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { api } from "../helpers/api";
import { admitToIpd, createPatientApi } from "../helpers/journey-steps";
import { expect, test } from "./support/world";

const BRIDGE = process.env.BRIDGE_BIN ?? "/tmp/mb-target-main/debug/medbrains-bridge";
const API_BASE = process.env.API_BASE ?? "http://127.0.0.1:3000";

/** A raw-printing (port 9100) printer that keeps what it is sent. */
function fakeZebra(): Promise<{ port: number; received: () => string; close: () => void }> {
  let data = "";
  const server = net.createServer((socket) => {
    socket.on("data", (chunk) => {
      data += chunk.toString();
    });
  });
  return new Promise((resolve) =>
    server.listen(0, "127.0.0.1", () =>
      resolve({
        port: (server.address() as net.AddressInfo).port,
        received: () => data,
        close: () => server.close(),
      }),
    ),
  );
}

test("a wristband prints on the ward Zebra through the bridge", async ({ hospital }) => {
  test.skip(!existsSync(BRIDGE), `bridge binary not built at ${BRIDGE}`);
  test.setTimeout(150_000);
  const admin = hospital.admin;
  const tag = Date.now().toString(36).slice(-5).toUpperCase();
  const zebra = await fakeZebra();
  let bridge: ChildProcess | undefined;
  try {
    // The administrator adds the ward's wristband printer.
    const adminPage = await hospital.as("hospital_admin");
    await adminPage.goto("/admin/documents");
    await adminPage.getByRole("tab", { name: "Printers" }).click();
    await adminPage.getByRole("button", { name: "Add Printer" }).click();
    const drawer = adminPage.getByRole("dialog", { name: "Add Printer Profile" });
    await drawer.getByRole("textbox", { name: "Printer name" }).fill(`Ward Zebra ${tag}`);
    await drawer.getByRole("combobox", { name: "Printer type" }).click();
    await adminPage.getByRole("option", { name: "Wristband" }).click();
    await drawer.getByRole("textbox", { name: "Connection string" }).fill(`127.0.0.1:${zebra.port}`);
    await drawer.getByRole("button", { name: "Create" }).click();
    await expect(adminPage.getByRole("row").filter({ hasText: `Ward Zebra ${tag}` })).toBeVisible();

    const printers = await api<Array<{ id: string; name: string }>>(admin, "GET", "/api/documents/printers");
    const printerId = printers.find((p) => p.name === `Ward Zebra ${tag}`)?.id ?? "";
    const key = await api<{ id: string; secret: string }>(admin, "POST", "/api/admin/api-keys", {
      name: `Print bridge ${tag}`,
      permissions: ["documents.print_jobs.deliver"],
      expires_in_days: 1,
    });
    const dir = mkdtempSync(path.join(os.tmpdir(), "bridge-"));
    const config = path.join(dir, "bridge.toml");
    writeFileSync(
      config,
      [
        `agent_name = "Print bridge ${tag}"`,
        `agent_key = "mbr_print_${tag}"`,
        `api_base = "${API_BASE}"`,
        `api_key = "${key.secret}"`,
        `buffer_path = "${path.join(dir, "buffer.db")}"`,
        "print_poll_secs = 2",
        `printer_ids = ["${printerId}"]`,
      ].join("\n"),
    );
    bridge = spawn(BRIDGE, ["--config", config], { stdio: "ignore" });

    // The nurse prints the admitted patient's wristband from the admission.
    const patient = await createPatientApi(admin);
    const admissionId = await admitToIpd(admin, { patientId: patient.id });
    const page = await hospital.as("nurse");
    await page.goto(`/ipd/admissions/${admissionId}`);
    await page.getByRole("button", { name: "Wristband", exact: true }).click();
    await page.getByRole("menuitem", { name: "Send to print queue" }).click();
    await expect(page.getByText(`Queued on Ward Zebra ${tag}.`)).toBeVisible({ timeout: 20_000 });

    // The bridge delivers it to the printer as ZPL with the patient's identifiers.
    await expect.poll(() => zebra.received(), { timeout: 30_000 }).toContain(`UHID ${patient.uhid}`);
    expect(zebra.received()).toMatch(/^\^XA/);

    const queuePage = await hospital.as("hospital_admin");
    await queuePage.goto("/admin/documents");
    await queuePage.getByRole("tab", { name: "Print Queue" }).click();
    const job = queuePage.getByRole("row").filter({ hasText: `Ward Zebra ${tag}` }).first();
    await expect(job).toContainText("completed", { timeout: 20_000 });
    await expect(job).toContainText("Patient Wristband");

    bridge.kill("SIGTERM");
    await api(admin, "POST", `/api/admin/api-keys/${key.id}/revoke`, { reason: "journey done" });

    // The ward replaces the printer: retired, it takes no more jobs.
    await adminPage.getByRole("tab", { name: "Printers" }).click();
    await adminPage.getByRole("button", { name: `Retire Ward Zebra ${tag}` }).click();
    await expect(adminPage.getByRole("row").filter({ hasText: `Ward Zebra ${tag}` })).toContainText(
      "Inactive",
    );
  } finally {
    bridge?.kill("SIGTERM");
    zebra.close();
  }
});
