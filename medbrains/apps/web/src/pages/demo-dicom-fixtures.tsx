import {
  Badge,
  Button,
  Card,
  Container,
  Group,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { P } from "@medbrains/types";
import { IconFileTypeXml } from "@tabler/icons-react";
import chestXrayPaDemoDicom from "../assets/demo-dicom/chest-xray-pa-demo.dcm?url";
import ctBrainPlainDemoDicom from "../assets/demo-dicom/ct-brain-plain-demo.dcm?url";
import leftHandXrayDemoDicom from "../assets/demo-dicom/left-hand-xray-demo.dcm?url";
import mriRightKneeDemoDicom from "../assets/demo-dicom/mri-right-knee-demo.dcm?url";
import usAbdomenDemoDicom from "../assets/demo-dicom/us-abdomen-demo.dcm?url";
import { useRequirePermission } from "../hooks/useRequirePermission";

const fixtures = [
  {
    title: "Chest X-Ray PA",
    modality: "CR",
    bodySite: "Chest",
    dicom: chestXrayPaDemoDicom,
  },
  {
    title: "CT Brain Plain",
    modality: "CT",
    bodySite: "Brain",
    dicom: ctBrainPlainDemoDicom,
  },
  {
    title: "US Abdomen",
    modality: "US",
    bodySite: "Abdomen",
    dicom: usAbdomenDemoDicom,
  },
  {
    title: "MRI Right Knee",
    modality: "MR",
    bodySite: "Knee",
    dicom: mriRightKneeDemoDicom,
  },
  {
    title: "Left Hand X-Ray",
    modality: "DX",
    bodySite: "Hand",
    dicom: leftHandXrayDemoDicom,
  },
];

export function DemoDicomFixturesPage() {
  useRequirePermission(P.RADIOLOGY.MODALITIES_MANAGE);

  return (
    <Container size="lg" py="xl">
      <Stack gap="lg">
        <Stack gap={4}>
          <Group gap="sm">
            <Title order={1}>DICOM Demo Fixtures</Title>
            <Badge color="teal" variant="light">
              Synthetic
            </Badge>
          </Group>
          <Text c="dimmed">
            Local synthetic imaging samples for validating doctor view, radiology records, PACS
            links, and mobile/web rendering. These fixtures are de-identified demo data and are not
            for diagnosis.
          </Text>
        </Stack>

        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
          {fixtures.map((fixture) => (
            <Card key={fixture.dicom} withBorder radius="md" padding="lg">
              <Stack gap="md">
                <Group justify="space-between" align="flex-start">
                  <Stack gap={2}>
                    <Text fw={700}>{fixture.title}</Text>
                    <Text size="sm" c="dimmed">
                      {fixture.bodySite}
                    </Text>
                  </Stack>
                  <Badge variant="filled">{fixture.modality}</Badge>
                </Group>

                <Group gap="xs">
                  <Button
                    component="a"
                    href={fixture.dicom}
                    target="_blank"
                    rel="noreferrer"
                    leftSection={<IconFileTypeXml size={16} />}
                    variant="light"
                  >
                    DICOM
                  </Button>
                </Group>
              </Stack>
            </Card>
          ))}
        </SimpleGrid>
      </Stack>
    </Container>
  );
}
