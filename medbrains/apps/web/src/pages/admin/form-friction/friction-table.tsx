import { Group, Stack, Text } from "@mantine/core";
import type { FrictionRoute } from "@medbrains/types";
import { Badge, Table } from "@/components/ui";
import { screenName, trendOf } from "./labels";
import { ReasonList } from "./reason-list";

interface FrictionTableProps {
  routes: FrictionRoute[];
}

/** Routes ranked by refusals: the screen, the count, the trend and the top reasons. */
export function FrictionTable({ routes }: FrictionTableProps) {
  return (
    <Table>
      <Table.Caption>Refused saves by screen</Table.Caption>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Screen</Table.Th>
          <Table.Th>Refused</Table.Th>
          <Table.Th>Against the period before</Table.Th>
          <Table.Th>Most common reasons</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {routes.map((r) => {
          const trend = trendOf(r.count, r.previous);
          return (
            <Table.Tr key={`${r.method} ${r.route}`} data-testid="friction-row">
              <Table.Td>
                <Stack gap={2}>
                  <Text size="sm" fw={600}>
                    {screenName(r.route)}
                  </Text>
                  <Text size="xs" c="dimmed" ff="monospace">
                    {r.method} {r.route}
                  </Text>
                </Stack>
              </Table.Td>
              <Table.Td>
                <Text size="sm" ff="monospace">
                  {r.count.toLocaleString("en-IN")}
                </Text>
              </Table.Td>
              <Table.Td>
                <Group gap="xs">
                  <Badge tone={trend.tone}>{trend.label}</Badge>
                  <Text size="xs" c="dimmed">
                    was {r.previous.toLocaleString("en-IN")}
                  </Text>
                </Group>
              </Table.Td>
              <Table.Td>
                <ReasonList route={r} />
              </Table.Td>
            </Table.Tr>
          );
        })}
      </Table.Tbody>
    </Table>
  );
}
