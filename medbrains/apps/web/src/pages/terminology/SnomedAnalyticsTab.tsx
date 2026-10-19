/**
 * The hospital's coded diagnoses counted by SNOMED CT hierarchy: pick a
 * concept to count it and everything below it, or walk the roll-up from the
 * top-level categories down.
 */
import { Group, SimpleGrid, Stack, Text } from "@mantine/core";
import type { SnomedRollupRow } from "@medbrains/types";
import { IconArrowUp } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components";
import { SnomedConceptSelect } from "@/components/Clinical/SnomedConceptSelect";
import { Alert, Button, Card } from "@/components/ui";
import { snomedService } from "@/services/snomed.service";

interface Level {
  id: string;
  label: string;
}

interface StatProps {
  label: string;
  value: number;
}

function Stat({ label, value }: StatProps) {
  return (
    <Card withBorder padding="sm">
      <Text size="xs" tt="uppercase" fw={700} c="dimmed">
        {label}
      </Text>
      <Text size="xl" fw={700}>
        {value.toLocaleString()}
      </Text>
    </Card>
  );
}

export function SnomedAnalyticsTab() {
  const [concept, setConcept] = useState<Level | null>(null);
  // The drill-down path; empty = the top-level categories under the root.
  const [path, setPath] = useState<Level[]>([]);
  const parent = path.at(-1);

  const count = useQuery({
    queryKey: ["snomed-count", concept?.id],
    queryFn: () => snomedService.countCodedRecords(concept?.id ?? ""),
    enabled: Boolean(concept),
  });
  const rollup = useQuery({
    queryKey: ["snomed-rollup", parent?.id ?? "root"],
    queryFn: () => snomedService.rollupCodedRecords(parent?.id),
  });

  return (
    <Stack gap="md">
      <Card withBorder padding="md">
        <Stack gap="sm">
          <SnomedConceptSelect
            label="Count diagnoses that are this concept or any of its descendants"
            value={concept?.id ?? null}
            displayValue={concept?.label}
            onChange={(hit) =>
              setConcept(
                hit ? { id: hit.concept_id, label: hit.preferred_term ?? hit.concept_id } : null,
              )
            }
          />
          {count.isError && <Alert tone="danger">The count could not be loaded. Try again.</Alert>}
          {count.data && (
            <>
              <SimpleGrid cols={{ base: 2, md: 4 }}>
                <Stat label="Diagnoses" value={count.data.records} />
                <Stat label="Patients" value={count.data.patients} />
                <Stat label="SNOMED-coded diagnoses" value={count.data.coded_records} />
                <Stat label="Codes not in the release" value={count.data.unknown_codes} />
              </SimpleGrid>
              {count.data.icd_only_records > 0 && (
                <Text size="xs" c="dimmed">
                  {count.data.icd_only_records.toLocaleString()} diagnoses are coded only in ICD and
                  are not counted: that needs an ICD↔SNOMED CT map, which is not loaded.
                </Text>
              )}
            </>
          )}
        </Stack>
      </Card>

      <Stack gap="xs">
        <Group justify="space-between">
          <Text fw={600}>{parent ? `Under ${parent.label}` : "By top-level category"}</Text>
          {parent && (
            <Button
              tone="secondary"
              size="xs"
              leftSection={<IconArrowUp size={14} />}
              onClick={() => setPath((p) => p.slice(0, -1))}
            >
              Up one level
            </Button>
          )}
        </Group>
        <DataTable<SnomedRollupRow>
          data={rollup.data?.categories ?? []}
          loading={rollup.isLoading}
          error={rollup.error}
          onRetry={() => void rollup.refetch()}
          rowKey={(r) => r.concept_id}
          emptyTitle="No coded diagnoses here"
          emptyDescription="No diagnosis is coded with this category or anything below it."
          columns={[
            {
              key: "category",
              label: "Category",
              render: (r) => (
                <Button
                  tone="ghost"
                  size="compact-sm"
                  onClick={() =>
                    setPath((p) => [
                      ...p,
                      { id: r.concept_id, label: r.preferred_term ?? r.concept_id },
                    ])
                  }
                >
                  {r.preferred_term ?? r.concept_id}
                </Button>
              ),
            },
            {
              key: "tag",
              label: "Hierarchy",
              render: (r) => <Text size="sm">{r.semantic_tag ?? "—"}</Text>,
            },
            {
              key: "records",
              label: "Diagnoses",
              render: (r) => <Text size="sm">{r.records.toLocaleString()}</Text>,
            },
            {
              key: "patients",
              label: "Patients",
              render: (r) => <Text size="sm">{r.patients.toLocaleString()}</Text>,
            },
          ]}
        />
      </Stack>
    </Stack>
  );
}
