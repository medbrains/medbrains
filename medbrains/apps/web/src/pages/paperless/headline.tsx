import { SimpleGrid, Stack, Text } from "@mantine/core";
import type { PaperlessReport } from "@medbrains/types";
import { Card } from "@/components/ui";
import { formatShare, ofCount } from "./labels";

interface HeadlineProps {
  report: PaperlessReport;
}

interface ShareTileProps {
  label: string;
  value: string;
  detail: string;
  testId: string;
}

/** One headline share: the number, and in words what it is made of. */
function ShareTile({ label, value, detail, testId }: ShareTileProps) {
  return (
    <Card padding="md" pattern={false} data-testid={testId}>
      <Stack gap={4}>
        <Text size="sm" c="dimmed">
          {label}
        </Text>
        <Text fz="xl" fw={700} data-testid={`${testId}-value`}>
          {value}
        </Text>
        <Text size="xs" c="dimmed">
          {detail}
        </Text>
      </Stack>
    </Card>
  );
}

/**
 * The three headline shares. A range the meter never counted reads "not
 * counted yet", a counted range with no documents "no documents"; the
 * legally-signed share is shown at 0% with the reason, never hidden.
 */
export function Headline({ report }: HeadlineProps) {
  const { totals, legal } = report;
  const empty = report.measured_days === 0 ? "Not counted yet" : "No documents";
  return (
    <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
      <ShareTile
        label="Made in the system"
        value={formatShare(report.digital_pct, empty)}
        detail={`${ofCount(totals.created, totals.created + totals.scanned)} clinical documents; the rest were paper scanned in`}
        testId="paperless-digital"
      />
      <ShareTile
        label="Signed digitally"
        value={formatShare(report.signed_pct, empty)}
        detail={`${ofCount(totals.signed, totals.created)} documents made in the system`}
        testId="paperless-signed"
      />
      <ShareTile
        label="Legally signed (IT Act)"
        value={formatShare(legal.pct, empty)}
        detail={legal.note}
        testId="paperless-legal"
      />
    </SimpleGrid>
  );
}
