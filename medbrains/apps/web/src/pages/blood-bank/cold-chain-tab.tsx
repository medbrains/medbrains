// BLOOD-BANK ColdChainTab — split from blood-bank.tsx (pure move).

import { Drawer, Group, NumberInput, Select, Stack, Text, TextInput } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useHasPermission } from "@medbrains/stores";
import type {
  AddBbReadingRequest,
  BbColdChainDeviceRow,
  BbColdChainReadingRow,
  CreateBbDeviceRequest,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconCheck, IconPlus, IconSnowflake } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components";
import { Badge, type BadgeTone, Button, toast } from "@/components/ui";
import { bloodBankService } from "@/services/bloodBank.service";

const alertLevelColors: Record<string, BadgeTone> = {
  normal: "success",
  warning: "warning",
  critical: "danger",
};

export function ColdChainTab() {
  const qc = useQueryClient();
  const canManage = useHasPermission(P.BLOOD_BANK.INVENTORY_MANAGE);
  const [deviceOpen, { open: openDevice, close: closeDevice }] = useDisclosure(false);
  const [readingOpen, { open: openReading, close: closeReading }] = useDisclosure(false);
  const [selectedDevice, setSelectedDevice] = useState<BbColdChainDeviceRow | null>(null);

  const { data: devices, isLoading } = useQuery({
    queryKey: ["blood-bank", "cold-chain-devices"],
    queryFn: () => bloodBankService.listBbDevices(),
  });

  const { data: readings } = useQuery({
    queryKey: ["blood-bank", "cold-chain-readings", selectedDevice?.id],
    queryFn: () => bloodBankService.listBbReadings(selectedDevice?.id ?? ""),
    enabled: !!selectedDevice,
  });

  const [devName, setDevName] = useState("");
  const [devSerial, setDevSerial] = useState("");
  const [devLocation, setDevLocation] = useState("");
  const [devType, setDevType] = useState<string | null>("refrigerator");
  const [devMinTemp, setDevMinTemp] = useState<number | undefined>();
  const [devMaxTemp, setDevMaxTemp] = useState<number | undefined>();

  const createDeviceMut = useMutation({
    mutationFn: (d: CreateBbDeviceRequest) => bloodBankService.createBbDevice(d),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["blood-bank", "cold-chain-devices"] });
      closeDevice();
      toast.success("Cold chain device registered", { title: "Device added" });
    },
  });

  const [readingDeviceId, setReadingDeviceId] = useState<string | null>(null);
  const [readingTemp, setReadingTemp] = useState<number>(4);
  const [readingHumidity, setReadingHumidity] = useState<number | undefined>();

  const addReadingMut = useMutation({
    mutationFn: (d: AddBbReadingRequest) => bloodBankService.addBbReading(d),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["blood-bank", "cold-chain"] });
      closeReading();
      toast.success("Temperature reading recorded", { title: "Reading logged" });
    },
  });

  const deviceColumns = [
    {
      key: "device_name" as const,
      label: "Device",
      render: (d: BbColdChainDeviceRow) => d.device_name,
    },
    {
      key: "equipment_type" as const,
      label: "Type",
      render: (d: BbColdChainDeviceRow) => d.equipment_type,
    },
    {
      key: "location" as const,
      label: "Location",
      render: (d: BbColdChainDeviceRow) => d.location ?? "—",
    },
    {
      key: "last_temp" as const,
      label: "Last Temp",
      render: (d: BbColdChainDeviceRow) => (d.last_temp ? `${d.last_temp} C` : "—"),
    },
    {
      key: "alert_level" as const,
      label: "Alert",
      render: (d: BbColdChainDeviceRow) =>
        d.alert_level ? (
          <Badge tone={alertLevelColors[d.alert_level] ?? "neutral"}>{d.alert_level}</Badge>
        ) : (
          <Badge tone="neutral">N/A</Badge>
        ),
    },
    {
      key: "is_active" as const,
      label: "Active",
      render: (d: BbColdChainDeviceRow) =>
        d.is_active ? <IconCheck size={16} color="green" /> : <Text c="dimmed">No</Text>,
    },
    {
      key: "id" as const,
      label: "",
      render: (d: BbColdChainDeviceRow) => (
        <Button tone="secondary" size="compact-xs" onClick={() => setSelectedDevice(d)}>
          Readings
        </Button>
      ),
    },
  ];

  const readingColumns = [
    {
      key: "recorded_at" as const,
      label: "Time",
      render: (r: BbColdChainReadingRow) => new Date(r.recorded_at).toLocaleString(),
    },
    {
      key: "temperature" as const,
      label: "Temp (C)",
      render: (r: BbColdChainReadingRow) => r.temperature,
    },
    {
      key: "humidity" as const,
      label: "Humidity",
      render: (r: BbColdChainReadingRow) => r.humidity ?? "—",
    },
    {
      key: "alert_level" as const,
      label: "Alert",
      render: (r: BbColdChainReadingRow) =>
        r.alert_level ? (
          <Badge tone={alertLevelColors[r.alert_level] ?? "neutral"}>{r.alert_level}</Badge>
        ) : (
          <Text size="sm" c="dimmed">
            —
          </Text>
        ),
    },
  ];

  return (
    <Stack mt="md">
      <Group>
        {canManage && (
          <>
            <Button tone="primary" leftSection={<IconSnowflake size={16} />} onClick={openDevice}>
              Add Device
            </Button>
            <Button tone="secondary" leftSection={<IconPlus size={16} />} onClick={openReading}>
              Log Reading
            </Button>
          </>
        )}
      </Group>

      <DataTable
        columns={deviceColumns}
        data={devices ?? []}
        loading={isLoading}
        rowKey={(d) => d.id}
      />

      {selectedDevice && (
        <Drawer
          opened
          onClose={() => setSelectedDevice(null)}
          title={`Readings: ${selectedDevice.device_name}`}
          position="right"
          size="lg"
        >
          <DataTable
            columns={readingColumns}
            data={readings ?? []}
            loading={false}
            rowKey={(r) => r.id}
          />
        </Drawer>
      )}

      <Drawer
        opened={deviceOpen}
        onClose={closeDevice}
        title="Add Cold Chain Device"
        position="right"
        size="xl"
      >
        <Stack>
          <TextInput
            label="Device Name"
            required
            value={devName}
            onChange={(e) => setDevName(e.currentTarget.value)}
          />
          <TextInput
            label="Serial Number"
            value={devSerial}
            onChange={(e) => setDevSerial(e.currentTarget.value)}
          />
          <TextInput
            label="Location"
            value={devLocation}
            onChange={(e) => setDevLocation(e.currentTarget.value)}
          />
          <Select
            label="Equipment Type"
            required
            data={[
              { value: "refrigerator", label: "Blood Bank Refrigerator" },
              { value: "freezer", label: "Plasma Freezer" },
              { value: "platelet_agitator", label: "Platelet Agitator" },
              { value: "transport_box", label: "Transport Box" },
            ]}
            value={devType}
            onChange={setDevType}
          />
          <NumberInput
            label="Min Temp (C)"
            value={devMinTemp}
            onChange={(v) => setDevMinTemp(v === "" ? undefined : Number(v))}
          />
          <NumberInput
            label="Max Temp (C)"
            value={devMaxTemp}
            onChange={(v) => setDevMaxTemp(v === "" ? undefined : Number(v))}
          />
          <Button
            tone="primary"
            onClick={() => {
              if (!devName || !devType) return;
              createDeviceMut.mutate({
                device_name: devName,
                device_serial: devSerial || undefined,
                location: devLocation || undefined,
                equipment_type: devType,
                min_temp: devMinTemp,
                max_temp: devMaxTemp,
              });
            }}
            loading={createDeviceMut.isPending}
          >
            Register Device
          </Button>
        </Stack>
      </Drawer>

      <Drawer
        opened={readingOpen}
        onClose={closeReading}
        title="Log Temperature Reading"
        position="right"
        size="xl"
      >
        <Stack>
          <Select
            label="Device"
            required
            data={(devices ?? []).map((d) => ({ value: d.id, label: d.device_name }))}
            value={readingDeviceId}
            onChange={setReadingDeviceId}
          />
          <NumberInput
            label="Temperature (C)"
            required
            value={readingTemp}
            onChange={(v) => setReadingTemp(Number(v))}
            step={0.1}
          />
          <NumberInput
            label="Humidity (%)"
            value={readingHumidity}
            onChange={(v) => setReadingHumidity(v === "" ? undefined : Number(v))}
          />
          <Button
            tone="primary"
            onClick={() => {
              if (!readingDeviceId) return;
              addReadingMut.mutate({
                device_id: readingDeviceId,
                temperature: readingTemp,
                humidity: readingHumidity,
              });
            }}
            loading={addReadingMut.isPending}
          >
            Log Reading
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Compliance Tab (Lookback, SBTC, Recruitment)
// ══════════════════════════════════════════════════════════
