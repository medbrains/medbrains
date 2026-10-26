// The printed privacy notice for the front desk and wards: exactly what is
// published — the notice in each language and whom to contact.

import { Group, Stack, Text, Title } from "@mantine/core";
import { P, type PublicOfficer } from "@medbrains/types";
import { IconPrinter } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import Markdown from "react-markdown";
import { Alert, Button, Card } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { LANGUAGE_LABEL } from "@/lib/privacy-compliance";
import { privacyComplianceService } from "@/services/privacyCompliance.service";

function Contact({ label, o }: { label: string; o: PublicOfficer }) {
  return (
    <Stack gap={0}>
      <Text fw={700}>{label}</Text>
      <Text>
        {o.name}, {o.designation}
      </Text>
      <Text>
        {o.email} · {o.phone}
      </Text>
      {o.address && <Text>{o.address}</Text>}
      {o.hours && <Text>{o.hours}</Text>}
    </Stack>
  );
}

export function NoticePrintPage() {
  useRequirePermission(P.REGULATORY.DPDP.VIEW);
  const { data, isLoading, error } = useQuery({
    queryKey: ["privacy-compliance", "public-notice"],
    queryFn: () => privacyComplianceService.publicNotice(),
  });
  if (error)
    return (
      <Alert tone="danger" title="Could not load the notice">
        {(error as Error).message}
      </Alert>
    );
  if (isLoading || !data) return <Text c="dimmed">Loading…</Text>;
  const nothing = data.notices.length === 0 && !data.grievance_officer && !data.dpo;
  return (
    <Stack p="md">
      <Group justify="space-between" className="no-print">
        <Title order={3}>Privacy notice — as published</Title>
        <Button
          tone="primary"
          leftSection={<IconPrinter size={16} />}
          onClick={() => window.print()}
          disabled={nothing}
        >
          Print
        </Button>
      </Group>
      {nothing && (
        <Alert tone="warning" title="Nothing is published yet">
          Publish the privacy notice and the grievance officer first; this page prints only what
          patients can see.
        </Alert>
      )}
      {(data.grievance_officer || data.dpo) && (
        <Card withBorder padding="md">
          <Group align="flex-start" gap="xl">
            {data.grievance_officer && (
              <Contact label="Grievance officer" o={data.grievance_officer} />
            )}
            {data.dpo && <Contact label="Data Protection Officer" o={data.dpo} />}
          </Group>
        </Card>
      )}
      {data.notices.map((n) => (
        <Card key={n.language} withBorder padding="md">
          <Text size="xs" c="dimmed">
            {LANGUAGE_LABEL[n.language]} · version {n.version}
          </Text>
          <Markdown>{n.body}</Markdown>
        </Card>
      ))}
    </Stack>
  );
}
