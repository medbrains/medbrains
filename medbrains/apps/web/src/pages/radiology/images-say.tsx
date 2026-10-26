/**
 * What the modality wrote into a study — the identity a person checks
 * before filing it under a patient. Monospace for the IDs, as on a wristband.
 */
import { Group, SimpleGrid, Stack, Text } from "@mantine/core";
import type { UnmatchedStudy } from "@medbrains/types";
import { Card } from "@/components/ui";

interface ImagesSayProps {
  study: UnmatchedStudy;
}

function Field({ label, value, mono }: { label: string; value: string | null; mono?: boolean }) {
  return (
    <Stack gap={0}>
      <Text size="xs" c="dimmed" tt="uppercase">
        {label}
      </Text>
      <Text size="sm" ff={mono ? "monospace" : undefined}>
        {value || "Not on the images"}
      </Text>
    </Stack>
  );
}

export function ImagesSay({ study }: ImagesSayProps) {
  return (
    <Card withBorder padding="sm">
      <Stack gap="xs">
        <Group justify="space-between">
          <Text fw={600} size="sm">
            The images say
          </Text>
          <Text size="xs" c="dimmed">
            {study.modality ?? "?"} · {study.study_description ?? "No description"} ·{" "}
            {study.instance_count} image{study.instance_count === 1 ? "" : "s"}
          </Text>
        </Group>
        <SimpleGrid cols={{ base: 2, sm: 4 }}>
          <Field label="Patient ID" value={study.dicom_patient_id} mono />
          <Field label="Name" value={study.dicom_patient_name} />
          <Field label="Birth date" value={study.dicom_birth_date} mono />
          <Field label="Sex" value={study.dicom_sex} />
        </SimpleGrid>
        <Field label="Accession on the images" value={study.accession_number} mono />
      </Stack>
    </Card>
  );
}
