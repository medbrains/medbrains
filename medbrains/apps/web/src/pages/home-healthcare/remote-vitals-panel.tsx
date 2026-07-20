// Home-healthcare RemoteVitalsPanel — split from home-healthcare.tsx (pure move).

import { Group, NumberInput, Select, Stack, Text } from "@mantine/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Badge, Button, toast } from "@/components/ui";
import { homeHealthService } from "@/services/homeHealth.service";

const DEVICE_FIELDS: Record<string, { key: string; label: string }[]> = {
  pulse_ox: [
    { key: "spo2", label: "SpO₂ %" },
    { key: "pulse", label: "Pulse" },
  ],
  bp: [
    { key: "systolic", label: "Systolic" },
    { key: "diastolic", label: "Diastolic" },
  ],
  glucometer: [{ key: "glucose", label: "Glucose" }],
  thermometer: [{ key: "temp", label: "Temp °C" }],
  weight: [{ key: "weight", label: "Weight kg" }],
};

export function RemoteVitalsPanel({
  patientId,
  canManage,
}: {
  patientId: string;
  canManage: boolean;
}) {
  const qc = useQueryClient();
  const [device, setDevice] = useState("pulse_ox");
  const [values, setValues] = useState<Record<string, number | "">>({});
  const fields = DEVICE_FIELDS[device] ?? [];

  const { data = [] } = useQuery({
    queryKey: ["remote-vitals", patientId],
    queryFn: () => homeHealthService.listRemoteVitals(patientId),
    refetchInterval: 30_000,
  });
  const record = useMutation({
    mutationFn: () => {
      const reading: Record<string, number> = {};
      for (const f of fields) {
        const v = values[f.key];
        if (typeof v === "number") reading[f.key] = v;
      }
      return homeHealthService.ingestRemoteVital({
        patient_id: patientId,
        device_type: device,
        reading,
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["remote-vitals", patientId] });
      toast.success("Reading recorded", { title: "Home healthcare" });
      setValues({});
    },
    onError: (e: Error) => toast.error(e.message, { title: "Failed" }),
  });

  return (
    <Stack gap="sm">
      <Text fw={600} size="sm">
        Remote monitoring
      </Text>
      {canManage && (
        <Group align="flex-end" gap="sm">
          <Select
            label="Device"
            data={Object.keys(DEVICE_FIELDS).map((d) => ({ value: d, label: d.replace("_", " ") }))}
            value={device}
            onChange={(v) => {
              setDevice(v ?? "pulse_ox");
              setValues({});
            }}
            w={150}
          />
          {fields.map((f) => (
            <NumberInput
              key={f.key}
              label={f.label}
              value={values[f.key] ?? ""}
              onChange={(v) =>
                setValues((p) => ({ ...p, [f.key]: typeof v === "number" ? v : "" }))
              }
              w={110}
            />
          ))}
          <Button onClick={() => record.mutate()} loading={record.isPending}>
            Record
          </Button>
        </Group>
      )}
      {data.length === 0 ? (
        <Text size="sm" c="dimmed">
          No remote readings.
        </Text>
      ) : (
        data.map((r) => (
          <Group key={r.id} gap="xs">
            <Badge tone={r.is_flagged ? "danger" : "neutral"} size="xs">
              {r.device_type.replace("_", " ")}
            </Badge>
            <Text size="sm">
              {Object.entries(r.reading)
                .map(([k, v]) => `${k}: ${v}`)
                .join(" · ")}
            </Text>
            {r.is_flagged && (
              <Badge tone="danger" size="xs">
                abnormal
              </Badge>
            )}
            <Text size="xs" c="dimmed">
              {new Date(r.measured_at).toLocaleString()}
            </Text>
          </Group>
        ))
      )}
    </Stack>
  );
}
