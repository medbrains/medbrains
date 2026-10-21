import { Group, Loader, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import type { LabResult, LabResultFlag } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconAlertTriangle, IconArrowDown, IconArrowUp, IconCheck } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Alert, Badge, type BadgeTone, Table } from "@/components/ui";
import { labService } from "@/services/lab.service";
import { PrintLabReportButton } from "./LabReportPrint";

const FLAG_DISPLAY: Record<LabResultFlag, { label: string; tone: BadgeTone; icon: ReactNode }> = {
  normal: { label: "Normal", tone: "success", icon: <IconCheck size={12} /> },
  low: { label: "Low (L)", tone: "warning", icon: <IconArrowDown size={12} /> },
  high: { label: "High (H)", tone: "warning", icon: <IconArrowUp size={12} /> },
  critical_low: {
    label: "Critical low",
    tone: "danger",
    icon: <IconAlertTriangle size={12} />,
  },
  critical_high: {
    label: "Critical high",
    tone: "danger",
    icon: <IconAlertTriangle size={12} />,
  },
  abnormal: { label: "Abnormal", tone: "warning", icon: <IconAlertTriangle size={12} /> },
};

/** The flag in words and a glyph as well as a tone — never colour alone. */
function FlagBadge({ flag }: { flag: LabResultFlag | null }) {
  const display = flag ? FLAG_DISPLAY[flag] : undefined;
  if (!display) {
    return (
      <Text size="sm" c="dimmed">
        —
      </Text>
    );
  }
  return (
    <Badge size="xs" tone={display.tone} leftSection={display.icon}>
      {display.label}
    </Badge>
  );
}

/**
 * How far this value has moved since the patient's last one. The lab computes
 * `previous_value`, `delta_percent` and `is_delta_flagged`; the flag is the
 * lab's own per-analyte judgement, so it is trusted rather than recomputed.
 */
function DeltaCell({ result }: { result: LabResult }) {
  if (result.previous_value === null || result.delta_percent === null) {
    // No prior value is not a zero change.
    return (
      <Text size="sm" c="dimmed">
        First result
      </Text>
    );
  }
  const pct = Number(result.delta_percent);
  const arrow = pct > 0 ? "↑" : pct < 0 ? "↓" : "";
  const label = `${arrow}${Math.abs(pct).toFixed(0)}%`;
  return (
    <Stack gap={0}>
      {result.is_delta_flagged ? (
        <Badge size="xs" tone="warning">
          Changed {label}
        </Badge>
      ) : (
        <Text size="sm">{label}</Text>
      )}
      <Text size="xs" c="dimmed">
        was {result.previous_value}
        {result.unit ? ` ${result.unit}` : ""}
      </Text>
    </Stack>
  );
}

function ResultTable({ results }: { results: LabResult[] }) {
  return (
    <Table striped>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Parameter</Table.Th>
          <Table.Th>Result</Table.Th>
          <Table.Th>Reference range</Table.Th>
          <Table.Th>Since last</Table.Th>
          <Table.Th>Flag</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {results.map((result) => (
          <Table.Tr key={result.id}>
            <Table.Td>
              <Text size="sm" fw={500}>
                {result.parameter_name}
              </Text>
              {result.notes && (
                <Text size="xs" c="dimmed">
                  {result.notes}
                </Text>
              )}
            </Table.Td>
            <Table.Td>
              <Text size="sm" fw={result.flag && result.flag !== "normal" ? 700 : 400}>
                {result.value}
                {result.unit ? ` ${result.unit}` : ""}
              </Text>
            </Table.Td>
            <Table.Td>
              <Text size="sm" c="dimmed">
                {result.normal_range ?? "—"}
              </Text>
            </Table.Td>
            <Table.Td>
              <DeltaCell result={result} />
            </Table.Td>
            <Table.Td>
              <FlagBadge flag={result.flag} />
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}

/**
 * The result values of one lab order, wherever a clinician looks at the
 * patient — including orders placed straight at the lab desk with no visit.
 *
 * Mounted only when the clinician opens the order, so a list of twenty orders
 * is one request, not twenty-one. A failed read says so: "no values yet" on an
 * order whose values could not be fetched would read as a pending test.
 */
export function LabOrderResults({ orderId }: { orderId: string }) {
  const canView = useHasPermission(P.LAB.ORDERS_VIEW);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["lab-order-detail", orderId],
    queryFn: () => labService.getLabOrder(orderId),
    enabled: canView,
  });

  if (!canView) {
    return (
      <Text size="sm" c="dimmed">
        You do not have permission to view lab result values.
      </Text>
    );
  }
  if (isLoading) return <Loader size="sm" />;
  if (isError || !data) {
    return (
      <Alert tone="danger" icon={<IconAlertTriangle size={14} />}>
        These results could not be loaded. This does not mean there are none — try again.
      </Alert>
    );
  }

  const isVerified = data.order.status === "verified";
  return (
    <Stack gap="xs">
      <Group justify="space-between">
        <Badge
          size="sm"
          tone={isVerified ? "success" : "warning"}
          leftSection={isVerified ? <IconCheck size={12} /> : undefined}
        >
          {isVerified ? "Verified" : "Not yet verified — provisional"}
        </Badge>
        <PrintLabReportButton orderId={orderId} disabled={!isVerified} />
      </Group>
      {data.results.length > 0 ? (
        <ResultTable results={data.results} />
      ) : (
        <Text size="sm" c="dimmed">
          No result values have been entered for this order yet.
        </Text>
      )}
    </Stack>
  );
}
