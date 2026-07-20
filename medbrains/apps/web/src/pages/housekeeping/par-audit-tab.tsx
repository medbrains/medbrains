// IPD ParAuditTab — split from housekeeping.tsx (pure move).

import { Drawer, Group, NumberInput, Select, Stack, Text } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import type { LinenCondemnation, LinenParLevel, UpsertParLevelRequest } from "@medbrains/types";
import { IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components";
import type { BadgeTone } from "@/components/ui";
import { Badge, Button } from "@/components/ui";
import { housekeepingService } from "@/services/housekeeping.service";
import { LINEN_TYPES } from "./shared";

export function ParAuditTab({ canList, canManage }: { canList: boolean; canManage: boolean }) {
  const qc = useQueryClient();
  const [parDrawer, parDrawerH] = useDisclosure(false);
  const [parForm, setParForm] = useState<UpsertParLevelRequest>({
    item_type: "bedsheet",
    par_level: 10,
  });

  const parQ = useQuery({
    queryKey: ["housekeeping", "par-levels"],
    queryFn: () => housekeepingService.listParLevels(),
    enabled: canList,
  });
  const condemnQ = useQuery({
    queryKey: ["housekeeping", "condemnations"],
    queryFn: () => housekeepingService.listLinenCondemnations(),
    enabled: canList,
  });

  const upsertParM = useMutation({
    mutationFn: (data: UpsertParLevelRequest) => housekeepingService.upsertParLevel(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["housekeeping", "par-levels"] });
      parDrawerH.close();
      notifications.show({
        title: "Par Level Updated",
        message: "Par level saved",
        color: "success",
      });
    },
  });

  return (
    <Stack gap="lg">
      {/* Par Levels */}
      <Group justify="space-between">
        <Text fw={600} size="lg">
          Linen Par Levels
        </Text>
        {canManage && (
          <Button
            tone="primary"
            leftSection={<IconPlus size={16} />}
            size="xs"
            onClick={parDrawerH.open}
          >
            Set Par Level
          </Button>
        )}
      </Group>
      <DataTable
        data={parQ.data ?? []}
        loading={parQ.isLoading}
        rowKey={(r: LinenParLevel) => r.id}
        columns={[
          { key: "item_type", label: "Item Type", render: (r: LinenParLevel) => r.item_type },
          {
            key: "par_level",
            label: "Par Level",
            render: (r: LinenParLevel) => String(r.par_level),
          },
          {
            key: "current_stock",
            label: "Current Stock",
            render: (r: LinenParLevel) => {
              const tone: BadgeTone =
                r.current_stock <= r.reorder_level
                  ? "danger"
                  : r.current_stock < r.par_level
                    ? "warning"
                    : "success";
              return <Badge tone={tone}>{r.current_stock}</Badge>;
            },
          },
          {
            key: "reorder_level",
            label: "Reorder Level",
            render: (r: LinenParLevel) => String(r.reorder_level),
          },
        ]}
      />

      {/* Condemnations */}
      <Text fw={600} size="lg">
        Linen Condemnations
      </Text>
      <DataTable
        data={condemnQ.data ?? []}
        loading={condemnQ.isLoading}
        rowKey={(r: LinenCondemnation) => r.id}
        columns={[
          {
            key: "condemned_date",
            label: "Date",
            render: (r: LinenCondemnation) => r.condemned_date,
          },
          { key: "reason", label: "Reason", render: (r: LinenCondemnation) => r.reason },
          {
            key: "wash_count_at_condemn",
            label: "Wash Count",
            render: (r: LinenCondemnation) =>
              r.wash_count_at_condemn != null ? String(r.wash_count_at_condemn) : "-",
          },
          {
            key: "replacement_requested",
            label: "Replacement",
            render: (r: LinenCondemnation) =>
              r.replacement_requested ? (
                <Badge tone="primary">Requested</Badge>
              ) : (
                <Badge tone="neutral">No</Badge>
              ),
          },
        ]}
      />

      {/* Par Level Drawer */}
      <Drawer
        opened={parDrawer}
        onClose={parDrawerH.close}
        title="Set Par Level"
        position="right"
        size="xl"
      >
        <Stack>
          <Select
            label="Item Type"
            data={LINEN_TYPES}
            value={parForm.item_type}
            onChange={(v) => setParForm({ ...parForm, item_type: v ?? "bedsheet" })}
          />
          <NumberInput
            label="Par Level"
            value={parForm.par_level}
            onChange={(v) => setParForm({ ...parForm, par_level: Number(v) })}
            min={0}
          />
          <NumberInput
            label="Current Stock"
            value={parForm.current_stock ?? 0}
            onChange={(v) => setParForm({ ...parForm, current_stock: Number(v) })}
            min={0}
          />
          <NumberInput
            label="Reorder Level"
            value={parForm.reorder_level ?? 0}
            onChange={(v) => setParForm({ ...parForm, reorder_level: Number(v) })}
            min={0}
          />
          <Button
            tone="primary"
            onClick={() => upsertParM.mutate(parForm)}
            loading={upsertParM.isPending}
          >
            Save
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Tab 5: Biomedical Waste (BMW)
// ══════════════════════════════════════════════════════════
