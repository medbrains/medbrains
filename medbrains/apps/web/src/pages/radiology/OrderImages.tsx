/**
 * The order's images (#226): once the modality's study has come back from
 * the PACS (matched by accession number), the radiologist opens it in the
 * viewer — MedBrains' own, behind sign-in, from anywhere — or shares it.
 */
import { Group, Stack, Text } from "@mantine/core";
import type { RadiologyOrder } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { QueryError } from "@/components/QueryError";
import { StudyImageActions } from "@/components/Radiology/StudyImageActions";
import { Badge } from "@/components/ui";
import { radiologyService } from "@/services/radiology.service";

export function OrderImages({ order }: { order: RadiologyOrder }) {
  const studies = useQuery({
    queryKey: ["radiology-dicom-studies", order.patient_id],
    queryFn: () => radiologyService.listRadiologyDicomStudies({ patient_id: order.patient_id }),
    enabled: Boolean(order.pacs_study_uid),
  });
  const study = studies.data?.find((s) => s.study_instance_uid === order.pacs_study_uid);

  return (
    <Stack gap="xs" aria-label="Images" role="region">
      <Group gap="xs">
        <Text size="sm" fw={600}>
          Accession
        </Text>
        <Badge tone="neutral">{order.accession_number}</Badge>
      </Group>
      {!order.pacs_study_uid && (
        <Text size="sm" c="dimmed">
          No images yet. They appear here when the modality sends the study under this accession
          number.
        </Text>
      )}
      {studies.isError && (
        <QueryError error={studies.error} onRetry={() => void studies.refetch()} />
      )}
      {study && (
        <Group justify="space-between">
          <Text size="sm">
            {study.study_description ?? study.modality} · {study.series_count} series ·{" "}
            {study.instance_count} images
          </Text>
          <StudyImageActions studyId={study.id} />
        </Group>
      )}
    </Stack>
  );
}
