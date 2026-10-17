/**
 * Analyzer both ways (#227), with the real bridge in the middle: a sample is
 * collected, the bridge loads its order onto the analyzer as an HL7 ORM, the
 * analyzer's ASTM run comes back through the bridge, and the lab in-charge
 * sees both on the device's Messages screen.
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
import { collectLabSample, createEncounter, createPatientApi } from "../helpers/journey-steps";
import { expect, test } from "./support/world";

const BRIDGE = process.env.BRIDGE_BIN ?? "/tmp/mb-target-main/debug/medbrains-bridge";
const API_BASE = process.env.API_BASE ?? "http://127.0.0.1:3000";

/** An HL7 analyzer that accepts every order and remembers what it got. */
function fakeAnalyzer(): Promise<{ port: number; received: string[]; close: () => void }> {
  const received: string[] = [];
  const server = net.createServer((socket) => {
    let buf = Buffer.alloc(0);
    socket.on("data", (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      let end = buf.indexOf(Buffer.from([0x1c, 0x0d]));
      while (end >= 0) {
        const message = buf.subarray(1, end).toString();
        buf = buf.subarray(end + 2);
        received.push(message);
        const control = message.split("\r")[0].split("|")[9];
        socket.write(`\x0bMSH|^~\\&|XN|LAB\rMSA|AA|${control}\r\x1c\r`);
        end = buf.indexOf(Buffer.from([0x1c, 0x0d]));
      }
    });
  });
  return new Promise((resolve) =>
    server.listen(0, "127.0.0.1", () => {
      const port = (server.address() as net.AddressInfo).port;
      resolve({ port, received, close: () => server.close() });
    }),
  );
}

function freePort(): Promise<number> {
  const s = net.createServer();
  return new Promise((resolve) =>
    s.listen(0, "127.0.0.1", () => {
      const port = (s.address() as net.AddressInfo).port;
      s.close(() => resolve(port));
    }),
  );
}

/** One E1381 frame. */
function frame(n: number, text: string): Buffer {
  const body = Buffer.from(`${n}${text}\x03`);
  const sum = body.reduce((a, b) => (a + b) & 0xff, 0);
  return Buffer.concat([Buffer.from([0x02]), body, Buffer.from(`${sum.toString(16).toUpperCase().padStart(2, "0")}\r\n`)]);
}

/** The analyzer sends its run: ENQ, one frame, EOT, waiting for each ACK. */
async function sendAstmRun(port: number, text: string): Promise<void> {
  const socket = net.connect(port, "127.0.0.1");
  const acks: number[] = [];
  socket.on("data", (d) => acks.push(...d));
  const waitAcks = async (n: number) => {
    await expect.poll(() => acks.length, { timeout: 10_000 }).toBeGreaterThanOrEqual(n);
  };
  await new Promise<void>((r) => socket.once("connect", () => r()));
  socket.write(Buffer.from([0x05]));
  await waitAcks(1);
  socket.write(frame(1, text));
  await waitAcks(2);
  expect(acks).toEqual([0x06, 0x06]);
  socket.write(Buffer.from([0x04]));
  socket.end();
}

test("an order goes to the analyzer and its run comes back, both on the device screen", async ({ hospital }) => {
  test.skip(!existsSync(BRIDGE), `bridge binary not built at ${BRIDGE}`);
  test.setTimeout(120_000);
  const admin = hospital.admin;
  const tag = Date.now().toString(36).slice(-5).toUpperCase();
  const analyzer = await fakeAnalyzer();
  const astmPort = await freePort();
  let bridge: ChildProcess | undefined;
  try {
    const [labTest] = await api<Array<{ id: string; department_id: string | null }>>(admin, "GET", "/api/lab/catalog");
    const device = await api<{ id: string }>(admin, "POST", "/api/devices/instances", {
      adapter_code: "sysmex_xn550",
      name: `XN ${tag}`,
      code: `XN${tag}`,
      department_id: labTest.department_id ?? undefined,
      hostname: "127.0.0.1",
      port: analyzer.port,
    });
    const key = await api<{ id: string; secret: string }>(admin, "POST", "/api/admin/api-keys", {
      name: `Lab bridge ${tag}`,
      permissions: ["devices.ingest", "devices.orders.send"],
      expires_in_days: 1,
    });

    const patient = await createPatientApi(admin);
    const encounterId = await createEncounter(admin, patient.id);
    const order = await api<{ id: string }>(admin, "POST", "/api/lab/orders", {
      patient_id: patient.id,
      encounter_id: encounterId,
      test_id: labTest.id,
      priority: "routine",
    });
    const barcode = `SB${tag}`;
    await api(admin, "PUT", `/api/lab/orders/${order.id}/collect`, {
      patient_identifier: patient.uhid,
      sample_barcode: barcode,
    });

    const dir = mkdtempSync(path.join(os.tmpdir(), "bridge-"));
    const config = path.join(dir, "bridge.toml");
    writeFileSync(
      config,
      [
        `agent_name = "Lab bridge ${tag}"`,
        `agent_key = "mbr_bridge_${tag}"`,
        `api_base = "${API_BASE}"`,
        `api_key = "${key.secret}"`,
        `buffer_path = "${path.join(dir, "buffer.db")}"`,
        `device_instance_id = "${device.id}"`,
        `astm_listen = "127.0.0.1:${astmPort}"`,
        "order_poll_secs = 5",
      ].join("\n"),
    );
    bridge = spawn(BRIDGE, ["--config", config], { stdio: "ignore" });

    // The bridge loads the collected sample onto the analyzer.
    await expect
      .poll(() => analyzer.received.find((m) => m.includes(barcode)), { timeout: 30_000 })
      .toBeDefined();
    const orm = analyzer.received.find((m) => m.includes(barcode)) ?? "";
    expect(orm).toContain("ORM^O01");
    expect(orm).toContain(`PID|1||${patient.uhid}`);

    // The analyzer runs it and sends the results back over ASTM.
    await sendAstmRun(
      astmPort,
      `H|\\^&|||XN-550\rP|1||${patient.uhid}\rO|1||^^${barcode}^B\rR|1|^^^^WBC^1|12.4|10*3/uL||H\rR|2|^^^^HGB^1|13.1|g/dL|12.0-15.5|\rL|1|N\r`,
    );

    // Delivery from the bridge is asynchronous; wait for it before looking.
    await expect
      .poll(
        async () =>
          (await api<Array<{ direction: string }>>(admin, "GET", `/api/devices/instances/${device.id}/messages`)).some(
            (m) => m.direction === "inbound",
          ),
        { timeout: 20_000 },
      )
      .toBe(true);

    const page = await hospital.as("hospital_admin");
    await page.goto("/admin/devices");
    await page.getByRole("button", { name: `Messages for XN ${tag}` }).click();
    const drawer = page.getByRole("dialog", { name: `Messages — XN ${tag}` });
    const rows = drawer.getByRole("row").filter({ hasText: barcode });
    await expect(rows.filter({ hasText: "Sent to analyzer" })).toContainText("delivered");
    await expect(rows.filter({ hasText: "Received" })).toContainText("2 results");
    await expect(rows.filter({ hasText: "Received" })).toContainText("delivered");

    await api(admin, "POST", `/api/admin/api-keys/${key.id}/revoke`, { reason: "journey done" });
  } finally {
    bridge?.kill("SIGTERM");
    analyzer.close();
  }
});
