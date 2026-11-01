import { MedBrainsClient, MedBrainsError } from "./client.js";
import { type Manifest, READS, validateManifest } from "./manifest.js";
import { MockMedBrains } from "./mock.js";

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

/** The suite against the local mock, plus the revocation check only a mock can drive. */
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
