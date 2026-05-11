import {
  Anchor,
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
import { IconExternalLink, IconFileTypeHtml, IconFileTypeXml } from "@tabler/icons-react";

const fixtures = [
  {
    title: "Chest X-Ray PA",
    modality: "CR",
    bodySite: "Chest",
    viewer: "/demo/dicom/chest-xray-pa-demo.html",
    dicom: "/demo/dicom/chest-xray-pa-demo.dcm",
  },
  {
    title: "CT Brain Plain",
    modality: "CT",
    bodySite: "Brain",
    viewer: "/demo/dicom/ct-brain-plain-demo.html",
    dicom: "/demo/dicom/ct-brain-plain-demo.dcm",
  },
  {
    title: "US Abdomen",
    modality: "US",
    bodySite: "Abdomen",
    viewer: "/demo/dicom/us-abdomen-demo.html",
    dicom: "/demo/dicom/us-abdomen-demo.dcm",
  },
  {
    title: "MRI Right Knee",
    modality: "MR",
    bodySite: "Knee",
    viewer: "/demo/dicom/mri-right-knee-demo.html",
    dicom: "/demo/dicom/mri-right-knee-demo.dcm",
  },
  {
    title: "Left Hand X-Ray",
    modality: "DX",
    bodySite: "Hand",
    viewer: "/demo/dicom/left-hand-xray-demo.html",
    dicom: "/demo/dicom/left-hand-xray-demo.dcm",
  },
];

export function DemoDicomFixturesPage() {
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
                    href={fixture.viewer}
                    target="_blank"
                    rel="noreferrer"
                    leftSection={<IconFileTypeHtml size={16} />}
                    rightSection={<IconExternalLink size={14} />}
                    variant="filled"
                  >
                    Open viewer
                  </Button>
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

        <Text size="sm" c="dimmed">
          Static index:{" "}
          <Anchor href="/demo/dicom/index.html" target="_blank" rel="noreferrer">
            /demo/dicom/index.html
          </Anchor>
        </Text>
      </Stack>
    </Container>
  );
}
