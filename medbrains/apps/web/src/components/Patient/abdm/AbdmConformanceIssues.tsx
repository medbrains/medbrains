import { Stack, Text } from "@mantine/core";
import { Badge } from "@/components/ui";

interface AbdmConformanceIssuesProps {
  /** NRCeS profile rules the record's FHIR bundle broke when last sent. */
  issues: string[];
}

/**
 * A record that reached the other hospital in a FHIR bundle that breaks its
 * NRCeS profile: said plainly, with each rule, so it is fixed rather than
 * passing as shared cleanly. Renders nothing for a clean record.
 */
export function AbdmConformanceIssues({ issues }: AbdmConformanceIssuesProps) {
  if (issues.length === 0) return null;
  return (
    <Stack gap={2} data-testid="abdm-conformance-issues">
      <Badge tone="warning">Sent, but not to the FHIR standard</Badge>
      {issues.map((rule) => (
        <Text key={rule} size="xs" c="var(--mb-text-secondary)" ff="monospace">
          {rule}
        </Text>
      ))}
    </Stack>
  );
}
