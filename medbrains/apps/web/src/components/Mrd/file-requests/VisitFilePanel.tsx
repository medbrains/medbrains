import { Group, List, SimpleGrid, Stack, Text } from "@mantine/core";
import { useHasAllPermissions, useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { QueryError } from "@/components/QueryError";
import { Alert, Badge, Card } from "@/components/ui";
import { mrdService } from "@/services/mrd.service";
import { visitChip } from "./fileRequestTime";

/** The chip follows the runner without a reload. */
const STATUS_REFRESH_MS = 30_000;

interface VisitFilePanelProps {
  encounterId: string;
}

/**
 * The doctor does not wait for the paper. Where the visit's file is
 * (requested, on the way, arrived) and, beside it, what the digital record
 * already says: allergies, recent diagnoses, current medicines and abnormal
 * results. The consultation below is open whatever the file's state.
 * Each read is gated on the permission its endpoint enforces: the chip on
 * `mrd.file_request.status`, the clinical summary on `opd.diagnoses.list`
 * and `patients.view`. A role without one sends that read not at all.
 */
export function VisitFilePanel({ encounterId }: VisitFilePanelProps) {
  const canSeeChip = useHasPermission(P.MRD.FILE_REQUEST.STATUS);
  const canSeeSummary = useHasAllPermissions([P.OPD.DIAGNOSES_LIST, P.PATIENTS.VIEW]);
  const status = useQuery({
    queryKey: ["visit-file-status", encounterId],
    queryFn: () => mrdService.getVisitFileStatus(encounterId),
    enabled: canSeeChip,
    refetchInterval: STATUS_REFRESH_MS,
  });
  const summary = useQuery({
    queryKey: ["visit-digital-summary", encounterId],
    queryFn: () => mrdService.getVisitDigitalSummary(encounterId),
    enabled: canSeeSummary,
    staleTime: 300_000,
  });
  if (!canSeeChip && !canSeeSummary) return null;
  const chip = status.data ? visitChip(status.data) : null;

  return (
    <Card padding="sm" pattern={false} data-testid="visit-file-panel">
      <Stack gap="xs">
        <Group justify="space-between" wrap="wrap">
          <Text fw={600}>From the digital record</Text>
          {chip && (
            <Badge tone={chip.tone} data-testid="visit-file-chip">
              {chip.label}
            </Badge>
          )}
        </Group>
        {status.isError && (
          <Alert tone="warning" title="File status unavailable">
            Could not check where the paper file is. The consultation can go ahead.
          </Alert>
        )}
        {summary.isError && (
          <QueryError
            title="The summary did not load"
            error={summary.error}
            onRetry={() => void summary.refetch()}
          />
        )}
        {summary.data && (
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
            <Section title="Allergies" empty="None recorded" more={summary.data.allergies.more}>
              {summary.data.allergies.items.map((a) => (
                <List.Item key={a.allergen_name}>
                  {a.allergen_name}
                  {a.severity ? ` (${a.severity.replace("_", " ")})` : ""}
                </List.Item>
              ))}
            </Section>
            <Section
              title="Recent diagnoses"
              empty={
                summary.data.diagnoses_withheld !== null
                  ? `${summary.data.diagnoses_withheld} withheld for your role`
                  : "None recorded"
              }
              more={summary.data.diagnoses.more}
            >
              {summary.data.diagnoses.items.map((d) => (
                <List.Item key={`${d.encounter_date}:${d.description}`}>
                  {d.description}
                  {d.icd_code ? ` · ${d.icd_code}` : ""} · {d.encounter_date}
                </List.Item>
              ))}
            </Section>
            <Section
              title="Current medicines"
              empty="None in the last 90 days"
              more={summary.data.medicines.more}
            >
              {summary.data.medicines.items.map((m) => (
                <List.Item key={`${m.prescribed_on}:${m.drug_name}`}>
                  {m.drug_name} {m.dosage}, {m.frequency}, {m.duration}
                </List.Item>
              ))}
            </Section>
            <Section
              title="Abnormal results"
              empty="None in the last 90 days"
              more={summary.data.abnormal_results.more}
            >
              {summary.data.abnormal_results.items.map((r) => (
                <List.Item key={`${r.resulted_on}:${r.test_name}:${r.parameter_name}`}>
                  {r.is_critical ? "Critical: " : ""}
                  {r.parameter_name} {r.value}
                  {r.unit ? ` ${r.unit}` : ""} ({r.flag ?? "abnormal"}) · {r.resulted_on}
                </List.Item>
              ))}
            </Section>
          </SimpleGrid>
        )}
      </Stack>
    </Card>
  );
}

interface SectionProps {
  title: string;
  empty: string;
  /** How many the server left out of the list. */
  more: number;
  children: React.ReactNode[];
}

/** One heading and its list, or a plain line when the list is empty. */
function Section({ title, empty, more, children }: SectionProps) {
  return (
    <Stack gap={2}>
      <Text size="sm" fw={600}>
        {title}
      </Text>
      {children.length === 0 ? (
        <Text size="sm" c="dimmed">
          {empty}
        </Text>
      ) : (
        <List size="sm" spacing={2}>
          {children}
        </List>
      )}
      {more > 0 && (
        <Text size="xs" c="dimmed">
          {more} more not shown
        </Text>
      )}
    </Stack>
  );
}
