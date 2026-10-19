/**
 * HPR coverage — the share of active doctors carrying an HPR ID, and the
 * doctors still missing one. Rendered only for holders of `abdm.hpr.manage`,
 * so the query is never issued without the permission.
 */

import { Group, Loader, Progress, ScrollArea, Stack, Text } from "@mantine/core";
import type { DoctorHpr } from "@medbrains/types";
import { IconId } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Badge, Button, Card, Table } from "@/components/ui";
import { abdmRegistryService } from "@/services/abdmRegistry.service";
import { DoctorHprModal, HPR_COVERAGE_KEY } from "./DoctorHprModal";

export function HprCoveragePanel() {
  const [editing, setEditing] = useState<DoctorHpr | null>(null);
  const { data, isLoading, isError } = useQuery({
    queryKey: HPR_COVERAGE_KEY,
    queryFn: () => abdmRegistryService.getHprCoverage(),
  });

  if (isLoading) {
    return (
      <Card mb="md">
        <Group gap="xs">
          <Loader size="xs" />
          <Text size="sm">Checking HPR coverage...</Text>
        </Group>
      </Card>
    );
  }
  if (isError || !data) {
    return (
      <Alert tone="danger" mb="md">
        HPR coverage could not be loaded. This does not mean doctors are missing HPR IDs.
      </Alert>
    );
  }

  return (
    <Card mb="md">
      <Stack gap="sm">
        <Group justify="space-between">
          <Text fw={600}>HPR coverage (ABDM)</Text>
          <Badge tone={data.missing.length === 0 ? "success" : "warning"}>
            {data.coverage_percent}% of active doctors
          </Badge>
        </Group>
        <Progress
          value={data.coverage_percent}
          aria-label={`${data.coverage_percent}% of active doctors have an HPR ID`}
        />
        <Text size="sm" c="dimmed">
          {data.with_hpr_id} of {data.active_doctors} active doctors have an HPR ID; {data.verified}{" "}
          verified with HPR.
        </Text>
        {data.missing.length > 0 && (
          <ScrollArea.Autosize mah={240}>
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Missing an HPR ID</Table.Th>
                  <Table.Th>MCI / NMC</Table.Th>
                  <Table.Th />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {data.missing.map((doctor) => (
                  <Table.Tr key={doctor.id}>
                    <Table.Td>{doctor.display_name}</Table.Td>
                    <Table.Td>{doctor.mci_number ?? "-"}</Table.Td>
                    <Table.Td>
                      <Button
                        tone="ghost"
                        size="xs"
                        leftSection={<IconId size={16} />}
                        onClick={() => setEditing(doctor)}
                      >
                        Add HPR ID
                      </Button>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea.Autosize>
        )}
      </Stack>
      {editing && (
        <DoctorHprModal
          doctor={editing}
          registryConfigured={data.registry_configured}
          onClose={() => setEditing(null)}
        />
      )}
    </Card>
  );
}
