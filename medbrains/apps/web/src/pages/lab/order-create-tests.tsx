import { Group, Text, VisuallyHidden } from "@mantine/core";
import { IconX } from "@tabler/icons-react";
import { IconButton, Table } from "@/components/ui";
import { type CounterTest, counterTotal, formatRupees } from "./order-create.form";

interface SelectedTestsProps {
  tests: CounterTest[];
  onRemove: (id: string) => void;
}

/** The tests on this order, with the price each adds and the total. */
export function SelectedTests({ tests, onRemove }: SelectedTestsProps) {
  if (tests.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        No tests yet — search above and pick each one.
      </Text>
    );
  }
  return (
    <Table aria-label="Tests on this order">
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Test</Table.Th>
          <Table.Th>Code</Table.Th>
          <Table.Th ta="right">Price</Table.Th>
          <Table.Th>
            <VisuallyHidden>Remove</VisuallyHidden>
          </Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {tests.map((t) => (
          <Table.Tr key={t.id}>
            <Table.Td>{t.name}</Table.Td>
            <Table.Td>{t.code}</Table.Td>
            <Table.Td ta="right">{formatRupees(t.price)}</Table.Td>
            <Table.Td>
              <IconButton aria-label={`Remove ${t.name}`} onClick={() => onRemove(t.id)}>
                <IconX size={16} />
              </IconButton>
            </Table.Td>
          </Table.Tr>
        ))}
        <Table.Tr>
          <Table.Td colSpan={2}>
            <Group gap={4}>
              <Text fw={600}>Total</Text>
              <Text size="xs" c="dimmed">
                ({tests.length} {tests.length === 1 ? "test" : "tests"})
              </Text>
            </Group>
          </Table.Td>
          <Table.Td ta="right" fw={600}>
            {formatRupees(counterTotal(tests))}
          </Table.Td>
          <Table.Td />
        </Table.Tr>
      </Table.Tbody>
    </Table>
  );
}
