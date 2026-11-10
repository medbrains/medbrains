import { BarChart } from "@mantine/charts";
import { Accordion, Stack, Text } from "@mantine/core";
import type { ConditionSignal } from "@medbrains/types";
import { Badge, Card, Table } from "@/components/ui";
import { formatDateTime } from "@/lib/date-utils";
import { BASELINE_RULE, formatCount, levelLabel, methodLabel } from "./labels";

interface ConditionsCardProps {
  conditions: ConditionSignal[];
  computedAt: string | null;
  /** The hourly recompute is not running: the counts may be out of date. */
  isStale: boolean;
}

const WEEK_LABELS = Array.from({ length: 12 }, (_, i) =>
  i === 11 ? "Last 7 days" : `${11 - i} wk ago`,
);

/** Zero-based bars; a suppressed week (1–4) is not drawn and says so. */
function Trend({ row }: { row: ConditionSignal }) {
  const data = row.series.map((n, i) => ({ week: WEEK_LABELS[i], cases: n ?? 0 }));
  return (
    <BarChart
      h={36}
      w={132}
      data={data}
      dataKey="week"
      series={[{ name: "cases", color: "primary.6" }]}
      withXAxis={false}
      withYAxis={false}
      withTooltip={false}
      gridAxis="none"
      yAxisProps={{ domain: [0, "auto"] }}
      aria-label={`${row.condition}, weekly cases over 12 weeks: ${row.series
        .map(formatCount)
        .join(", ")}`}
    />
  );
}

function WeeklyTable({ conditions }: { conditions: ConditionSignal[] }) {
  return (
    <Table.ScrollContainer minWidth={900}>
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Condition</Table.Th>
            {WEEK_LABELS.map((w) => (
              <Table.Th key={w}>{w}</Table.Th>
            ))}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {conditions.map((row) => (
            <Table.Tr key={row.condition}>
              <Table.Td>{row.condition}</Table.Td>
              {row.series.map((n, i) => (
                <Table.Td key={WEEK_LABELS[i]}>{formatCount(n)}</Table.Td>
              ))}
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}

/** "This week vs usual": aggregate counts from the notifiable-disease worklist. */
export function ConditionsCard({ conditions, computedAt, isStale }: ConditionsCardProps) {
  return (
    <Card padding="md" withBorder data-testid="health-intel-conditions">
      <Stack gap="sm">
        <Text fw={600}>This week vs usual</Text>
        <Text size="sm" c="dimmed">
          Notifiable-disease cases detected in the last 7 days, against this hospital&apos;s own
          usual. {BASELINE_RULE} Counts under 5 are shown as &ldquo;fewer than 5&rdquo;.
        </Text>
        <Text size="xs" c="dimmed" data-testid="health-intel-computed">
          {computedAt ? `Counts as of ${formatDateTime(computedAt)}` : "Not computed yet"}
          {isStale ? " — the hourly recompute is not running, so these may be out of date." : ""}
        </Text>
        {computedAt && conditions.length === 0 ? (
          <Text size="sm">No notifiable cases in the last 12 weeks.</Text>
        ) : (
          <Table.ScrollContainer minWidth={720}>
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Condition</Table.Th>
                  <Table.Th>Last 7 days</Table.Th>
                  <Table.Th>Usual</Table.Th>
                  <Table.Th>Compared with usual</Table.Th>
                  <Table.Th>12-week trend</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {conditions.map((row) => {
                  const level = levelLabel(row.level);
                  return (
                    <Table.Tr key={row.condition}>
                      <Table.Td>{row.condition}</Table.Td>
                      <Table.Td>{formatCount(row.this_week)}</Table.Td>
                      <Table.Td>
                        <Text size="sm">
                          {row.method === "not_enough_history" ? "—" : formatCount(row.usual)}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {methodLabel(row.method)}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge tone={level.tone}>{level.label}</Badge>
                      </Table.Td>
                      <Table.Td>
                        <Trend row={row} />
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
        {conditions.length > 0 && (
          <Accordion variant="contained">
            <Accordion.Item value="weekly">
              <Accordion.Control>Weekly counts as a table</Accordion.Control>
              <Accordion.Panel>
                <Text size="xs" c="dimmed" mb="xs">
                  Weeks with fewer than 5 cases are not drawn in the trend bars.
                </Text>
                <WeeklyTable conditions={conditions} />
              </Accordion.Panel>
            </Accordion.Item>
          </Accordion>
        )}
      </Stack>
    </Card>
  );
}
