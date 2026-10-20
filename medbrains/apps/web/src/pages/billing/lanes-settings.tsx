import { Group, Stack, Text, Title } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import type { BillingEntity, BillingLane } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconEdit, IconPlus } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Badge, Button, Card, IconButton, Table } from "@/components/ui";
import { billingService } from "@/services/billing.service";
import { BillingEntityModal } from "./billing-entity-modal";
import { BillingLaneModal } from "./billing-lane-modal";
import { LANE_LABELS } from "./lane-labels";

const MODE_LABEL = { individual: "On its own", together: "With the visit" } as const;
const CHARGE_AT_LABEL = { checkin: "At check-in", complete: "At completion" } as const;

function EntitiesCard({ entities }: { entities: BillingEntity[] }) {
  const [editing, setEditing] = useState<BillingEntity | null>(null);
  const [adding, setAdding] = useState(false);
  return (
    <Card withBorder>
      <Stack gap="sm">
        <Group justify="space-between">
          <Title order={6}>Billing entities</Title>
          <Button
            size="xs"
            tone="secondary"
            leftSection={<IconPlus size={14} />}
            onClick={() => setAdding(true)}
          >
            Add entity
          </Button>
        </Group>
        <Text size="sm" c="dimmed">
          Each GSTIN keeps its own receipt series, numbered per financial year. A pharmacy with its
          own GSTIN and drug licence is an entity of its own.
        </Text>
        <Table data-testid="billing-entities">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Entity</Table.Th>
              <Table.Th>GSTIN</Table.Th>
              <Table.Th>Receipts</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {entities.map((e) => (
              <Table.Tr key={e.id}>
                <Table.Td>
                  <Group gap="xs">
                    <Text size="sm" fw={600}>
                      {e.name}
                    </Text>
                    {e.is_default && <Badge tone="info">Default</Badge>}
                    {!e.is_active && <Badge tone="neutral">Inactive</Badge>}
                  </Group>
                </Table.Td>
                <Table.Td ff="monospace">{e.gstin ?? "Not set"}</Table.Td>
                <Table.Td ff="monospace">{e.receipt_prefix}/YY-YY/000001</Table.Td>
                <Table.Td>
                  <IconButton aria-label={`Edit ${e.name}`} onClick={() => setEditing(e)}>
                    <IconEdit size={16} />
                  </IconButton>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Stack>
      <BillingEntityModal
        entity={editing}
        opened={adding || editing !== null}
        onClose={() => {
          setAdding(false);
          setEditing(null);
        }}
      />
    </Card>
  );
}

function LanesCard({ lanes, entities }: { lanes: BillingLane[]; entities: BillingEntity[] }) {
  const [editing, setEditing] = useState<BillingLane | null>(null);
  return (
    <Card withBorder>
      <Stack gap="sm">
        <Title order={6}>Department lanes</Title>
        <Text size="sm" c="dimmed">
          Each department's desk collects its own lane. A lane billed on its own gets a bill of its
          own per visit; the rest share the visit's bill.
        </Text>
        <Table data-testid="billing-lanes">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Lane</Table.Th>
              <Table.Th>Billed by</Table.Th>
              <Table.Th>Bills</Table.Th>
              <Table.Th>Fee</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {lanes.map((l) => (
              <Table.Tr key={l.lane} data-testid={`lane-${l.lane}`}>
                <Table.Td>
                  <Text size="sm" fw={600}>
                    {LANE_LABELS[l.lane]}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {l.department_name ?? "Visit's department"}
                  </Text>
                </Table.Td>
                <Table.Td>{l.entity_name ?? "—"}</Table.Td>
                <Table.Td>{MODE_LABEL[l.default_mode]}</Table.Td>
                <Table.Td>
                  {l.lane === "registration" && (l.fee_amount ? `₹${l.fee_amount}` : "None")}
                  {(l.lane === "registration" || l.lane === "opd") &&
                    ` · ${CHARGE_AT_LABEL[l.charge_at]}`}
                </Table.Td>
                <Table.Td>
                  <IconButton
                    aria-label={`Edit ${LANE_LABELS[l.lane]} lane`}
                    onClick={() => setEditing(l)}
                  >
                    <IconEdit size={16} />
                  </IconButton>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Stack>
      <BillingLaneModal lane={editing} entities={entities} onClose={() => setEditing(null)} />
    </Card>
  );
}

/** Settings → billing entities and lanes (#4885); only for `billing.lanes.manage`. */
export function BillingLanesSettings() {
  const canManage = useHasPermission(P.BILLING.LANES_MANAGE);
  const entities = useQuery({
    queryKey: ["billing-entities"],
    queryFn: billingService.listBillingEntities,
    enabled: canManage,
  });
  const lanes = useQuery({
    queryKey: ["billing-lanes"],
    queryFn: billingService.listBillingLanes,
    enabled: canManage,
  });
  if (!canManage) return null;
  if (entities.isError || lanes.isError) {
    return (
      <Alert tone="danger" title="Billing entities and lanes could not be loaded">
        Nothing here has changed; reload to try again.
      </Alert>
    );
  }
  if (!entities.data || !lanes.data) {
    return (
      <Text size="sm" c="dimmed">
        Loading billing entities and lanes…
      </Text>
    );
  }
  return (
    <Stack gap="md">
      <EntitiesCard entities={entities.data} />
      <LanesCard lanes={lanes.data} entities={entities.data} />
    </Stack>
  );
}
