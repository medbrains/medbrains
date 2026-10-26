// The DPO, grievance officer and CERT-In point of contact: who they are,
// whether patients can see them, and the printed notice.

import { Group, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P, type PrivacyOfficerRole } from "@medbrains/types";
import { IconPrinter, IconSend } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router";
import { Badge, Button, Card, toast } from "@/components/ui";
import { OFFICER_BASIS, OFFICER_LABEL } from "@/lib/privacy-compliance";
import { privacyComplianceService } from "@/services/privacyCompliance.service";
import { OfficerModal } from "./OfficerModal";

const ROLES: PrivacyOfficerRole[] = ["grievance_officer", "dpo", "certin_poc"];

export function OfficersTab() {
  const canEdit = useHasPermission(P.REGULATORY.DPDP.OFFICERS);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<PrivacyOfficerRole | null>(null);
  const { data = [], error } = useQuery({
    queryKey: ["privacy-compliance", "officers"],
    queryFn: () => privacyComplianceService.listOfficers(),
  });
  const publish = useMutation({
    mutationFn: (role: PrivacyOfficerRole) => privacyComplianceService.publishOfficer(role),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["privacy-compliance"] });
      toast.success("Published to the patient portal and the printed notice");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  if (error) return <Text c="danger">{(error as Error).message}</Text>;
  return (
    <Stack>
      <Group justify="flex-end">
        <Button
          tone="secondary"
          leftSection={<IconPrinter size={16} />}
          onClick={() => navigate("/privacy-compliance/notice")}
        >
          Printed notice for patients
        </Button>
      </Group>
      <SimpleGrid cols={{ base: 1, md: 3 }}>
        {ROLES.map((role) => {
          const o = data.find((x) => x.role === role);
          return (
            <Card key={role} withBorder padding="md">
              <Stack gap="xs">
                <Group justify="space-between">
                  <Title order={5}>{OFFICER_LABEL[role]}</Title>
                  {o ? (
                    <Badge tone={o.published_at ? "success" : "warning"}>
                      {o.published_at ? "Published" : "Not published"}
                    </Badge>
                  ) : (
                    <Badge tone="danger">Not named</Badge>
                  )}
                </Group>
                <Text size="xs" c="dimmed">
                  {OFFICER_BASIS[role]}
                </Text>
                {o ? (
                  <Stack gap={0}>
                    <Text size="sm" fw={600}>
                      {o.name}, {o.designation}
                    </Text>
                    <Text size="sm">{o.email}</Text>
                    <Text size="sm">{o.phone}</Text>
                    {o.hours && <Text size="xs">{o.hours}</Text>}
                  </Stack>
                ) : (
                  <Text size="sm">Nobody is named yet.</Text>
                )}
                {canEdit && (
                  <Group gap="xs">
                    <Button tone="secondary" size="xs" onClick={() => setEditing(role)}>
                      {o ? "Change" : "Name someone"}
                    </Button>
                    {o && !o.published_at && role !== "certin_poc" && (
                      <Button
                        tone="primary"
                        size="xs"
                        leftSection={<IconSend size={14} />}
                        onClick={() => publish.mutate(role)}
                        loading={publish.isPending}
                      >
                        Publish to patients
                      </Button>
                    )}
                  </Group>
                )}
              </Stack>
            </Card>
          );
        })}
      </SimpleGrid>
      {editing && (
        <OfficerModal
          role={editing}
          current={data.find((x) => x.role === editing)}
          onClose={() => setEditing(null)}
        />
      )}
    </Stack>
  );
}
