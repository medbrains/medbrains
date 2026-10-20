import { Group, Stack, Text } from "@mantine/core";
import type { DueBill } from "@medbrains/types";
import { IconCash } from "@tabler/icons-react";
import { Alert, Button, Card, Table } from "@/components/ui";
import { billsDue, rupees } from "./collect-math";
import { useCollect } from "./collect-store";
import { LANE_LABEL, useCanCollect, useDues } from "./use-dues";

interface DepartmentDue {
  key: string;
  label: string;
  bills: DueBill[];
  canCollect: boolean;
}

/** The open bills grouped by the departments that collect them. */
export function groupByDepartment(bills: DueBill[]): DepartmentDue[] {
  const groups = new Map<string, DepartmentDue>();
  for (const bill of bills) {
    const key = [...bill.lanes].sort().join("+");
    const group = groups.get(key) ?? {
      key,
      label: bill.lanes.map((l) => LANE_LABEL[l] ?? l).join(" + "),
      bills: [],
      canCollect: true,
    };
    group.bills.push(bill);
    group.canCollect = group.canCollect && bill.can_collect;
    groups.set(key, group);
  }
  return [...groups.values()];
}

/** A patient's dues, department by department, each collectable where this desk may. */
export function DuesByDepartment({ patientId }: { patientId: string }) {
  const canCollect = useCanCollect();
  const dues = useDues(patientId);
  const open = useCollect((s) => s.open);
  if (!canCollect) return null;
  if (dues.isError) {
    return (
      <Alert tone="danger" title="Dues could not be read">
        {dues.error.message}
      </Alert>
    );
  }
  if (!dues.data || dues.data.amounts_hidden || dues.data.bills.length === 0) return null;
  const groups = groupByDepartment(dues.data.bills);
  const collectable = dues.data.bills.filter((b) => b.can_collect);
  return (
    <Card withBorder>
      <Stack gap="sm">
        <Group justify="space-between">
          <Text fw={700}>Due by department</Text>
          {collectable.length > 0 && (
            <Button
              tone="primary"
              size="xs"
              leftSection={<IconCash size={14} />}
              onClick={() => open({ patientId })}
            >
              Collect all {rupees(billsDue(collectable))}
            </Button>
          )}
        </Group>
        <Table aria-label="Due by department">
          <Table.Tbody>
            {groups.map((g) => (
              <Table.Tr key={g.key} data-testid="row-department-due">
                <Table.Td>{g.label}</Table.Td>
                <Table.Td ta="right" ff="monospace">
                  {rupees(billsDue(g.bills))}
                </Table.Td>
                <Table.Td ta="right">
                  {g.canCollect ? (
                    <Button
                      tone="secondary"
                      size="xs"
                      onClick={() =>
                        open({
                          patientId,
                          invoiceIds: g.bills.map((b) => b.invoice_id),
                          focusLabel: g.label,
                        })
                      }
                    >
                      Collect
                    </Button>
                  ) : (
                    <Text size="xs" c="dimmed">
                      Another desk collects
                    </Text>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Stack>
    </Card>
  );
}
