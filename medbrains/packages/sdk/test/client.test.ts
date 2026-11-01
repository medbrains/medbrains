import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { MedBrainsClient, MedBrainsError } from "../src/client.js";
import { runAgainstMock } from "../src/conformance.js";
import type { Manifest } from "../src/manifest.js";
import { MockMedBrains } from "../src/mock.js";
import { verifySignature } from "../src/webhooks.js";

const PATIENT = "11111111-1111-1111-1111-111111111111";
let mock: MockMedBrains;
afterEach(() => mock?.stop());

async function start(opts: ConstructorParameters<typeof MockMedBrains>[0] = {}) {
  mock = new MockMedBrains({ resources: { Patient: { [PATIENT]: { resourceType: "Patient", id: PATIENT } } }, ...opts });
  const baseUrl = await mock.start();
  return new MedBrainsClient({ baseUrl, clientId: mock.clientId, clientSecret: mock.clientSecret });
}

describe("MedBrainsClient", () => {
  it("signs in once and reuses the token", async () => {
    const client = await start();
    await Promise.all([client.readFhir("Patient", PATIENT), client.readFhir("Patient", PATIENT)]);
    expect(mock.calls.filter((c) => c.path === "/api/oauth/token")).toHaveLength(1);
  });

  it("refreshes a token about to expire", async () => {
    const client = await start({ tokenSeconds: 30 }); // inside the 60 s refresh skew
    await client.readFhir("Patient", PATIENT);
    await client.readFhir("Patient", PATIENT);
    expect(mock.calls.filter((c) => c.path === "/api/oauth/token")).toHaveLength(2);
  });

  it("surfaces least privilege as a 403 error, not an empty answer", async () => {
    const client = await start({ permissions: ["patients.view"] });
    await expect(client.readFhir("Observation", PATIENT)).rejects.toMatchObject({ status: 403 });
  });

  it("is refused after revocation, without looping", async () => {
    const client = await start();
    await client.readFhir("Patient", PATIENT);
    mock.revoke();
    const error = await client.readFhir("Patient", PATIENT).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(MedBrainsError);
    expect((error as MedBrainsError).body).toMatchObject({ error: "unauthorized_client" });
    expect(mock.calls.filter((c) => c.path === "/api/oauth/token")).toHaveLength(2);
  });
});

describe("mock webhook delivery", () => {
  it("delivers an event the SDK verifies", async () => {
    await start();
    let verified = false;
    const receiver = createServer(async (req, res) => {
      let body = "";
      for await (const chunk of req) body += chunk;
      verified = verifySignature({ secret: mock.webhookSecret, header: req.headers["x-medbrains-signature"] as string, body }).ok;
      res.writeHead(verified ? 200 : 401).end();
    });
    await new Promise<void>((r) => receiver.listen(0, "127.0.0.1", r));
    const port = (receiver.address() as AddressInfo).port;
    expect(await mock.deliver(`http://127.0.0.1:${port}/hook`, "patient.created", { patient_id: PATIENT })).toBe(200);
    expect(verified).toBe(true);
    receiver.close();
  });
});

describe("conformance suite", () => {
  it("passes for a well-behaved app against the mock", async () => {
    const manifest = {
      manifestVersion: 1, kind: "service", name: "t", purpose: "Test.", publisher: { name: "x" },
      version: "1.0.0", permissions: ["patients.view"], reads: ["Patient"], dataClasses: ["routine"],
      sendsDataTo: [{ name: "x", url: "https://x.example", purpose: "y" }],
    } satisfies Manifest;
    const results = await runAgainstMock(manifest);
    expect(results.filter((r) => !r.ok)).toEqual([]);
    expect(results.map((r) => r.name)).toContain("revocation cuts the app off on the next call");
  });
});
