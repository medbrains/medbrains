// Fire mock drills: the drill register, its print menu and the record-drill drawer.

import { Group, NumberInput, Select, Stack, Text, Textarea } from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import type { CreateFmsFireDrillRequest, FmsFireDrill } from "@medbrains/types";
import { IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components";
import type { Column } from "@/components/DataTable";
import { printColumn } from "@/components/Print/printColumn";
import { Badge, Button, Modal } from "@/components/ui";
import { facilitiesService } from "@/services/facilities.service";

const DRILL_TYPES = [
  { value: "fire", label: "Fire" },
  { value: "code_red", label: "Code Red" },
  { value: "evacuation", label: "Evacuation" },
  { value: "chemical_spill", label: "Chemical Spill" },
  { value: "bomb_threat", label: "Bomb Threat" },
];

export function FireDrillsSection({ canManage }: { canManage: boolean }) {
  const [drillOpen, { open: openDrill, close: closeDrill }] = useDisclosure(false);
  const qc = useQueryClient();
  const drills = useQuery({
    queryKey: ["fms-fire-drills"],
    queryFn: () => facilitiesService.listFmsFireDrills(),
  });
  const [drillForm, setDrillForm] = useState<CreateFmsFireDrillRequest>({
    drill_type: "fire",
    drill_date: new Date().toISOString().slice(0, 10),
  });
  const createDrill = useMutation({
    mutationFn: () => facilitiesService.createFmsFireDrill(drillForm),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["fms-fire-drills"] });
      closeDrill();
      notifications.show({ title: "Success", message: "Drill recorded" });
    },
  });

  const drillCols: Column<FmsFireDrill>[] = [
    {
      key: "drill_type",
      label: "Type",
      render: (r) => <Badge tone="danger">{r.drill_type.replace(/_/g, " ")}</Badge>,
    },
    { key: "drill_date", label: "Date", render: (r) => <Text size="sm">{r.drill_date}</Text> },
    {
      key: "duration_minutes",
      label: "Duration (min)",
      render: (r) => <Text size="sm">{r.duration_minutes ?? "—"}</Text>,
    },
    {
      key: "participants_count",
      label: "Participants",
      render: (r) => <Text size="sm">{r.participants_count ?? "—"}</Text>,
    },
    {
      key: "evacuation_time_seconds",
      label: "Evac Time (s)",
      render: (r) => <Text size="sm">{r.evacuation_time_seconds ?? "—"}</Text>,
    },
    {
      key: "next_drill_due",
      label: "Next Due",
      render: (r) => (
        <Text
          size="sm"
          c={r.next_drill_due && new Date(r.next_drill_due) < new Date() ? "danger" : undefined}
        >
          {r.next_drill_due ?? "—"}
        </Text>
      ),
    },
    printColumn<FmsFireDrill>("fire_drill", { label: (r) => r.drill_date }),
  ];

  return (
    <>
      <Group justify="space-between" mt="lg">
        <Text fw={600} size="lg">
          Mock Drills
        </Text>
        {canManage && (
          <Button tone="subtle-danger" leftSection={<IconPlus size={16} />} onClick={openDrill}>
            Record Drill
          </Button>
        )}
      </Group>
      <DataTable
        columns={drillCols}
        data={drills.data ?? []}
        loading={drills.isLoading}
        rowKey={(r) => r.id}
      />

      <Modal opened={drillOpen} onClose={closeDrill} title="Record Fire Drill" fullScreen>
        <Stack>
          <Select
            label="Type"
            data={DRILL_TYPES}
            value={drillForm.drill_type}
            onChange={(v) =>
              setDrillForm({
                ...drillForm,
                drill_type: v as CreateFmsFireDrillRequest["drill_type"],
              })
            }
          />
          <DateInput
            label="Drill Date"
            value={drillForm.drill_date ? new Date(drillForm.drill_date) : null}
            onChange={(v) =>
              setDrillForm({
                ...drillForm,
                drill_date: v ? new Date(v).toISOString().slice(0, 10) : "",
              })
            }
          />
          <NumberInput
            label="Duration (minutes)"
            value={drillForm.duration_minutes ?? ""}
            onChange={(v) =>
              setDrillForm({
                ...drillForm,
                duration_minutes: typeof v === "number" ? v : undefined,
              })
            }
          />
          <NumberInput
            label="Participants"
            value={drillForm.participants_count ?? ""}
            onChange={(v) =>
              setDrillForm({
                ...drillForm,
                participants_count: typeof v === "number" ? v : undefined,
              })
            }
          />
          <NumberInput
            label="Evacuation Time (seconds)"
            value={drillForm.evacuation_time_seconds ?? ""}
            onChange={(v) =>
              setDrillForm({
                ...drillForm,
                evacuation_time_seconds: typeof v === "number" ? v : undefined,
              })
            }
          />
          <Textarea
            label="Scenario"
            value={drillForm.scenario_description ?? ""}
            onChange={(e) =>
              setDrillForm({ ...drillForm, scenario_description: e.currentTarget.value })
            }
          />
          <Textarea
            label="Findings"
            value={drillForm.findings ?? ""}
            onChange={(e) => setDrillForm({ ...drillForm, findings: e.currentTarget.value })}
          />
          <Textarea
            label="Improvement Actions"
            value={drillForm.improvement_actions ?? ""}
            onChange={(e) =>
              setDrillForm({ ...drillForm, improvement_actions: e.currentTarget.value })
            }
          />
          <Button
            tone="primary"
            onClick={() => createDrill.mutate()}
            loading={createDrill.isPending}
          >
            Save
          </Button>
        </Stack>
      </Modal>
    </>
  );
}
