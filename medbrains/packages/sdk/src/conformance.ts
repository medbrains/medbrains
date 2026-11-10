import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { MedBrainsClient, MedBrainsError } from "./client.js";
import { type Manifest, READS, validateManifest } from "./manifest.js";
import { MockMedBrains } from "./mock.js";
import { DEFAULT_TOLERANCE_SECONDS, sign, verifySignature } from "./webhooks.js";

export interface CheckResult {
  name: string;
  ok: boolean;
  detail: string;
}

export interface ConformanceTarget {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  /** A patient the hospital shared with the app, to prove a real read. */
  patientId?: string;
}

async function check(name: string, run: () => Promise<string>): Promise<CheckResult> {
  try {
    return { name, ok: true, detail: await run() };
  } catch (e) {
    return { name, ok: false, detail: e instanceof Error ? e.message : String(e) };
  }
}

async function status(p: Promise<unknown>): Promise<number> {
  try {
    await p;
    return 200;
  } catch (e) {
    if (e instanceof MedBrainsError) return e.status;
    throw e;
  }
}

/**
 * The protocol v1 conformance suite (PROTOCOL.md §8), against a sandbox
 * hospital or the local mock. Every check is about behaviour the hospital
 * relies on: refusing bad credentials, least privilege, and real reads.
 */
export async function runConformance(
  manifest: Manifest,
  target: ConformanceTarget,
): Promise<CheckResult[]> {
  const client = new MedBrainsClient(target);
  const results: CheckResult[] = [];
  results.push(
    await check("manifest is valid", async () => {
      const errors = validateManifest(manifest);
      if (errors.length) throw new Error(errors.join("; "));
      return `${manifest.name} ${manifest.version}`;
    }),
  );
  results.push(
    await check("FHIR metadata is public", async () => {
      const res = await fetch(`${target.baseUrl}/api/fhir/metadata`);
      if (!res.ok) throw new Error(`answered ${res.status}`);
      return "CapabilityStatement served";
    }),
  );
  results.push(
    await check("an unsupported grant type is refused, never cached", async () => {
      const res = await fetch(`${target.baseUrl}/api/oauth/token`, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ grant_type: "password" }).toString(),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (res.status !== 400 || body.error !== "unsupported_grant_type")
        throw new Error(`expected 400 unsupported_grant_type, got ${res.status} ${body.error}`);
      if (res.headers.get("cache-control") !== "no-store")
        throw new Error("token endpoint answers must carry Cache-Control: no-store");
      return "400 unsupported_grant_type, no-store";
    }),
  );
  results.push(
    await check("a wrong secret is refused", async () => {
      const wrong = new MedBrainsClient({ ...target, clientSecret: "mbcs_wrong" });
      const code = await status(wrong.accessToken());
      if (code !== 401) throw new Error(`expected 401, got ${code}`);
      return "401 invalid_client";
    }),
  );
  results.push(
    await check("client credentials give a token", async () => {
      await client.accessToken();
      return "Bearer token issued";
    }),
  );
  results.push(
    await check("a call without a token is refused", async () => {
      const res = await fetch(
        `${target.baseUrl}/api/fhir/Patient/00000000-0000-0000-0000-000000000000`,
      );
      if (res.status !== 401) throw new Error(`expected 401, got ${res.status}`);
      return "401 without a Bearer token";
    }),
  );
  const ungranted = Object.entries(READS).find(([, perm]) => !manifest.permissions.includes(perm));
  if (ungranted) {
    results.push(
      await check(`least privilege: ${ungranted[0]} is refused`, async () => {
        const code = await status(
          client.readFhir(ungranted[0] as "Patient", "00000000-0000-0000-0000-000000000000"),
        );
        if (code !== 403) throw new Error(`expected 403 without ${ungranted[1]}, got ${code}`);
        return `403 without ${ungranted[1]}`;
      }),
    );
  }
  if (target.patientId && manifest.reads?.includes("Patient")) {
    results.push(
      await check("reads a shared Patient", async () => {
        const p = await client.readFhir("Patient", target.patientId ?? "");
        if (p.resourceType !== "Patient") throw new Error(`got ${p.resourceType}`);
        return `Patient/${p.id}`;
      }),
    );
  }
  return results;
}

/** PROTOCOL.md §5 test vector: any implementation that disagrees signs differently. */
const VECTOR = {
  secret: "secret",
  t: 1700000000,
  body: '{"a":1}',
  v1: "49f24e537407743fa4a0242bb63b94b9a47ee99cbbe071ccd8a22550ae411686",
};

/**
 * Webhook checks (PROTOCOL.md §5): the mock delivers a signed event to a local
 * receiver, which must verify it; a stale or tampered copy must be refused.
 * Only a mock can be told to deliver, so these run against the mock.
 */
async function webhookChecks(mock: MockMedBrains): Promise<CheckResult[]> {
  const received: { header: string; body: string }[] = [];
  const server = createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    received.push({ header: String(req.headers["x-medbrains-signature"] ?? ""), body });
    res.writeHead(204).end();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/hook`;
  try {
    const secret = mock.webhookSecret;
    const now = Math.floor(Date.now() / 1000);
    return [
      await check("webhook signature matches the protocol test vector", async () => {
        const got = sign(VECTOR.secret, VECTOR.t, VECTOR.body);
        if (got !== `t=${VECTOR.t},v1=${VECTOR.v1}`) throw new Error(`signed ${got}`);
        return 'HMAC-SHA256 over "<t>.<body>"';
      }),
      await check("a delivered webhook verifies", async () => {
        await mock.deliver(url, "patient.created", { patient_id: "p1" });
        const d = received.at(-1);
        if (!d) throw new Error("nothing was delivered");
        const r = verifySignature({ secret, header: d.header, body: d.body });
        if (!r.ok) throw new Error(r.reason);
        return "signed, fresh, verified";
      }),
      await check("a replayed webhook outside the window is refused", async () => {
        const stale = now - DEFAULT_TOLERANCE_SECONDS - 1;
        const r = verifySignature({ secret, header: sign(secret, stale, "{}"), body: "{}", now });
        if (r.ok) throw new Error("a stale delivery was accepted");
        return r.reason;
      }),
      await check("a tampered webhook body is refused", async () => {
        const d = received.at(-1);
        const r = verifySignature({ secret, header: d?.header, body: `${d?.body} ` });
        if (r.ok) throw new Error("a changed body was accepted");
        return r.reason;
      }),
    ];
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

/** The suite against the local mock, plus the revocation and webhook checks only a mock can drive. */
export async function runAgainstMock(manifest: Manifest): Promise<CheckResult[]> {
  const patientId = "11111111-1111-1111-1111-111111111111";
  const mock = new MockMedBrains({
    permissions: manifest.permissions,
    resources: { Patient: { [patientId]: { resourceType: "Patient", id: patientId } } },
  });
  const baseUrl = await mock.start();
  try {
    const target = { baseUrl, clientId: mock.clientId, clientSecret: mock.clientSecret, patientId };
    const results = await runConformance(manifest, target);
    results.push(...(await webhookChecks(mock)));
    results.push(
      await check("revocation cuts the app off on the next call", async () => {
        const client = new MedBrainsClient(target);
        await client.accessToken();
        mock.revoke();
        const code = await status(client.readFhir("Patient", patientId));
        if (code !== 400 && code !== 401) throw new Error(`expected refusal, got ${code}`);
        return `refused (${code})`;
      }),
    );
    return results;
  } finally {
    await mock.stop();
  }
}
