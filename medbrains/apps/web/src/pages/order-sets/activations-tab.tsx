// Order-sets ActivationsTab — split from order-sets.tsx (pure move).

import { Card, Drawer, Group, Stack, Text, Tooltip } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import type { OrderSetActivation } from "@medbrains/types";
import { IconListDetails } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components";
import type { Column } from "@/components/DataTable";
import { PatientNameCell } from "@/components/PatientNameCell";
import { Badge, IconButton } from "@/components/ui";
import { orderSetsService } from "@/services/order-sets.service";
import { statusColorTone } from "./shared";

export function ActivationsTab() {
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailDrawer, { open: openDetail, close: closeDetail }] = useDisclosure(false);

  const { data: activations = [], isLoading } = useQuery({
    queryKey: ["order-set-activations"],
    queryFn: () => orderSetsService.listOrderSetActivations(),
  });

  const { data: detail } = useQuery({
    queryKey: ["order-set-activation-detail", detailId],
    queryFn: () => {
      if (!detailId) throw new Error("Activation not selected");
      return orderSetsService.getOrderSetActivation(detailId);
    },
    enabled: !!detailId,
  });

  const columns: Column<OrderSetActivation>[] = [
    {
      key: "template_id",
      label: "Template",
      render: (r) => <Text size="sm">{r.template_id.slice(0, 8)}...</Text>,
    },
    {
      key: "version",
      label: "Version",
      render: (r) => <Text size="sm">v{r.template_version}</Text>,
    },
    {
      key: "patient_id",
      label: "Patient",
      render: (r) => <PatientNameCell patientId={r.patient_id} showUhid={false} />,
    },
    {
      key: "items",
      label: "Items",
      render: (r) => (
        <Text size="sm">
          {r.selected_items}/{r.total_items} selected
        </Text>
      ),
    },
    {
      key: "diagnosis",
      label: "Diagnosis",
      render: (r) => <Text size="sm">{r.diagnosis_icd ?? "—"}</Text>,
    },
    {
      key: "created_at",
      label: "Activated",
      render: (r) => <Text size="sm">{new Date(r.created_at).toLocaleDateString()}</Text>,
    },
    {
      key: "actions",
      label: "",
      render: (r) => (
        <Tooltip label="View Details">
          <IconButton
            size="sm"
            tone="default"
            onClick={() => {
              setDetailId(r.id);
              openDetail();
            }}
            aria-label="List Details"
          >
            <IconListDetails size={14} />
          </IconButton>
        </Tooltip>
      ),
    },
  ];

  return (
    <>
      <DataTable columns={columns} data={activations} loading={isLoading} rowKey={(r) => r.id} />

      <Drawer
        opened={detailDrawer}
        onClose={closeDetail}
        title="Activation Details"
        position="right"
        size="lg"
      >
        {detail && (
          <Stack>
            <Group>
              <Text size="sm" fw={500}>
                Version:
              </Text>
              <Text size="sm">v{detail.activation.template_version}</Text>
            </Group>
            <Group>
              <Text size="sm" fw={500}>
                Items:
              </Text>
              <Text size="sm">
                {detail.activation.selected_items}/{detail.activation.total_items} selected
              </Text>
            </Group>
            {detail.activation.notes && (
              <Group>
                <Text size="sm" fw={500}>
                  Notes:
                </Text>
                <Text size="sm">{detail.activation.notes}</Text>
              </Group>
            )}
            <Text size="sm" fw={600} mt="md">
              Items:
            </Text>
            {detail.items.map((item) => (
              <Card key={item.id} withBorder p="xs">
                <Group justify="space-between">
                  <Group>
                    <Badge tone={statusColorTone(item.item_type)} size="sm">
                      {item.item_type}
                    </Badge>
                    <Text size="sm">{item.was_selected ? "Created" : "Skipped"}</Text>
                  </Group>
                  {item.skip_reason && (
                    <Text size="xs" c="dimmed">
                      {item.skip_reason}
                    </Text>
                  )}
                </Group>
              </Card>
            ))}
          </Stack>
        )}
      </Drawer>
    </>
  );
}
