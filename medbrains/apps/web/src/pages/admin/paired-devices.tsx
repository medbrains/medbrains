/**
 * Admin → Paired devices. Mint one-time QR pairing tokens for staff
 * / TV / vendor mobile clients, view active paired devices, revoke
 * a device's certificate (terminates its access immediately).
 *
 * Wires the staff/TV/vendor app's `<PairScreen>` (in
 * `@medbrains/mobile-shell`) to a real backend.
 */

import {
  Alert,
  Badge,
  Button,
  Group,
  Loader,
  Modal,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Textarea,
  Title,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { api } from "@medbrains/api";
import { P } from "@medbrains/types";
import { useHasPermission } from "@medbrains/stores";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useRequirePermission } from "../../hooks/useRequirePermission";
import { PageHeader } from "../../components";

interface PairingToken {
  id: string;
  token: string;
  qr_payload: string;
  expires_at: string;
  intended_device_label: string;
  intended_app_variant: string;
}

interface PairedDeviceRow {
  id: string;
  label: string;
  app_variant: string;
  cert_fingerprint: string;
  issued_to_user_id: string | null;
  paired_at: string;
  last_seen_at: string | null;
  revoked_at: string | null;
}

export function PairedDevicesPage() {
  useRequirePermission(P.DEVICES.PAIRING.PAIRED_LIST);
  const canMintToken = useHasPermission(P.DEVICES.PAIRING.TOKEN_CREATE);
  const canRevoke = useHasPermission(P.DEVICES.PAIRING.PAIRED_REVOKE);

  const [mintOpen, { open: openMint, close: closeMint }] = useDisclosure(false);
  const [tokenResult, setTokenResult] = useState<PairingToken | null>(null);

  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["paired-devices"],
    queryFn: () => api.listPairedDevices() as Promise<PairedDeviceRow[]>,
  });

  const mintMutation = useMutation({
    mutationFn: (input: {
      intended_device_label: string;
      intended_app_variant: "staff" | "tv" | "vendor";
      notes?: string;
    }) => api.mintDevicePairingToken(input) as Promise<PairingToken>,
    onSuccess: (result) => {
      setTokenResult(result);
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (input: { id: string; reason?: string }) =>
      api.revokePairedDevice(input.id, input.reason),
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
            <Button onClick={openMint}>Mint pairing token</Button>
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
                    <Badge variant="light">{row.app_variant}</Badge>
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
                      {row.last_seen_at
                        ? new Date(row.last_seen_at).toLocaleString()
                        : "—"}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    {revoked ? (
                      <Badge color="red">revoked</Badge>
                    ) : (
                      <Badge color="green">active</Badge>
                    )}
                  </Table.Td>
                  <Table.Td>
                    {!revoked && canRevoke && (
                      <Button
                        size="xs"
                        color="red"
                        variant="outline"
                        loading={revokeMutation.isPending}
                        onClick={() =>
                          revokeMutation.mutate({ id: row.id })
                        }
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
  intended_app_variant: "staff" | "tv" | "vendor";
  notes?: string;
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
  const [variant, setVariant] = useState<"staff" | "tv" | "vendor">("staff");
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
        label="App variant"
        value={variant}
        onChange={(v) => v && setVariant(v as "staff" | "tv" | "vendor")}
        data={[
          { value: "staff", label: "Staff (clinical, MDM)" },
          { value: "tv", label: "TV (kiosk display)" },
          { value: "vendor", label: "Vendor (3rd-party contractor)" },
        ]}
        required
      />
      <Textarea
        label="Notes"
        placeholder="Any context for the audit log."
        value={notes}
        onChange={(e) => setNotes(e.currentTarget.value)}
      />
      {error && <Alert color="red">{error}</Alert>}
      <Group justify="flex-end">
        <Button
          loading={busy}
          disabled={!label || busy}
          onClick={() =>
            onSubmit({
              intended_device_label: label,
              intended_app_variant: variant,
              notes: notes || undefined,
            })
          }
        >
          Mint token
        </Button>
      </Group>
    </Stack>
  );
}

function PairingTokenView({
  token,
  onDone,
}: {
  token: PairingToken;
  onDone: () => void;
}) {
  const expiresIn = Math.max(
    0,
    Math.floor((new Date(token.expires_at).getTime() - Date.now()) / 1000),
  );
  return (
    <Stack>
      <Alert color="green" title="Token minted">
        Show this QR / payload to the device. The token expires in {expiresIn} seconds and
        is single-use.
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
        <Button onClick={onDone}>Done</Button>
      </Group>
    </Stack>
  );
}
