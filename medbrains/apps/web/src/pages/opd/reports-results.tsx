import { BarChart } from "@mantine/charts";
import { Box, Group, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import type { OpdReportSummary } from "@medbrains/types";
import {
  IconDownload,
  IconRepeat,
  IconStethoscope,
  IconUserPlus,
  IconUsers,
} from "@tabler/icons-react";
import { buildCsv, downloadCsv } from "@/components/data-table-features";
import { StatCard } from "@/components/StatCard";
import { Button, Card, Table } from "@/components/ui";
import { byDayCsvRows, type DayRange } from "./reports-range";

interface OpdReportResultsProps {
  summary: OpdReportSummary;
  range: DayRange;
}

/** The loaded report: four tiles, visits by day as a chart and a table, and visits by doctor. */
export function OpdReportResults({ summary, range }: OpdReportResultsProps) {
  const { totals, by_day: days, by_doctor: doctors } = summary;
  /** Save the visits-by-day table as a CSV named for the range. */
  const downloadByDay = () => {
    const { headers, rows } = byDayCsvRows(days);
    downloadCsv(`opd-report-${range.from}-to-${range.to}`, buildCsv(headers, rows));
  };

  return (
    <Stack gap="lg">
      <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }}>
        <StatCard label="OPD visits" value={totals.visits} icon={<IconStethoscope size={20} />} />
        <StatCard
          label="Registrations"
          value={totals.registrations}
          icon={<IconUserPlus size={20} />}
        />
        <StatCard label="New patients" value={totals.new_patients} icon={<IconUsers size={20} />} />
        <StatCard
          label="Repeat patients"
          value={totals.repeat_patients}
          icon={<IconRepeat size={20} />}
        />
      </SimpleGrid>

      {totals.visits === 0 ? (
        <Text c="var(--mb-text-caption)">No OPD visits in this range.</Text>
      ) : (
        <>
          <Card withBorder padding="md">
            <Title order={2} size="h4" mb="md">
              OPD visits by day
            </Title>
            {/* The same figures are in the table below; the chart is for the eye. */}
            <Box
              role="img"
              aria-label="Bar chart of OPD visits by day. The table below has the same figures."
            >
              <BarChart
                h={260}
                data={days}
                dataKey="date"
                series={[{ name: "visits", label: "OPD visits", color: "primary" }]}
              />
            </Box>
          </Card>

          <Card withBorder padding="md">
            <Group justify="space-between" mb="md">
              <Title order={2} size="h4">
                By day
              </Title>
              <Button
                tone="secondary"
                size="xs"
                leftSection={<IconDownload size={16} />}
                onClick={downloadByDay}
              >
                Download CSV
              </Button>
            </Group>
            <Table.ScrollContainer minWidth={480}>
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Date</Table.Th>
                    <Table.Th ta="right">OPD visits</Table.Th>
                    <Table.Th ta="right">Registrations</Table.Th>
                    <Table.Th ta="right">New patients</Table.Th>
                    <Table.Th ta="right">Repeat patients</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {days.map((d) => (
                    <Table.Tr key={d.date}>
                      <Table.Td ff="var(--font-mono)">{d.date}</Table.Td>
                      <Table.Td ta="right">{d.visits}</Table.Td>
                      <Table.Td ta="right">{d.registrations}</Table.Td>
                      <Table.Td ta="right">{d.new}</Table.Td>
                      <Table.Td ta="right">{d.repeat}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          </Card>

          <Card withBorder padding="md">
            <Title order={2} size="h4" mb="md">
              By doctor
            </Title>
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Doctor</Table.Th>
                  <Table.Th ta="right">OPD visits</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {doctors.map((d) => (
                  <Table.Tr key={d.doctor_id ?? "none"}>
                    <Table.Td>{d.doctor_name ?? "No doctor assigned"}</Table.Td>
                    <Table.Td ta="right">{d.visits}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Card>
        </>
      )}
    </Stack>
  );
}
