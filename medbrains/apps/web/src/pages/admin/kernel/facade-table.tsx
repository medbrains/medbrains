import { Stack, Text } from "@mantine/core";
import type { FacadeCrate } from "@medbrains/types";
import { useMemo } from "react";
import { Badge, Card, Table } from "@/components/ui";

interface FacadeTableProps {
  crates: FacadeCrate[];
}

const STATUS = {
  on_facade: { label: "Kernel only", tone: "success" },
  partial: { label: "Partly", tone: "warning" },
  not_yet: { label: "Not yet", tone: "neutral" },
} as const;

/** Which modules reach the core only through the kernel. Computed from the code at build time. */
export function FacadeTable({ crates }: FacadeTableProps) {
  const { moved, waiting } = useMemo(
    () => ({
      moved: crates.filter((c) => c.status !== "not_yet"),
      waiting: crates.filter((c) => c.status === "not_yet").map((c) => c.name),
    }),
    [crates],
  );
  const onFacade = moved.filter((c) => c.status === "on_facade").length;

  return (
    <Card padding="md" withBorder>
      <Stack gap="sm">
        <Text fw={600}>Modules on the kernel</Text>
        <Text size="sm" c="dimmed">
          {onFacade} of {crates.length} modules reach the core only through the kernel;{" "}
          {waiting.length} have not moved yet. "Partly" means a module uses the kernel but still
          reaches the database or authorisation code directly.
        </Text>
        <Table>
          <Table.Caption>Modules that use the kernel</Table.Caption>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Module</Table.Th>
              <Table.Th>Through the kernel</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {moved.map((c) => (
              <Table.Tr key={c.name}>
                <Table.Td>
                  <Text size="sm" ff="monospace">
                    {c.name}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Badge tone={STATUS[c.status].tone}>{STATUS[c.status].label}</Badge>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
        <Text size="xs" c="dimmed" ff="monospace">
          Not yet: {waiting.join(", ")}
        </Text>
      </Stack>
    </Card>
  );
}
