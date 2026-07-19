// REGULATORY NablDocumentsTab — split from regulatory.tsx (pure move).

import { Card, Grid, Group, Progress, Stack, Text, Title } from "@mantine/core";
import type { NablDocumentSummary } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { DataTable, PageHeader } from "@/components";
import { Badge } from "@/components/ui";
import { regulatoryService } from "@/services/regulatory.service";

export function NablDocumentsTab() {
  const { data: documents = [], isLoading } = useQuery({
    queryKey: ["regulatory-nabl-documents"],
    queryFn: () => regulatoryService.nablDocumentTracking(),
  });

  const totalRequired = documents.reduce((sum, d) => sum + d.total_required, 0);
  const totalUploaded = documents.reduce((sum, d) => sum + d.total_uploaded, 0);
  const overallPct = totalRequired > 0 ? Math.round((totalUploaded / totalRequired) * 100) : 0;

  return (
    <Stack gap="md">
      <PageHeader
        title="NABL Document Tracking"
        subtitle="Track document completeness for NABL accreditation"
      />

      <Grid>
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Card withBorder p="md">
            <Text size="sm" c="dimmed">
              Overall Completeness
            </Text>
            <Title
              order={2}
              c={overallPct >= 80 ? "success" : overallPct >= 50 ? "warning" : "danger"}
            >
              {overallPct}%
            </Title>
            <Progress
              value={overallPct}
              color={overallPct >= 80 ? "success" : overallPct >= 50 ? "warning" : "danger"}
              size="lg"
              mt="xs"
            />
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Card withBorder p="md">
            <Text size="sm" c="dimmed">
              Total Required
            </Text>
            <Title order={2}>{totalRequired}</Title>
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Card withBorder p="md">
            <Text size="sm" c="dimmed">
              Uploaded
            </Text>
            <Title order={2} c="teal">
              {totalUploaded}
            </Title>
          </Card>
        </Grid.Col>
      </Grid>

      <DataTable
        data={documents}
        rowKey={(r) => r.document_type}
        loading={isLoading}
        columns={[
          {
            key: "document_type",
            label: "Document Type",
            render: (r: NablDocumentSummary) => (
              <Text size="sm" fw={500}>
                {r.document_type}
              </Text>
            ),
          },
          {
            key: "total_required",
            label: "Required",
            render: (r: NablDocumentSummary) => <Text size="sm">{r.total_required}</Text>,
          },
          {
            key: "total_uploaded",
            label: "Uploaded",
            render: (r: NablDocumentSummary) => <Text size="sm">{r.total_uploaded}</Text>,
          },
          {
            key: "completeness_pct",
            label: "Completeness",
            render: (r: NablDocumentSummary) => (
              <Group gap="xs">
                <Progress
                  value={r.completeness_pct}
                  color={
                    r.completeness_pct >= 80
                      ? "success"
                      : r.completeness_pct >= 50
                        ? "warning"
                        : "danger"
                  }
                  size="lg"
                  w={100}
                />
                <Text size="sm" fw={500}>
                  {r.completeness_pct.toFixed(0)}%
                </Text>
              </Group>
            ),
          },
          {
            key: "status",
            label: "Status",
            render: (r: NablDocumentSummary) =>
              r.completeness_pct >= 100 ? (
                <Badge tone="success">Complete</Badge>
              ) : r.completeness_pct >= 50 ? (
                <Badge tone="warning">In Progress</Badge>
              ) : (
                <Badge tone="danger">Incomplete</Badge>
              ),
          },
        ]}
      />
    </Stack>
  );
}
