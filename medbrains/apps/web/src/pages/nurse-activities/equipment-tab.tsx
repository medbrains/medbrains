// IPD EquipmentTab — split from nurse-activities.tsx (pure move).

import { Card, Group, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge, Button, toast } from "@/components/ui";
import { nurseActivitiesService } from "@/services/nurseActivities.service";

interface EquipmentCheckRow {
  id: string;
  checked_at: string;
  all_passed: boolean;
  next_check_due_at?: string | null;
}

export function EquipmentTab() {
  const canView = useHasPermission(P.NURSE.EQUIPMENT_VIEW);
  const canRecord = useHasPermission(P.NURSE.EQUIPMENT_RECORD);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["nurse-equipment-checks"],
    queryFn: () =>
      nurseActivitiesService.listEquipmentChecks({ limit: 25 }) as Promise<EquipmentCheckRow[]>,
    enabled: canView,
  });

  const create = useMutation({
    mutationFn: () =>
      nurseActivitiesService.createEquipmentCheck({
        items: [{ label: "Routine ward equipment round", status: "passed" }],
        all_passed: true,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["nurse-equipment-checks"] }),
    onError: (e: Error) => toast.error(e.message, { title: "Could not record equipment check" }),
  });

  return (
    <Stack>
      <Group justify="space-between">
        <Text fw={700}>Ward Equipment Checks</Text>
        {canRecord && (
          <Button
            tone="primary"
            size="xs"
            onClick={() => create.mutate()}
            loading={create.isPending}
          >
            Mark routine check
          </Button>
        )}
      </Group>
      {canView ? (
        <>
          {isLoading && <Text c="dimmed">Loading checks...</Text>}
          {data?.length === 0 && <Text c="dimmed">No equipment checks recorded.</Text>}
          <Stack gap="xs">
            {data?.map((row) => (
              <Card key={row.id} withBorder padding="sm">
                <Group justify="space-between">
                  <Badge tone={row.all_passed ? "success" : "danger"}>
                    {row.all_passed ? "Passed" : "Needs action"}
                  </Badge>
                  <Text size="sm" c="dimmed">
                    {new Date(row.checked_at).toLocaleString()}
                  </Text>
                </Group>
              </Card>
            ))}
          </Stack>
        </>
      ) : (
        <Text size="sm" c="dimmed">
          You can record equipment checks, but check history requires equipment view permission.
        </Text>
      )}
    </Stack>
  );
}
