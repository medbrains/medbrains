/**
 * Admin → Paired devices. Mint one-time QR pairing tokens for staff
 * / TV / vendor mobile clients, view active paired devices, revoke
 * a device's certificate (terminates its access immediately).
 *
 * Wires the staff/TV/vendor app's `<PairScreen>` (in
 * `@medbrains/mobile-shell`) to a real backend.
 */

import { zodResolver } from "@hookform/resolvers/zod";
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
import { notifications } from "@mantine/notifications";
import {
  type DeviceMintTokenInput,
  deviceMintTokenSchema,
  type StationCreateInput,
  stationCreateSchema,
} from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import { P, STATION_TYPES, type Station } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { PageHeader } from "@/components";
import { DepartmentSelect } from "@/components/DepartmentSelect";
import { Alert, Badge, Button, Table } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { adminDevicesService, type PairingToken } from "@/services/adminDevices.service";
import { SyncKeyBadge, SyncKeyModal } from "./paired-device-sync-key";

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
  const [syncKeyFor, setSyncKeyFor] = useState<{ id: string; label: string } | null>(null);

  // One request for the whole fleet. The per-device endpoint exists, but calling
  // it once per row is an N+1 against a table that lists every device in the
  // hospital.
  const { data: roster } = useQuery({
    queryKey: ["peer-roster"],
    queryFn: () => adminDevicesService.getPeerRoster(),
  });

  const nodeIdByDevice = useMemo(() => {
    const index = new Map<string, string>();
    for (const peer of roster?.peers ?? []) {
      index.set(peer.paired_device_id, peer.node_id);
    }
    return index;
  }, [roster]);

  const canManageLocations = useHasPermission(P.ADMIN.SETTINGS.LOCATIONS_CREATE);
  const [mintOpen, { open: openMint, close: closeMint }] = useDisclosure(false);
  const [stationsOpen, { open: openStations, close: closeStations }] = useDisclosure(false);
  const [tokenResult, setTokenResult] = useState<PairingToken | null>(null);

  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["paired-devices"],
    queryFn: () => adminDevicesService.listPairedDevices(),
  });
  const { data: stations = [] } = useQuery({
    queryKey: ["stations"],
    queryFn: () => adminDevicesService.listStations(),
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
          <Group gap="sm">
            {canManageLocations && (
              <Button tone="secondary" onClick={openStations}>
                Manage stations
              </Button>
            )}
            {canMintToken && (
              <Button tone="primary" onClick={openMint}>
                Mint pairing token
              </Button>
            )}
          </Group>
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
              <Table.Th>Sync key</Table.Th>
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
                    <Text size="xs">{row.location_label ?? row.station_name ?? "—"}</Text>
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
                    {revoked ? (
                      <Text size="xs" c="dimmed">
                        —
                      </Text>
                    ) : (
                      <Button
                        tone="ghost"
                        size="xs"
                        onClick={() => setSyncKeyFor({ id: row.id, label: row.label })}
                        aria-label={`Manage the sync key for ${row.label}`}
                      >
                        <SyncKeyBadge nodeId={nodeIdByDevice.get(row.id)} />
                      </Button>
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

      <SyncKeyModal
        device={syncKeyFor}
        nodeId={syncKeyFor ? nodeIdByDevice.get(syncKeyFor.id) : undefined}
        canManage={canMintToken}
        onClose={() => setSyncKeyFor(null)}
      />

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
            stations={stations}
            busy={mintMutation.isPending}
            error={mintMutation.error instanceof Error ? mintMutation.error.message : null}
            onSubmit={(input) => mintMutation.mutate(input)}
          />
        )}
      </Modal>

      <Modal opened={stationsOpen} onClose={closeStations} title="Stations" size="lg">
        <StationsManager />
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
  station_id?: string;
}

const MINT_DEFAULTS: DeviceMintTokenInput = {
  intended_device_label: "",
  intended_app_variant: "staff",
  station_id: null,
  department_id: null,
  location_label: "",
  notes: "",
};

function MintTokenForm({
  stations,
  busy,
  error,
  onSubmit,
}: {
  stations: Station[];
  busy: boolean;
  error: string | null;
  onSubmit: (input: MintFormState) => void;
}) {
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<DeviceMintTokenInput>({
    resolver: zodResolver(deviceMintTokenSchema),
    defaultValues: MINT_DEFAULTS,
    mode: "onTouched",
  });

  const submit = handleSubmit((v) =>
    onSubmit({
      intended_device_label: v.intended_device_label.trim(),
      intended_app_variant: v.intended_app_variant,
      notes: v.notes?.trim() || undefined,
      department_id: v.department_id || undefined,
      location_label: v.location_label?.trim() || undefined,
      station_id: v.station_id || undefined,
    }),
  );

  return (
    <Stack>
      <Controller
        control={control}
        name="intended_device_label"
        render={({ field }) => (
          <TextInput
            label="Device label"
            placeholder="e.g. ICU station 1"
            {...field}
            error={errors.intended_device_label?.message}
            required
          />
        )}
      />
      <Controller
        control={control}
        name="intended_app_variant"
        render={({ field }) => (
          <Select
            label="App variant (surface)"
            data={SURFACE_OPTIONS}
            searchable
            required
            value={field.value}
            onChange={(value) => field.onChange(value ?? "staff")}
            error={errors.intended_app_variant?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="station_id"
        render={({ field }) => (
          <Select
            label="Station (optional)"
            placeholder="Bind to a station"
            data={stations.map((s) => ({ value: s.id, label: `${s.name} (${s.station_type})` }))}
            clearable
            searchable
            value={field.value ?? null}
            onChange={field.onChange}
          />
        )}
      />
      <Controller
        control={control}
        name="department_id"
        render={({ field }) => (
          <DepartmentSelect value={field.value ?? ""} onChange={field.onChange} />
        )}
      />
      <Controller
        control={control}
        name="location_label"
        render={({ field }) => (
          <TextInput
            label="Location label"
            placeholder="e.g. Reception, Ward 3B, OPD entrance"
            {...field}
            value={field.value ?? ""}
          />
        )}
      />
      <Controller
        control={control}
        name="notes"
        render={({ field }) => (
          <Textarea
            label="Notes"
            placeholder="Any context for the audit log."
            {...field}
            value={field.value ?? ""}
          />
        )}
      />
      {error && <Alert tone="danger">{error}</Alert>}
      <Group justify="flex-end">
        <Button tone="primary" loading={busy} onClick={submit}>
          Mint token
        </Button>
      </Group>
    </Stack>
  );
}

const STATION_DEFAULTS: StationCreateInput = {
  code: "",
  name: "",
  station_type: "other",
  department_id: null,
};

function StationsManager() {
  const qc = useQueryClient();
  const { data: stations = [] } = useQuery({
    queryKey: ["stations"],
    queryFn: () => adminDevicesService.listStations(),
  });
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<StationCreateInput>({
    resolver: zodResolver(stationCreateSchema),
    defaultValues: STATION_DEFAULTS,
    mode: "onTouched",
  });

  const createMut = useMutation({
    mutationFn: (v: StationCreateInput) =>
      adminDevicesService.createStation({
        code: v.code.trim(),
        name: v.name.trim(),
        station_type: v.station_type,
        department_id: v.department_id || undefined,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["stations"] });
      reset(STATION_DEFAULTS);
      notifications.show({ title: "Station created", message: "", color: "success" });
    },
    onError: (e: Error) =>
      notifications.show({ title: "Create failed", message: e.message, color: "danger" }),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => adminDevicesService.deleteStation(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["stations"] }),
  });

  const submit = handleSubmit((v) => createMut.mutate(v));

  return (
    <Stack>
      <Table withTableBorder striped>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Code</Table.Th>
            <Table.Th>Name</Table.Th>
            <Table.Th>Type</Table.Th>
            <Table.Th />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {stations.map((s) => (
            <Table.Tr key={s.id}>
              <Table.Td>{s.code}</Table.Td>
              <Table.Td>{s.name}</Table.Td>
              <Table.Td>
                <Badge>{s.station_type}</Badge>
              </Table.Td>
              <Table.Td>
                <Button
                  tone="subtle-danger"
                  size="xs"
                  loading={delMut.isPending}
                  onClick={() => delMut.mutate(s.id)}
                >
                  Delete
                </Button>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

      <Title order={5}>Add station</Title>
      <Group align="flex-start" grow>
        <Controller
          control={control}
          name="code"
          render={({ field }) => (
            <TextInput
              label="Code"
              placeholder="OPD-C3"
              {...field}
              error={errors.code?.message}
              required
            />
          )}
        />
        <Controller
          control={control}
          name="name"
          render={({ field }) => (
            <TextInput
              label="Name"
              placeholder="OPD Counter 3"
              {...field}
              error={errors.name?.message}
              required
            />
          )}
        />
      </Group>
      <Group align="flex-start" grow>
        <Controller
          control={control}
          name="station_type"
          render={({ field }) => (
            <Select
              label="Type"
              data={STATION_TYPES.map((t) => ({ value: t, label: t }))}
              value={field.value}
              onChange={(v) => field.onChange(v ?? "other")}
            />
          )}
        />
        <Controller
          control={control}
          name="department_id"
          render={({ field }) => (
            <DepartmentSelect value={field.value ?? ""} onChange={field.onChange} />
          )}
        />
      </Group>
      <Group justify="flex-end">
        <Button tone="primary" loading={createMut.isPending} onClick={submit}>
          Add station
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
