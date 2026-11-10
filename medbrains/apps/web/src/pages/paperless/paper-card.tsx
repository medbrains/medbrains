import { List, SimpleGrid, Stack, Text } from "@mantine/core";
import type { PaperlessReport } from "@medbrains/types";
import { Card } from "@/components/ui";

interface PaperCardProps {
  report: PaperlessReport;
}

/**
 * The paper still in use, and what the meter cannot see, said plainly so a
 * high share is not read as more than it is.
 */
export function PaperCard({ report }: PaperCardProps) {
  const { totals } = report;
  return (
    <Card padding="md" pattern={false} data-testid="paperless-paper">
      <Stack gap="sm">
        <Text fw={600}>Paper still in use</Text>
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
          <Text size="sm">
            <Text span fw={700}>
              {totals.scanned.toLocaleString("en-IN")}
            </Text>{" "}
            case sheets scanned in
          </Text>
          <Text size="sm">
            <Text span fw={700}>
              {totals.printed.toLocaleString("en-IN")}
            </Text>{" "}
            system documents printed
          </Text>
          <Text size="sm" c="dimmed">
            MRD file requests: not counted yet
          </Text>
        </SimpleGrid>
        <Text size="sm" fw={600}>
          What this does not count
        </Text>
        <List size="sm" spacing={4} data-testid="paperless-not-counted">
          {report.not_counted.map((n) => (
            <List.Item key={n}>{n}</List.Item>
          ))}
        </List>
      </Stack>
    </Card>
  );
}
