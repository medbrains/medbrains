// IPD CalibrationTab — split from bme.tsx (pure move).

import { Drawer, Group, Select, Stack, Switch, Text, Textarea, TextInput } from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { useHasPermission } from "@medbrains/stores";
import type { BmeCalibration, CreateBmeCalibrationRequest } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconAlertTriangle, IconClock, IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { DataTable } from "@/components";
import type { Column } from "@/components/DataTable";
import { Alert, Badge, type BadgeTone, Button } from "@/components/ui";
import { bmeService } from "@/services/bme.service";
import { daysUntil, fmtDate, PM_FREQUENCIES } from "./shared";

const CALIBRATION_STATUSES = [
  { value: "calibrated", label: "Calibrated" },
  { value: "due", label: "Due" },
  { value: "overdue", label: "Overdue" },
  { value: "out_of_tolerance", label: "Out of Tolerance" },
  { value: "exempted", label: "Exempted" },
];

function calStatusBadge(s: string) {
  const map: Record<string, BadgeTone> = {
    calibrated: "success",
    due: "warning",
    overdue: "danger",
    out_of_tolerance: "danger",
    exempted: "neutral",
  };
  return (
    <Badge tone={map[s] ?? "neutral"} variant="light" size="sm">
      {s.replace(/_/g, " ")}
    </Badge>
  );
}

export function CalibrationTab() {
  const canManage = useHasPermission(P.BME.CALIBRATION_MANAGE);
  const qc = useQueryClient();
  const [opened, { open, close }] = useDisclosure(false);
  const [form, setForm] = useState<CreateBmeCalibrationRequest>({ equipment_id: "" });

  const { data = [], isLoading } = useQuery({
    queryKey: ["bme-calibrations"],
    queryFn: () => bmeService.listBmeCalibrations(),
  });

  const { data: equipment = [] } = useQuery({
    queryKey: ["bme-equipment"],
    queryFn: () => bmeService.listBmeEquipment(),
  });
  const equipOptions = equipment.map((e) => ({
    value: e.id,
    label: `${e.name} (${e.asset_tag ?? e.serial_number ?? "—"})`,
  }));

  const createMut = useMutation({
    mutationFn: (body: CreateBmeCalibrationRequest) => bmeService.createBmeCalibration(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["bme-calibrations"] });
      close();
      notifications.show({ message: "Calibration recorded" });
    },
  });

  const calibrationAlerts = useMemo(() => {
    const items = data
      .flatMap((c) => {
        if (!c.next_due_date) return [];
        const daysLeft = daysUntil(c.next_due_date);
        if (daysLeft > 30) return [];
        return [
          {
            ...c,
            equipName: equipment.find((e) => e.id === c.equipment_id)?.name ?? c.equipment_id,
            daysLeft,
          },
        ];
      })
      .sort((a, b) => a.daysLeft - b.daysLeft);
    return items;
  }, [data, equipment]);

  const columns: Column<BmeCalibration>[] = [
    {
      key: "equipment",
      label: "Equipment",
      render: (r) => (
        <Text size="sm">{equipment.find((e) => e.id === r.equipment_id)?.name ?? "—"}</Text>
      ),
    },
    { key: "status", label: "Status", render: (r) => calStatusBadge(r.calibration_status) },
    {
      key: "frequency",
      label: "Frequency",
      render: (r) => (
        <Badge tone="neutral" variant="light" size="sm">
          {r.frequency.replace(/_/g, " ")}
        </Badge>
      ),
    },
    {
      key: "last_cal",
      label: "Last Calibrated",
      render: (r) => <Text size="sm">{fmtDate(r.last_calibrated_date)}</Text>,
    },
    {
      key: "next_due",
      label: "Next Due",
      render: (r) => {
        const overdue = r.next_due_date && new Date(r.next_due_date) < new Date();
        return (
          <Text size="sm" c={overdue ? "danger" : undefined} fw={overdue ? 700 : undefined}>
            {fmtDate(r.next_due_date)}
          </Text>
        );
      },
    },
    {
      key: "tolerance",
      label: "In Tolerance",
      render: (r) =>
        r.is_in_tolerance === true ? (
          <Badge tone="success" size="sm">
            Yes
          </Badge>
        ) : r.is_in_tolerance === false ? (
          <Badge tone="danger" size="sm">
            No
          </Badge>
        ) : (
          <Text size="sm">—</Text>
        ),
    },
    {
      key: "certificate",
      label: "Certificate #",
      render: (r) => <Text size="sm">{r.certificate_number ?? "—"}</Text>,
    },
    {
      key: "locked",
      label: "Locked",
      render: (r) =>
        r.is_locked ? (
          <Badge tone="danger" size="sm">
            Locked
          </Badge>
        ) : null,
    },
  ];

  return (
    <Stack>
      {calibrationAlerts.length > 0 && (
        <Alert
          tone={calibrationAlerts.some((a) => a.daysLeft < 0) ? "danger" : "warning"}
          title={`${calibrationAlerts.length} Calibration${calibrationAlerts.length > 1 ? "s" : ""} Due Soon`}
          icon={<IconAlertTriangle size={20} />}
        >
          <Stack gap={4}>
            {calibrationAlerts.map((a) => (
              <Group key={a.id} gap="xs">
                <Text size="sm" fw={500}>
                  {a.equipName}
                </Text>
                {a.daysLeft < 0 ? (
                  <Badge tone="danger" size="sm" variant="filled">
                    OVERDUE by {Math.abs(a.daysLeft)}d
                  </Badge>
                ) : (
                  <Badge tone="warning" size="sm" leftSection={<IconClock size={12} />}>
                    Due in {a.daysLeft}d
                  </Badge>
                )}
                <Text size="xs" c="dimmed">
                  ({fmtDate(a.next_due_date)})
                </Text>
              </Group>
            ))}
          </Stack>
        </Alert>
      )}

      <Group justify="flex-end">
        {canManage && (
          <Button
            tone="primary"
            leftSection={<IconPlus size={16} />}
            onClick={() => {
              setForm({ equipment_id: "" });
              open();
            }}
          >
            Record Calibration
          </Button>
        )}
      </Group>
      <DataTable columns={columns} data={data} loading={isLoading} rowKey={(r) => r.id} />

      <Drawer opened={opened} onClose={close} title="Record Calibration" position="right" size="xl">
        <Stack>
          <Select
            label="Equipment"
            required
            data={equipOptions}
            value={form.equipment_id}
            onChange={(v) => setForm({ ...form, equipment_id: v ?? "" })}
            searchable
          />
          <Select
            label="Status"
            data={CALIBRATION_STATUSES}
            value={form.calibration_status ?? "calibrated"}
            onChange={(v) =>
              setForm({
                ...form,
                calibration_status: (v ??
                  "calibrated") as CreateBmeCalibrationRequest["calibration_status"],
              })
            }
          />
          <Select
            label="Frequency"
            data={PM_FREQUENCIES}
            value={form.frequency ?? "annual"}
            onChange={(v) =>
              setForm({
                ...form,
                frequency: (v ?? "annual") as CreateBmeCalibrationRequest["frequency"],
              })
            }
          />
          <DateInput
            label="Calibrated On"
            value={form.last_calibrated_date ?? null}
            onChange={(d) => setForm({ ...form, last_calibrated_date: d?.slice(0, 10) })}
          />
          <DateInput
            label="Next Due"
            value={form.next_due_date ?? null}
            onChange={(d) => setForm({ ...form, next_due_date: d?.slice(0, 10) })}
          />
          <TextInput
            label="Calibrated By"
            value={form.calibrated_by ?? ""}
            onChange={(e) => setForm({ ...form, calibrated_by: e.target.value })}
          />
          <TextInput
            label="Certificate Number"
            value={form.certificate_number ?? ""}
            onChange={(e) => setForm({ ...form, certificate_number: e.target.value })}
          />
          <TextInput
            label="Reference Standard"
            value={form.reference_standard ?? ""}
            onChange={(e) => setForm({ ...form, reference_standard: e.target.value })}
          />
          <Switch
            label="In Tolerance"
            checked={form.is_in_tolerance ?? true}
            onChange={(e) => setForm({ ...form, is_in_tolerance: e.currentTarget.checked })}
          />
          <Textarea
            label="Notes"
            value={form.notes ?? ""}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
          <Button
            tone="primary"
            onClick={() => createMut.mutate(form)}
            loading={createMut.isPending}
          >
            Save
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Contracts Tab
// ══════════════════════════════════════════════════════════
