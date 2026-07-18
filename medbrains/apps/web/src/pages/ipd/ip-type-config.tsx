// IPD IpTypeConfigSection — split from ipd.tsx (pure move).

import { Badge, Button, IconButton, Table, toast } from "@/components/ui";
import { ipdService } from "@/services/ipd.service";
import { Card, Checkbox, Group, NumberInput, Stack, Text } from "@mantine/core";
import type { IpTypeConfiguration } from "@medbrains/types";
import { IconPencil } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

export function IpTypeConfigSection() {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editThreshold, setEditThreshold] = useState<number | string>("");
  const [editAutoBilling, setEditAutoBilling] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["ipd-ip-types"],
    queryFn: () => ipdService.listIpTypes(),
    enabled: expanded,
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      ...rest
    }: {
      id: string;
      billing_alert_threshold?: number;
      auto_billing_enabled?: boolean;
    }) => ipdService.updateIpType(id, rest),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ipd-ip-types"] });
      toast.success("IP type configuration updated", { title: "Updated" });
      setEditingId(null);
    },
  });

  const configs = (data ?? []) as IpTypeConfiguration[];

  return (
    <Card withBorder mt="md">
      <Group
        justify="space-between"
        p="sm"
        style={{ cursor: "pointer" }}
        onClick={() => setExpanded((v) => !v)}
      >
        <Text fw={600}>IP Type Configurations</Text>
        <Badge>{expanded ? "Hide" : "Show"}</Badge>
      </Group>
      {expanded && (
        <Stack p="sm" pt={0}>
          {isLoading ? (
            <Text c="dimmed">Loading...</Text>
          ) : configs.length === 0 ? (
            <Text c="dimmed" size="sm">
              No IP type configurations found.
            </Text>
          ) : (
            <Table striped>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>IP Type</Table.Th>
                  <Table.Th>Label</Table.Th>
                  <Table.Th>Daily Rate</Table.Th>
                  <Table.Th>Nursing Charge</Table.Th>
                  <Table.Th>Deposit</Table.Th>
                  <Table.Th>Billing Threshold</Table.Th>
                  <Table.Th>Auto-Billing</Table.Th>
                  <Table.Th>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {configs.map((c) => (
                  <Table.Tr key={c.id}>
                    <Table.Td>
                      <Badge size="sm">{c.ip_type}</Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{c.label}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{c.daily_rate}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{c.nursing_charge}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{c.deposit_required}</Text>
                    </Table.Td>
                    <Table.Td>
                      {editingId === c.id ? (
                        <NumberInput
                          size="xs"
                          value={editThreshold}
                          onChange={setEditThreshold}
                          w={120}
                        />
                      ) : (
                        <Text size="sm">{c.billing_alert_threshold ?? "—"}</Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      {editingId === c.id ? (
                        <Checkbox
                          size="xs"
                          checked={editAutoBilling}
                          onChange={(e) => setEditAutoBilling(e.currentTarget.checked)}
                        />
                      ) : (
                        <Badge size="xs" tone={c.auto_billing_enabled ? "success" : "neutral"}>
                          {c.auto_billing_enabled ? "On" : "Off"}
                        </Badge>
                      )}
                    </Table.Td>
                    <Table.Td>
                      {editingId === c.id ? (
                        <Group gap={4}>
                          <Button
                            tone="primary"
                            size="xs"
                            onClick={() =>
                              updateMutation.mutate({
                                id: c.id,
                                billing_alert_threshold: editThreshold
                                  ? Number(editThreshold)
                                  : undefined,
                                auto_billing_enabled: editAutoBilling,
                              })
                            }
                            loading={updateMutation.isPending}
                          >
                            Save
                          </Button>
                          <Button tone="ghost" size="xs" onClick={() => setEditingId(null)}>
                            Cancel
                          </Button>
                        </Group>
                      ) : (
                        <IconButton
                          aria-label="Edit"
                          onClick={() => {
                            setEditingId(c.id);
                            setEditThreshold(c.billing_alert_threshold ?? "");
                            setEditAutoBilling(c.auto_billing_enabled);
                          }}
                        >
                          <IconPencil size={14} />
                        </IconButton>
                      )}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Stack>
      )}
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════
// ── Bed Dashboard Tab ────────────────────────────────────
// ═══════════════════════════════════════════════════════════
