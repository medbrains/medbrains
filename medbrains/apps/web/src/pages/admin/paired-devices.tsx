/**
 * Admin → Paired devices. Mint one-time QR pairing tokens for staff
 * / TV / vendor mobile clients, view active paired devices, revoke
 * a device's certificate (terminates its access immediately).
 *
 * Wires the staff/TV/vendor app's `<PairScreen>` (in
 * `@medbrains/mobile-shell`) to a real backend.
 */

import {
  Group,
  Loader,
  Modal,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components";
import { DepartmentSelect } from "@/components/DepartmentSelect";
import { Alert, Badge, Button, Table } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { adminDevicesService, type PairingToken } from "@/services/adminDevices.service";

// Surface catalog for the mint picker. Location-scoped (TV/kiosk) surfaces are grouped separately
// from user-scoped (mobile) ones; legacy coarse variants stay for existing apps. The backend
// validates by shape, so this list can grow without a code change.
const SURFACE_OPTIONS = [
  {
    group: "Legacy",
    items: [
      { value: "staff", label: "Staff (clinical, MDM)" },
      { value: "tv", label: "TV (generic display)" },
      { value: "vendor", label: "Vendor (contractor)" },
    ],
  },
  {
    group: "TV / kiosk (location-scoped)",
    items: [
      "TV-Queue",
      "TV-Ward",
      "TV-Emergency",
      "TV-Pharmacy",
      "TV-Lab",
      "TV-Billing",
      "TV-ICU",
      "TV-OT",
      "TV-DoctorRoom",
      "TV-Radiology",
      "TV-Wayfinding",
      "TV-Notice",
      "Desktop-Kiosk",
    ].map((v) => ({ value: v, label: v })),
  },
  {
    group: "Mobile (user-scoped)",
    items: [
      "Mobile-Doctor",
      "Mobile-Nurse",
      "Mobile-Pharmacist",
      "Mobile-Phlebo",
      "Mobile-Patient",
    ].map((v) => ({ value: v, label: v })),
  },
];

export function PairedDevicesPage() {
  useRequirePermission(P.DEVICES.PAIRING.PAIRED_LIST);
  const canMintToken = useHasPermission(P.DEVICES.PAIRING.TOKEN_CREATE);
  const canRevoke = useHasPermission(P.DEVICES.PAIRING.PAIRED_REVOKE);

  const [mintOpen, { open: openMint, close: closeMint }] = useDisclosure(false);
  const [tokenResult, setTokenResult] = useState<PairingToken | null>(null);

  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["paired-devices"],
    queryFn: () => adminDevicesService.listPairedDevices(),
  });

  const mintMutation = useMutation({
    mutationFn: (input: {
      intended_device_label: string;
      intended_app_variant: string;
      notes?: string;
      department_id?: string;
      location_label?: string;
    }) => adminDevicesService.mintDevicePairingToken(input),
    onSuccess: (result) => {
      setTokenResult(result);
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (input: { id: string; reason?: string }) =>
      adminDevicesService.revokePairedDevice(input.id, input.reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["paired-devices"] });
    },
  });

  return (
    <>
      <PageHeader
        title="Paired devices"
        subtitle="Mobile, TV, and vendor devices paired into this tenant via QR + mTLS."
        actions={
          canMintToken ? (
            <Button tone="primary" onClick={openMint}>
              Mint pairing token
            </Button>
          ) : undefined
        }
      />

      {isLoading && <Loader />}

      {!isLoading && (
        <Table withTableBorder withColumnBorders striped>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Label</Table.Th>
              <Table.Th>Variant</Table.Th>
              <Table.Th>Location</Table.Th>
              <Table.Th>Cert fingerprint</Table.Th>
              <Table.Th>Paired at</Table.Th>
              <Table.Th>Last seen</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {data?.map((row) => {
              const revoked = row.revoked_at != null;
              return (
                <Table.Tr key={row.id}>
                  <Table.Td>{row.label}</Table.Td>
                  <Table.Td>
                    <Badge>{row.app_variant}</Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs">{row.location_label ?? "—"}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Tooltip label={row.cert_fingerprint}>
                      <Text size="xs" ff="monospace">
                        {row.cert_fingerprint.slice(0, 12)}…
                      </Text>
                    </Tooltip>
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs" ff="monospace">
                      {new Date(row.paired_at).toLocaleString()}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs" ff="monospace">
                      {row.last_seen_at ? new Date(row.last_seen_at).toLocaleString() : "—"}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    {revoked ? (
                      <Badge tone="danger">revoked</Badge>
                    ) : (
                      <Badge tone="success">active</Badge>
                    )}
                  </Table.Td>
                  <Table.Td>
                    {!revoked && canRevoke && (
                      <Button
                        tone="subtle-danger"
                        size="xs"
                        loading={revokeMutation.isPending}
                        onClick={() => revokeMutation.mutate({ id: row.id })}
                      >
                        Revoke
                      </Button>
                    )}
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      )}

      <Modal opened={mintOpen} onClose={closeMint} title="Mint pairing token" size="lg">
        {tokenResult ? (
          <PairingTokenView
            token={tokenResult}
            onDone={() => {
              setTokenResult(null);
              closeMint();
              queryClient.invalidateQueries({ queryKey: ["paired-devices"] });
            }}
          />
        ) : (
          <MintTokenForm
            busy={mintMutation.isPending}
            error={mintMutation.error instanceof Error ? mintMutation.error.message : null}
            onSubmit={(input) => mintMutation.mutate(input)}
          />
        )}
      </Modal>
    </>
  );
}

interface MintFormState {
  intended_device_label: string;
  intended_app_variant: string;
  notes?: string;
  department_id?: string;
  location_label?: string;
}

function MintTokenForm({
  busy,
  error,
  onSubmit,
}: {
  busy: boolean;
  error: string | null;
  onSubmit: (input: MintFormState) => void;
}) {
  const [label, setLabel] = useState("");
  const [variant, setVariant] = useState<string>("staff");
  const [departmentId, setDepartmentId] = useState("");
  const [locationLabel, setLocationLabel] = useState("");
  const [notes, setNotes] = useState("");

  return (
    <Stack>
      <TextInput
        label="Device label"
        placeholder="e.g. ICU station 1"
        value={label}
        onChange={(e) => setLabel(e.currentTarget.value)}
        required
      />
      <Select
        label="App variant (surface)"
        value={variant}
        onChange={(value) => setVariant(value ?? "staff")}
        data={SURFACE_OPTIONS}
        searchable
        required
      />
      <DepartmentSelect value={departmentId} onChange={setDepartmentId} />
      <TextInput
        label="Location label"
        placeholder="e.g. Reception, Ward 3B, OPD entrance"
        value={locationLabel}
        onChange={(e) => setLocationLabel(e.currentTarget.value)}
      />
      <Textarea
        label="Notes"
        placeholder="Any context for the audit log."
        value={notes}
        onChange={(e) => setNotes(e.currentTarget.value)}
      />
      {error && <Alert tone="danger">{error}</Alert>}
      <Group justify="flex-end">
        <Button
          tone="primary"
          loading={busy}
          disabled={!label || busy}
          onClick={() =>
            onSubmit({
              intended_device_label: label,
              intended_app_variant: variant,
              notes: notes || undefined,
              department_id: departmentId || undefined,
              location_label: locationLabel || undefined,
            })
          }
        >
          Mint token
        </Button>
      </Group>
    </Stack>
  );
}

function PairingTokenView({ token, onDone }: { token: PairingToken; onDone: () => void }) {
  const expiresIn = Math.max(
    0,
    Math.floor((new Date(token.expires_at).getTime() - Date.now()) / 1000),
  );
  return (
    <Stack>
      <Alert tone="success" title="Token minted">
        Show this QR / payload to the device. The token expires in {expiresIn} seconds and is
        single-use.
      </Alert>
      <Title order={4}>QR payload</Title>
      <Text ff="monospace" size="sm" style={{ wordBreak: "break-all" }}>
        {token.qr_payload}
      </Text>
      <Title order={4}>Token (one-time)</Title>
      <Text ff="monospace" size="sm" style={{ wordBreak: "break-all" }}>
        {token.token}
      </Text>
      <Group justify="flex-end">
        <Button tone="primary" onClick={onDone}>
          Done
        </Button>
      </Group>
    </Stack>
  );
}
