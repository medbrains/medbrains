/**
 * The order's images (#226): once the modality's study has come back from
 * the PACS (matched by accession number), the radiologist opens it in the
 * OHIF viewer here, beside the report, rather than in another system.
 */
import { Box, Group, Stack, Text } from "@mantine/core";
import type { RadiologyOrder } from "@medbrains/types";
import { IconPhoto } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { QueryError } from "@/components/QueryError";
import { Badge, Button, Modal } from "@/components/ui";
import { radiologyService } from "@/services/radiology.service";

export function OrderImages({ order }: { order: RadiologyOrder }) {
  const [open, setOpen] = useState(false);
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
          {study.viewer_url && (
            <Button
              tone="primary"
              leftSection={<IconPhoto size={16} />}
              onClick={() => setOpen(true)}
            >
              View images
            </Button>
          )}
        </Group>
      )}
      <Modal opened={open} onClose={() => setOpen(false)} title="Images" fullScreen>
        {study?.viewer_url && (
          <Box
            component="iframe"
            src={study.viewer_url}
            title={`Images for ${order.accession_number}`}
            w="100%"
            h="calc(100vh - 80px)"
            style={{ border: 0 }}
          />
        )}
      </Modal>
    </Stack>
  );
}
