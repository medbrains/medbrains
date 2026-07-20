// IPD LinenTab — split from housekeeping.tsx (pure move).

import {
  Drawer,
  Group,
  NumberInput,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import type {
  CreateLaundryBatchRequest,
  CreateLinenItemRequest,
  CreateLinenMovementRequest,
  LaundryBatch,
  LinenContaminationTypeValue,
  LinenItem,
  LinenMovement,
  LinenStatusType,
} from "@medbrains/types";
import {
  IconAlertTriangle,
  IconBiohazard,
  IconCheck,
  type IconDroplet,
  IconPlus,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components";
import { Badge, type BadgeTone, Button, IconButton } from "@/components/ui";
import { housekeepingService } from "@/services/housekeeping.service";
import { LINEN_TYPES } from "./shared";

const linenStatusColors: Record<LinenStatusType, BadgeTone> = {
  clean: "success",
  in_use: "primary",
  soiled: "warning",
  washing: "warning",
  condemned: "danger",
};

const CONTAMINATION_TYPES: LinenContaminationTypeValue[] = ["regular", "contaminated", "isolation"];

const contaminationMeta: Record<
  LinenContaminationTypeValue,
  { color: string; label: string; icon: typeof IconDroplet }
> = {
  regular: { color: "success", label: "Normal", icon: IconCheck },
  contaminated: { color: "danger", label: "Contaminated", icon: IconAlertTriangle },
  isolation: { color: "orange", label: "Isolation", icon: IconBiohazard },
};

const CONTAMINATION_BADGE_TONE: Record<string, BadgeTone> = {
  success: "success",
  danger: "danger",
  orange: "warning",
};

export function LinenTab({
  canList,
  canCreate,
  canListLaundry,
  canManageLaundry,
}: {
  canList: boolean;
  canCreate: boolean;
  canListLaundry: boolean;
  canManageLaundry: boolean;
}) {
  const qc = useQueryClient();
  const [linenDrawer, linenDrawerH] = useDisclosure(false);
  const [movementDrawer, movementDrawerH] = useDisclosure(false);
  const [batchDrawer, batchDrawerH] = useDisclosure(false);

  const [contaminationFilter, setContaminationFilter] = useState<string | null>(null);
  const [linenForm, setLinenForm] = useState<CreateLinenItemRequest>({ item_type: "bedsheet" });
  const [movementForm, setMovementForm] = useState<CreateLinenMovementRequest>({
    movement_type: "collect",
  });
  const [batchForm, setBatchForm] = useState<CreateLaundryBatchRequest>({ batch_number: "" });

  const linenQ = useQuery({
    queryKey: ["housekeeping", "linen"],
    queryFn: () => housekeepingService.listLinenItems(),
    enabled: canList,
  });
  const movementsQ = useQuery({
    queryKey: ["housekeeping", "movements"],
    queryFn: () => housekeepingService.listLinenMovements(),
    enabled: canList,
  });
  const batchesQ = useQuery({
    queryKey: ["housekeeping", "batches"],
    queryFn: () => housekeepingService.listLaundryBatches(),
    enabled: canListLaundry,
  });

  const createLinenM = useMutation({
    mutationFn: (data: CreateLinenItemRequest) => housekeepingService.createLinenItem(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["housekeeping", "linen"] });
      linenDrawerH.close();
      notifications.show({ title: "Item Added", message: "Linen item created", color: "success" });
    },
  });

  const createMovementM = useMutation({
    mutationFn: (data: CreateLinenMovementRequest) => housekeepingService.createLinenMovement(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["housekeeping", "movements"] });
      movementDrawerH.close();
    },
  });

  const createBatchM = useMutation({
    mutationFn: (data: CreateLaundryBatchRequest) => housekeepingService.createLaundryBatch(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["housekeeping", "batches"] });
      batchDrawerH.close();
    },
  });

  const completeBatchM = useMutation({
    mutationFn: (id: string) => housekeepingService.completeLaundryBatch(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["housekeeping", "batches"] });
      notifications.show({
        title: "Batch Complete",
        message: "Laundry batch completed",
        color: "success",
      });
    },
  });

  return (
    <Stack gap="lg">
      {/* Linen Items */}
      {canList && (
        <>
          <Group justify="space-between">
            <Text fw={600} size="lg">
              Linen Items
            </Text>
            {canCreate && (
              <Button
                tone="primary"
                leftSection={<IconPlus size={16} />}
                size="xs"
                onClick={linenDrawerH.open}
              >
                Add Item
              </Button>
            )}
          </Group>
          <DataTable
            data={linenQ.data ?? []}
            loading={linenQ.isLoading}
            rowKey={(r: LinenItem) => r.id}
            columns={[
              { key: "barcode", label: "Barcode", render: (r: LinenItem) => r.barcode ?? "-" },
              { key: "item_type", label: "Type", render: (r: LinenItem) => r.item_type },
              {
                key: "current_status",
                label: "Status",
                render: (r: LinenItem) => (
                  <Badge tone={linenStatusColors[r.current_status]}>{r.current_status}</Badge>
                ),
              },
              {
                key: "wash_count",
                label: "Washes",
                render: (r: LinenItem) => {
                  const pct = (r.wash_count / r.max_washes) * 100;
                  const tone: BadgeTone = pct > 80 ? "danger" : pct > 50 ? "warning" : "success";
                  return (
                    <Badge tone={tone}>
                      {r.wash_count}/{r.max_washes}
                    </Badge>
                  );
                },
              },
              {
                key: "commissioned_date",
                label: "Commissioned",
                render: (r: LinenItem) => r.commissioned_date ?? "-",
              },
            ]}
          />
        </>
      )}

      {/* Linen Movements */}
      {canList && (
        <>
          <Group justify="space-between">
            <Group gap="sm">
              <Text fw={600} size="lg">
                Linen Movements
              </Text>
              <Select
                placeholder="Filter by contamination"
                data={CONTAMINATION_TYPES.map((t) => ({
                  value: t,
                  label: contaminationMeta[t].label,
                }))}
                value={contaminationFilter}
                onChange={setContaminationFilter}
                clearable
                w={200}
                size="xs"
              />
              {contaminationFilter && (
                <Badge
                  tone={
                    CONTAMINATION_BADGE_TONE[
                      contaminationMeta[contaminationFilter as LinenContaminationTypeValue]?.color
                    ] ?? "neutral"
                  }
                  size="sm"
                >
                  {
                    (movementsQ.data ?? []).filter(
                      (m) => m.contamination_type === contaminationFilter,
                    ).length
                  }{" "}
                  record(s)
                </Badge>
              )}
            </Group>
            {canCreate && (
              <Button
                tone="secondary"
                leftSection={<IconPlus size={16} />}
                size="xs"
                onClick={movementDrawerH.open}
              >
                Record Movement
              </Button>
            )}
          </Group>
          <DataTable
            data={
              contaminationFilter
                ? (movementsQ.data ?? []).filter(
                    (m) => m.contamination_type === contaminationFilter,
                  )
                : (movementsQ.data ?? [])
            }
            loading={movementsQ.isLoading}
            rowKey={(r: LinenMovement) => r.id}
            columns={[
              {
                key: "contamination_indicator",
                label: "",
                render: (r: LinenMovement) => {
                  const meta =
                    contaminationMeta[r.contamination_type as LinenContaminationTypeValue];
                  if (!meta) return null;
                  const IconComp = meta.icon;
                  return (
                    <ThemeIcon color={meta.color} variant="light" size="sm" radius="xl">
                      <IconComp size={12} />
                    </ThemeIcon>
                  );
                },
              },
              {
                key: "movement_date",
                label: "Date",
                render: (r: LinenMovement) => new Date(r.movement_date).toLocaleString(),
              },
              {
                key: "movement_type",
                label: "Type",
                render: (r: LinenMovement) => <Badge variant="outline">{r.movement_type}</Badge>,
              },
              { key: "quantity", label: "Qty", render: (r: LinenMovement) => String(r.quantity) },
              {
                key: "weight_kg",
                label: "Weight (kg)",
                render: (r: LinenMovement) => (r.weight_kg != null ? String(r.weight_kg) : "-"),
              },
              {
                key: "contamination_type",
                label: "Contamination",
                render: (r: LinenMovement) => {
                  const meta =
                    contaminationMeta[r.contamination_type as LinenContaminationTypeValue];
                  return meta ? (
                    <Badge
                      tone={CONTAMINATION_BADGE_TONE[meta.color] ?? "neutral"}
                      variant="filled"
                      leftSection={(() => {
                        const I = meta.icon;
                        return <I size={12} />;
                      })()}
                    >
                      {meta.label}
                    </Badge>
                  ) : (
                    <Badge tone="neutral">{r.contamination_type}</Badge>
                  );
                },
              },
              {
                key: "recorded_by",
                label: "Recorded By",
                render: (r: LinenMovement) => r.recorded_by ?? "-",
              },
            ]}
          />
        </>
      )}

      {/* Laundry Batches */}
      {canListLaundry && (
        <>
          <Group justify="space-between">
            <Text fw={600} size="lg">
              Laundry Batches
            </Text>
            {canManageLaundry && (
              <Button
                tone="primary"
                leftSection={<IconPlus size={16} />}
                size="xs"
                onClick={batchDrawerH.open}
              >
                New Batch
              </Button>
            )}
          </Group>
          <DataTable
            data={batchesQ.data ?? []}
            loading={batchesQ.isLoading}
            rowKey={(r: LaundryBatch) => r.id}
            columns={[
              {
                key: "batch_number",
                label: "Batch #",
                render: (r: LaundryBatch) => r.batch_number,
              },
              {
                key: "items_count",
                label: "Items",
                render: (r: LaundryBatch) => String(r.items_count),
              },
              {
                key: "total_weight",
                label: "Weight (kg)",
                render: (r: LaundryBatch) =>
                  r.total_weight != null ? String(r.total_weight) : "-",
              },
              {
                key: "contamination_type",
                label: "Type",
                render: (r: LaundryBatch) => (
                  <Badge tone={r.contamination_type === "regular" ? "success" : "danger"}>
                    {r.contamination_type}
                  </Badge>
                ),
              },
              {
                key: "status",
                label: "Status",
                render: (r: LaundryBatch) => (
                  <Badge tone={r.status === "completed" ? "success" : "primary"}>{r.status}</Badge>
                ),
              },
              ...(canManageLaundry
                ? [
                    {
                      key: "actions" as const,
                      label: "Actions",
                      render: (r: LaundryBatch) =>
                        r.status !== "completed" ? (
                          <Tooltip label="Complete Batch">
                            <IconButton
                              tone="success"
                              onClick={() => completeBatchM.mutate(r.id)}
                              aria-label="Confirm"
                            >
                              <IconCheck size={16} />
                            </IconButton>
                          </Tooltip>
                        ) : null,
                    },
                  ]
                : []),
            ]}
          />
        </>
      )}

      {/* Drawers */}
      <Drawer
        opened={linenDrawer}
        onClose={linenDrawerH.close}
        title="Add Linen Item"
        position="right"
        size="xl"
      >
        <Stack>
          <Select
            label="Item Type"
            data={LINEN_TYPES}
            value={linenForm.item_type}
            onChange={(v) => setLinenForm({ ...linenForm, item_type: v ?? "bedsheet" })}
          />
          <TextInput
            label="Barcode"
            value={linenForm.barcode ?? ""}
            onChange={(e) => setLinenForm({ ...linenForm, barcode: e.target.value })}
          />
          <NumberInput
            label="Max Washes"
            value={linenForm.max_washes ?? 150}
            onChange={(v) => setLinenForm({ ...linenForm, max_washes: Number(v) })}
            min={1}
          />
          <TextInput
            label="Commissioned Date"
            type="date"
            value={linenForm.commissioned_date ?? ""}
            onChange={(e) => setLinenForm({ ...linenForm, commissioned_date: e.target.value })}
          />
          <Textarea
            label="Notes"
            value={linenForm.notes ?? ""}
            onChange={(e) => setLinenForm({ ...linenForm, notes: e.target.value })}
          />
          <Button
            tone="primary"
            onClick={() => createLinenM.mutate(linenForm)}
            loading={createLinenM.isPending}
          >
            Add Item
          </Button>
        </Stack>
      </Drawer>

      <Drawer
        opened={movementDrawer}
        onClose={movementDrawerH.close}
        title="Record Linen Movement"
        position="right"
        size="xl"
      >
        <Stack>
          <Select
            label="Movement Type"
            data={["collect", "wash", "distribute", "return"]}
            value={movementForm.movement_type}
            onChange={(v) => setMovementForm({ ...movementForm, movement_type: v ?? "collect" })}
          />
          <NumberInput
            label="Quantity"
            value={movementForm.quantity ?? 1}
            onChange={(v) => setMovementForm({ ...movementForm, quantity: Number(v) })}
            min={1}
          />
          <NumberInput
            label="Weight (kg)"
            value={movementForm.weight_kg ?? undefined}
            onChange={(v) =>
              setMovementForm({ ...movementForm, weight_kg: v ? Number(v) : undefined })
            }
            decimalScale={2}
          />
          <Select
            label="Contamination"
            data={["regular", "contaminated", "isolation"]}
            value={movementForm.contamination_type ?? "regular"}
            onChange={(v) =>
              setMovementForm({ ...movementForm, contamination_type: v ?? "regular" })
            }
          />
          <TextInput
            label="Recorded By"
            value={movementForm.recorded_by ?? ""}
            onChange={(e) => setMovementForm({ ...movementForm, recorded_by: e.target.value })}
          />
          <Button
            tone="primary"
            onClick={() => createMovementM.mutate(movementForm)}
            loading={createMovementM.isPending}
          >
            Record
          </Button>
        </Stack>
      </Drawer>

      <Drawer
        opened={batchDrawer}
        onClose={batchDrawerH.close}
        title="New Laundry Batch"
        position="right"
        size="xl"
      >
        <Stack>
          <TextInput
            label="Batch Number"
            value={batchForm.batch_number}
            onChange={(e) => setBatchForm({ ...batchForm, batch_number: e.target.value })}
            required
          />
          <NumberInput
            label="Items Count"
            value={batchForm.items_count ?? 0}
            onChange={(v) => setBatchForm({ ...batchForm, items_count: Number(v) })}
            min={0}
          />
          <NumberInput
            label="Total Weight (kg)"
            value={batchForm.total_weight ?? undefined}
            onChange={(v) =>
              setBatchForm({ ...batchForm, total_weight: v ? Number(v) : undefined })
            }
            decimalScale={2}
          />
          <Select
            label="Contamination"
            data={["regular", "contaminated", "isolation"]}
            value={batchForm.contamination_type ?? "regular"}
            onChange={(v) => setBatchForm({ ...batchForm, contamination_type: v ?? "regular" })}
          />
          <TextInput
            label="Wash Formula"
            value={batchForm.wash_formula ?? ""}
            onChange={(e) => setBatchForm({ ...batchForm, wash_formula: e.target.value })}
          />
          <NumberInput
            label="Temperature (°C)"
            value={batchForm.wash_temperature ?? undefined}
            onChange={(v) =>
              setBatchForm({ ...batchForm, wash_temperature: v ? Number(v) : undefined })
            }
          />
          <NumberInput
            label="Cycle (min)"
            value={batchForm.cycle_minutes ?? undefined}
            onChange={(v) =>
              setBatchForm({ ...batchForm, cycle_minutes: v ? Number(v) : undefined })
            }
          />
          <TextInput
            label="Operator"
            value={batchForm.operator_name ?? ""}
            onChange={(e) => setBatchForm({ ...batchForm, operator_name: e.target.value })}
          />
          <Button
            tone="primary"
            onClick={() => createBatchM.mutate(batchForm)}
            loading={createBatchM.isPending}
          >
            Start Batch
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Tab 4: Par Levels & Audit
// ══════════════════════════════════════════════════════════
