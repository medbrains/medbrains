import { Badge, Card, Divider, Group, SimpleGrid, Stack, Text, Title } from "@mantine/core";

interface DetailReport {
  id: string;
  title: string;
  description: string;
  permission: string;
  cadence: string;
  source: string;
  sourceEvents: string[];
  eventPayloadKeys: string[];
  indicatorTargets: string[];
  outputs: string[];
  status: string;
  dataStatus: string;
  dataSource: string;
  generatedAt: string;
  rowCount: number | null;
  warning: string | null;
}

interface DetailInsights {
  summary: string;
  executiveSummary: string[];
  predictions: string[];
  anticipated: string[];
  aiInteractions: string[];
  detailNotes: string[];
  redFlags: string[];
  appreciation: string[];
  actions: string[];
}

interface ReportDetailPanelProps {
  report: DetailReport;
  insights: DetailInsights;
}

function sourceContract(report: DetailReport): string[] {
  const base = [
    `Primary source: ${report.source}`,
    `Permission gate: ${report.permission}`,
    `Refresh cadence: ${report.cadence}`,
  ];
  if (report.sourceEvents.length > 0) {
    base.push(`Workflow events: ${report.sourceEvents.join(", ")}`);
  }
  if (report.eventPayloadKeys.length > 0) {
    base.push(`Payload evidence: ${report.eventPayloadKeys.join(", ")}`);
  }
  if (report.indicatorTargets.length > 0) {
    base.push(`Indicator targets: ${report.indicatorTargets.join(", ")}`);
  }
  if (report.id.includes("village") || report.id.includes("pincode") || report.id.includes("map")) {
    base.push(
      "Required fields: patient locality, pincode/village, event date, complaint/diagnosis/lab/drug signal, and source module.",
    );
  }
  if (
    report.id.includes("prediction") ||
    report.id.includes("forecast") ||
    report.id.includes("risk")
  ) {
    base.push(
      "Required model fields: input window, model/rule version, confidence, drift state, reviewer, and action taken.",
    );
  }
  if (report.id.includes("nabh")) {
    base.push(
      "Required evidence fields: indicator code, numerator, denominator, target, month, owner, and source-data gap.",
    );
  }
  return base;
}

function validationChecks(report: DetailReport): string[] {
  const checks = [
    "Reject chart output if source query returns mixed tenants or missing tenant context.",
    "Show stale-data warning when the newest source event is older than the report cadence.",
    "Audit every export, secure share, scheduled delivery, and external recipient.",
  ];
  if (report.id.includes("village") || report.id.includes("map") || report.id.includes("cluster")) {
    checks.push(
      "Suppress small-cell identifiable clusters unless the viewer has clinical/public-health authorization.",
    );
  }
  if (
    report.id.includes("prediction") ||
    report.id.includes("forecast") ||
    report.id.includes("sentinel")
  ) {
    checks.push(
      "Prediction cannot auto-diagnose or auto-escalate; it creates a review task with explanation.",
    );
  }
  return checks;
}

export function ReportDetailPanel({ report, insights }: ReportDetailPanelProps) {
  return (
    <Stack gap="md">
      <Stack gap={4}>
        <Title order={3}>{report.title}</Title>
        <Text c="dimmed">{report.description}</Text>
        <Group gap={6}>
          <Badge variant="light" color="blue">
            Summary version: {report.status}
          </Badge>
          <Badge variant="light" color={report.dataStatus === "Live" ? "green" : "orange"}>
            Data version: {report.dataStatus}
          </Badge>
          <Badge variant="light" color="blue">
            {report.rowCount == null ? "Rows pending" : `${report.rowCount} rows`}
          </Badge>
          {report.outputs.map((output) => (
            <Badge key={output} variant="light" color="teal">
              {output}
            </Badge>
          ))}
        </Group>
      </Stack>

      <SimpleGrid cols={{ base: 1, md: 2 }}>
        <Card withBorder radius="md" padding="md">
          <Stack gap="xs">
            <Text fw={800}>Summary report version</Text>
            <Text size="sm" c="dimmed">
              {insights.summary}
            </Text>
            {insights.executiveSummary.map((item) => (
              <Text key={item} size="sm">
                {item}
              </Text>
            ))}
          </Stack>
        </Card>

        <Card withBorder radius="md" padding="md">
          <Stack gap="xs">
            <Text fw={800}>Data version</Text>
            <Text size="sm">Backend source: {report.dataSource}</Text>
            <Text size="sm">Generated: {report.generatedAt}</Text>
            <Text size="sm">Refresh cadence: {report.cadence}</Text>
            {report.warning && (
              <Text size="sm" c="orange.8">
                Warning: {report.warning}
              </Text>
            )}
          </Stack>
        </Card>
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, md: 2 }}>
        <Card withBorder radius="md" padding="md">
          <Stack gap="xs">
            <Text fw={800}>Prediction and anticipation</Text>
            {insights.predictions.map((item) => (
              <Text key={item} size="sm">
                {item}
              </Text>
            ))}
            {insights.anticipated.map((item) => (
              <Text key={item} size="sm" c="orange.8">
                {item}
              </Text>
            ))}
          </Stack>
        </Card>

        <Card withBorder radius="md" padding="md">
          <Stack gap="xs">
            <Text fw={800}>Management interpretation</Text>
            {insights.detailNotes.map((item) => (
              <Text key={item} size="sm">
                {item}
              </Text>
            ))}
          </Stack>
        </Card>
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, md: 3 }}>
        <Stack gap={6}>
          <Text size="xs" fw={800} c="blue" tt="uppercase">
            Data contract
          </Text>
          {report.sourceEvents.length > 0 && (
            <Group gap={4}>
              {report.sourceEvents.map((eventName) => (
                <Badge key={eventName} variant="light" color="blue">
                  {eventName}
                </Badge>
              ))}
            </Group>
          )}
          {sourceContract(report).map((item) => (
            <Text key={item} size="sm">
              {item}
            </Text>
          ))}
        </Stack>
        <Stack gap={6}>
          <Text size="xs" fw={800} c="red" tt="uppercase">
            Validation and safety
          </Text>
          {validationChecks(report).map((item) => (
            <Text key={item} size="sm">
              {item}
            </Text>
          ))}
        </Stack>
        <Stack gap={6}>
          <Text size="xs" fw={800} c="green" tt="uppercase">
            Management actions
          </Text>
          {insights.actions.map((action) => (
            <Text key={action} size="sm">
              {action}
            </Text>
          ))}
        </Stack>
      </SimpleGrid>

      <Card withBorder radius="md" padding="md">
        <Stack gap="xs">
          <Text fw={800}>AI interactions later</Text>
          {insights.aiInteractions.map((item) => (
            <Text key={item} size="sm">
              {item}
            </Text>
          ))}
        </Stack>
      </Card>

      <Divider />

      <SimpleGrid cols={{ base: 1, md: 2 }}>
        <Stack gap={6}>
          <Text size="xs" fw={800} c="red" tt="uppercase">
            Red flags
          </Text>
          {insights.redFlags.map((flag) => (
            <Text key={flag} size="sm">
              {flag}
            </Text>
          ))}
        </Stack>
        <Stack gap={6}>
          <Text size="xs" fw={800} c="green" tt="uppercase">
            Good data signals
          </Text>
          {insights.appreciation.map((flag) => (
            <Text key={flag} size="sm">
              {flag}
            </Text>
          ))}
        </Stack>
      </SimpleGrid>
    </Stack>
  );
}
