# @medbrains/sdk

Build extensions for [MedBrains](https://github.com/medbrains/medbrains), the open hospital OS.
Protocol: [`docs/extensions/PROTOCOL.md`](../../docs/extensions/PROTOCOL.md). No runtime
dependencies; Node 20+.

## Quickstart

```sh
npx @medbrains/sdk ext init my-extension   # manifest + a sample service
cd my-extension
npx medbrains ext validate                 # the checks the hospital runs at registration
npx medbrains ext test                     # conformance suite against a local mock
```

Send `medbrains.manifest.json` to the hospital. An admin registers it in **Admin → Connected
apps**, reads its privacy label and approves it, and gives you the client ID, client secret and
webhook signing secret (shown once).

```ts
import { MedBrainsClient, verifySignature } from "@medbrains/sdk";

const client = new MedBrainsClient({
  baseUrl: "https://hospital.example",
  clientId: process.env.MEDBRAINS_CLIENT_ID!,
  clientSecret: process.env.MEDBRAINS_CLIENT_SECRET!,
});
const patient = await client.readFhir("Patient", patientId); // token fetched, cached, refreshed

// In your webhook handler — verify against the RAW body:
const check = verifySignature({ secret: process.env.MEDBRAINS_WEBHOOK_SECRET!, header: req.headers["x-medbrains-signature"], body: rawBody });
if (!check.ok) return res.status(401).end(check.reason);
```

Errors are `MedBrainsError` with `status` and `body`: `403` is a missing permission, `404` a
record you may not see, `503` the hospital could not decide (retry — never treat it as "no data").

## Testing with the mock

```ts
import { MockMedBrains, MedBrainsClient } from "@medbrains/sdk";

const mock = new MockMedBrains({ permissions: ["patients.view"], resources: { Patient: { "p1": { resourceType: "Patient", id: "p1" } } } });
const client = new MedBrainsClient({ baseUrl: await mock.start(), clientId: mock.clientId, clientSecret: mock.clientSecret });
await mock.deliver("http://127.0.0.1:8787/medbrains/webhook", "patient.created", { patient_id: "p1" }); // signed
mock.revoke(); // the next call is refused
await mock.stop();
```

## CLI

| Command | |
|---|---|
| `medbrains ext init [dir]` | new extension from the template |
| `medbrains ext validate [file]` | manifest check (all server rules except event names) |
| `medbrains ext test [--url URL]` | conformance suite; with `--url`, against a sandbox using `MEDBRAINS_CLIENT_ID`, `MEDBRAINS_CLIENT_SECRET`, `MEDBRAINS_PATIENT_ID` |
| `medbrains ext publish` | not yet — the public registry is phase E2; exits 2 and says so |

The CLI is TypeScript in this package rather than a Rust binary: extension developers already have
Node, `npx` needs no install, and it shares the validator and mock with the SDK instead of
reimplementing them.
