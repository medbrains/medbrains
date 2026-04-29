# @medbrains/crdt

Web-side offline-first store for MedBrains pages. Apache-2.0.

Wraps [loro-crdt](https://github.com/loro-dev/loro) with:
- IndexedDB persistence (so reloading a tab doesn't lose offline writes)
- WebSocket sync to the medbrains-edge LAN hub
- React hook `useCrdtDoc` for clean component consumption
- Outbox queue for writes that happen while the edge is unreachable

## Tier policy

Use this package ONLY for T2 / T3 tables (per
`crates/medbrains-edge/README.md`). Examples: vital_signs,
patient_notes, nursing_handoff. Do NOT use for billing, prescription
orders, or other T1 server-authoritative writes — those need to stay
on the existing `@medbrains/api` REST flow with optimistic UI off
during outages.

## Usage

```tsx
import { useCrdtDoc } from "@medbrains/crdt";

function VitalsCard({ encounterId }: { encounterId: string }) {
  const { doc, ready, status, unsyncedOps } = useCrdtDoc(
    `vitals/${encounterId}`,
    {
      edgeUrl: "ws://medbrains-edge.local:7811",
      tenantId: useTenant().id,
      deviceId: useDevice().id,
    },
  );

  if (!ready) return <Skeleton height={80} />;

  const handleAdd = () => {
    const list = doc.getList("readings");
    list.insert(list.length, {
      ts: Date.now(),
      hr: 80,
      spo2: 98,
    });
  };

  return (
    <Card>
      <StatusDot status={status} unsynced={unsyncedOps} />
      <Button onClick={handleAdd}>Record</Button>
    </Card>
  );
}
```

`status` cycles through `connecting → online → offline → syncing →
online` as the WS connection comes and goes. `unsyncedOps` shows how
many local writes are waiting in the IndexedDB outbox to be pushed
on reconnect — surface this in the UI so users know their work is
safe.

## Discovery

For dev, hardcode `edgeUrl` to `ws://localhost:7811`. For prod
deployments, the recommended pattern is a hospital-side `edge.js`
served by the medbrains-edge appliance over HTTPS that returns the
correct `edgeUrl` for the LAN — that way, mDNS discovery (which
browsers can't do natively) is replaced by a single HTTP call.
