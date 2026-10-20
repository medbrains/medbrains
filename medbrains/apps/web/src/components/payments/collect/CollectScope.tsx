import { Group, Stack, Text } from "@mantine/core";
import type { DueBill } from "@medbrains/types";
import { IconLock } from "@tabler/icons-react";
import { SegmentedControl, Table } from "@/components/ui";
import { billsDue, type CollectScopeChoice, rupees } from "./collect-math";
import { LANE_LABEL } from "./use-dues";

interface CollectScopeProps {
  focusLabel: string;
  focusBills: DueBill[];
  allBills: DueBill[];
  /** "All dues" is offered: a central cashier, and there is more than this desk's. */
  canChooseAll: boolean;
  scope: CollectScopeChoice;
  onScope: (scope: CollectScopeChoice) => void;
  disabled: boolean;
}

/** This desk's dues or all of them, and the bills behind the figure. */
export function CollectScope({
  focusLabel,
  focusBills,
  allBills,
  canChooseAll,
  scope,
  onScope,
  disabled,
}: CollectScopeProps) {
  const shown = scope === "all" ? allBills : focusBills;
  return (
    <Stack gap="xs">
      {canChooseAll && (
        <SegmentedControl
          aria-label="What to collect"
          fullWidth
          value={scope}
          onChange={(v) => onScope(v as CollectScopeChoice)}
          disabled={disabled}
          data={[
            { value: "focus", label: `${focusLabel} ${rupees(billsDue(focusBills))}` },
            { value: "all", label: `All dues ${rupees(billsDue(allBills))}` },
          ]}
        />
      )}
      <Table aria-label="Bills in this collection">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Bill</Table.Th>
            <Table.Th>Department</Table.Th>
            <Table.Th ta="right">Due</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {shown.map((bill) => (
            <Table.Tr key={bill.invoice_id} data-testid="row-collect-bill">
              <Table.Td>
                <Text size="sm" ff="monospace">
                  {bill.invoice_number}
                </Text>
                {bill.entity_name && (
                  <Text size="xs" c="dimmed">
                    {bill.entity_name}
                  </Text>
                )}
              </Table.Td>
              <Table.Td>
                <Group gap={4} wrap="nowrap">
                  {!bill.can_collect && <IconLock size={14} aria-hidden="true" />}
                  <Text size="sm">
                    {bill.lanes.map((lane) => LANE_LABEL[lane] ?? lane).join(" + ")}
                    {!bill.can_collect && " · another desk collects"}
                  </Text>
                </Group>
              </Table.Td>
              <Table.Td ta="right" ff="monospace">
                {rupees(Number(bill.balance))}
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Stack>
  );
}
