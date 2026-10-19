import { BarChart } from "@mantine/charts";
import { Anchor, Stack, Text } from "@mantine/core";
import type { AbdmDashboard } from "@medbrains/types";
import { useMemo } from "react";
import { Link } from "react-router";
import { LINK_STATUS } from "@/components/Patient/abdm/abdmStatus";
import { Badge, Card, Table } from "@/components/ui";
import { formatInr, formatPercent, trendRows } from "@/lib/abdm-dashboard";
import { formatDateTime } from "@/lib/date-utils";
import { FacilityHfrCell } from "@/pages/admin/settings/FacilityHfrCell";

interface DashboardDetailsProps {
  data: AbdmDashboard;
}

function Trend({ data }: DashboardDetailsProps) {
  const rows = useMemo(() => trendRows(data.trend), [data.trend]);
  return (
    <Card>
      <Stack gap="sm">
        <Text fw={600}>Records linked, last six months</Text>
        <BarChart
          h={220}
          data={rows}
          dataKey="month"
          series={[
            { name: "linked", label: "Linked", color: "gray.5" },
            { name: "eligible", label: "Counted for DHIS", color: "primary.6" },
          ]}
          yAxisProps={{ domain: [0, "auto"] }}
          referenceLines={[
            { y: data.current.estimate.threshold, label: "DHIS threshold", color: "gray.7" },
          ]}
          withLegend
        />
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Month</Table.Th>
              <Table.Th>OPD visits with ABHA</Table.Th>
              <Table.Th>Linked</Table.Th>
              <Table.Th>Counted for DHIS</Table.Th>
              <Table.Th>Would earn</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((r) => (
              <Table.Tr key={r.month}>
                <Table.Td>{r.month}</Table.Td>
                <Table.Td>{formatPercent(r.opdWithAbhaPercent)}</Table.Td>
                <Table.Td>{r.linked}</Table.Td>
                <Table.Td>{r.eligible}</Table.Td>
                <Table.Td>{formatInr(r.estimateInr)}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Stack>
    </Card>
  );
}

function Campuses({ data }: DashboardDetailsProps) {
  return (
    <Card>
      <Stack gap="sm">
        <Text fw={600}>HFR by campus</Text>
        {data.facilities.length === 0 ? (
          <Text size="sm" c="dimmed">
            No campus is set up yet.
          </Text>
        ) : (
          <Table>
            <Table.Tbody>
              {data.facilities.map((f) => (
                <Table.Tr key={f.id}>
                  <Table.Td>{f.name}</Table.Td>
                  <Table.Td>
                    <FacilityHfrCell hfr={f} isError={false} />
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Stack>
    </Card>
  );
}

function Failures({ data }: DashboardDetailsProps) {
  if (data.failures_open === 0) {
    return (
      <Card>
        <Text fw={600}>Records that did not link</Text>
        <Text size="sm" c="dimmed">
          No record is waiting on a failed link.
        </Text>
      </Card>
    );
  }
  return (
    <Card>
      <Stack gap="sm">
        <Text fw={600}>Records that did not link: {data.failures_open} open</Text>
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Most common reasons</Table.Th>
              <Table.Th>Records</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {data.failure_reasons.map((r) => (
              <Table.Tr key={r.reason}>
                <Table.Td>{r.reason}</Table.Td>
                <Table.Td>{r.count}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Patient</Table.Th>
              <Table.Th>Record</Table.Th>
              <Table.Th>Why</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {data.failures.map((f) => (
              <Table.Tr key={f.id}>
                <Table.Td>
                  <Anchor component={Link} to={`/patients/${f.patient_id}#documents`} size="sm">
                    {f.patient_name}
                  </Anchor>
                  <Text size="xs" c="dimmed" ff="monospace">
                    {f.uhid}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{f.display}</Text>
                  <Text size="xs" c="dimmed">
                    {formatDateTime(f.updated_at)}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Badge tone={LINK_STATUS[f.link_status].tone}>
                    {LINK_STATUS[f.link_status].label}
                  </Badge>
                  <Text size="xs">{f.last_error ?? "No reason recorded"}</Text>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Stack>
    </Card>
  );
}

/** The trend, each campus's HFR state and the records that failed to link. */
export function DashboardDetails({ data }: DashboardDetailsProps) {
  return (
    <Stack gap="md">
      <Trend data={data} />
      <Campuses data={data} />
      <Failures data={data} />
    </Stack>
  );
}
