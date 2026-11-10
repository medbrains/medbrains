/** Each item of a change set, old value beside new, changed cells marked. */
import { Stack, Text } from "@mantine/core";
import type { KnowledgeArea, KnowledgeChangeItem } from "@medbrains/types";
import { Badge, Table } from "@/components/ui";
import { diffItem } from "./diff";
import { OP_LABEL, rowTitle } from "./labels";

interface DiffTableProps {
  area: KnowledgeArea;
  items: KnowledgeChangeItem[];
}

export function DiffTable({ area, items }: DiffTableProps) {
  return (
    <Stack gap="md">
      {items.map((item) => {
        const title = rowTitle(area, item.after ?? item.before);
        const rows = diffItem(area, item).filter((r) => r.changed || item.op !== "create");
        return (
          <Stack key={item.id} gap={4}>
            <Text size="sm" fw={600}>
              {item.seq}. {OP_LABEL[item.op]}: {title}
            </Text>
            <Table aria-label={`Item ${item.seq}: ${OP_LABEL[item.op]} ${title}`}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Field</Table.Th>
                  <Table.Th>Now</Table.Th>
                  <Table.Th>After the change</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {rows.map((r) => (
                  <Table.Tr key={r.key}>
                    <Table.Td>
                      {r.label}
                      {r.changed && (
                        <Badge ml="xs" size="xs" tone="warning">
                          Changed
                        </Badge>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" td={r.changed ? "line-through" : undefined}>
                        {r.before}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" fw={r.changed ? 700 : undefined}>
                        {r.after}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Stack>
        );
      })}
    </Stack>
  );
}
