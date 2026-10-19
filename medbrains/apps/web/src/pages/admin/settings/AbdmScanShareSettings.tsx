import { Group, Loader, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { type AbdmScanShareCounter, P } from "@medbrains/types";
import { IconPrinter } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";
import { Alert, Badge, Button, Select, Table } from "@/components/ui";
import { abdmScanShareService } from "@/services/abdmScanShare.service";
import { ScanSharePoster } from "./ScanSharePoster";

interface Poster {
  counter: AbdmScanShareCounter;
  hipId: string;
  payload: string;
}

/**
 * Settings → ABDM Scan & Share: each registration counter's QR, printed as
 * an A5 poster for the counter. A counter is a Reception or OPD-counter
 * station; its code is in the QR and never changes.
 */
export function AbdmScanShareSettings() {
  const canManage = useHasPermission(P.ABDM.SCANSHARE.MANAGE);
  const [facilityId, setFacilityId] = useState<string | null>(null);
  const [poster, setPoster] = useState<Poster | null>(null);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["abdm", "scan-share", "counters"],
    queryFn: abdmScanShareService.counters,
    enabled: canManage,
  });

  if (!canManage) return null;
  if (isLoading) return <Loader size="sm" />;
  if (isError || !data) {
    return (
      <Alert tone="danger" title="Could not load the counters">
        This does not mean there are none — the list failed to load.
      </Alert>
    );
  }
  const facilities = data.counters[0]?.qr_codes ?? [];
  const chosen = facilityId ?? facilities[0]?.facility_id ?? null;

  return (
    <Stack>
      <Group justify="space-between">
        <Text fw={600}>Scan & Share counters</Text>
        <Badge tone={data.environment === "production" ? "success" : "warning"}>
          {data.environment === "production" ? "Production" : "Sandbox"}
        </Badge>
      </Group>
      <Text size="sm" c="dimmed">
        Patients scan the counter's QR with their ABHA app and share their profile. They get a token
        at once, and the desk sees them under Front Office → Scan & Share.
      </Text>
      {data.counters.length > 0 && facilities.length === 0 && (
        <Alert tone="warning" title="No campus has an HFR facility ID">
          The QR names the campus by its HFR facility ID. Add it under Settings → Facilities.
        </Alert>
      )}
      {data.counters.length === 0 && (
        <Alert tone="info" title="No registration counters yet">
          Add a station of type Reception or OPD counter under Settings → Locations, then print its
          poster here.
        </Alert>
      )}
      {facilities.length > 1 && (
        <Select
          label="Campus (HIP ID)"
          value={chosen}
          onChange={setFacilityId}
          allowDeselect={false}
          data={facilities.map((f) => ({
            value: f.facility_id,
            label: `${f.facility_name} · ${f.hip_id}`,
          }))}
        />
      )}
      {data.counters.length > 0 && facilities.length > 0 && (
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Counter</Table.Th>
              <Table.Th>Code</Table.Th>
              <Table.Th>QR</Table.Th>
              <Table.Th>Poster</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {data.counters.map((counter) => {
              const qr = counter.qr_codes.find((q) => q.facility_id === chosen);
              const payload = qr?.payload;
              return (
                <Table.Tr key={counter.station_id}>
                  <Table.Td>{counter.name}</Table.Td>
                  <Table.Td>
                    <Text ff="monospace" size="sm">
                      {counter.code}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    {payload ? (
                      <QRCodeSVG value={payload} size={72} aria-label={`QR for ${counter.name}`} />
                    ) : (
                      "—"
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Button
                      tone="secondary"
                      leftSection={<IconPrinter size={16} aria-hidden />}
                      disabled={!payload || !qr}
                      onClick={() =>
                        qr && payload && setPoster({ counter, hipId: qr.hip_id, payload })
                      }
                    >
                      Poster
                    </Button>
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      )}
      {poster && (
        <ScanSharePoster
          opened
          onClose={() => setPoster(null)}
          hospitalName={data.hospital_name}
          counterName={poster.counter.name}
          counterCode={poster.counter.code}
          hipId={poster.hipId}
          payload={poster.payload}
        />
      )}
    </Stack>
  );
}
