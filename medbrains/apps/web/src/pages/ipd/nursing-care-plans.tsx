// Care plans on the admission: read, write, revise, resolve or discontinue.
// Plans the server opens itself (high Morse / Braden) appear here like any
// other, for the nurse to carry and close.

import { Group, List, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import type { CarePlanStatus, IpdCarePlan } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Badge, Button } from "@/components/ui";
import { ipdService } from "@/services/ipd.service";
import { CarePlanFormModal } from "./nursing-care-plan-form";
import { interventionLines } from "./nursing-forms";

const STATUS_TONE = { active: "success", resolved: "neutral", discontinued: "danger" } as const;

export function CarePlansSection({ admissionId }: { admissionId: string }) {
  const canList = useHasPermission(P.IPD.CARE_PLANS_LIST);
  const canWrite = useHasPermission(P.IPD.CARE_PLANS_CREATE);
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<IpdCarePlan | null>(null);
  const [formOpened, setFormOpened] = useState(false);

  const plansQuery = useQuery({
    queryKey: ["ipd-care-plans", admissionId],
    queryFn: () => ipdService.listCarePlans(admissionId),
    enabled: canList,
  });

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: CarePlanStatus }) =>
      ipdService.updateCarePlan(admissionId, id, { status }),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["ipd-care-plans", admissionId] }),
  });

  const openForm = (plan: IpdCarePlan | null) => {
    setEditing(plan);
    setFormOpened(true);
  };

  const plans = (plansQuery.data ?? []) as IpdCarePlan[];

  return (
    <Stack gap="xs">
      <Group justify="space-between">
        <Text fw={600} size="sm">
          Care plans
        </Text>
        {canWrite && (
          <Button
            tone="secondary"
            size="xs"
            leftSection={<IconPlus size={14} />}
            onClick={() => openForm(null)}
          >
            New care plan
          </Button>
        )}
      </Group>
      {!canList && (
        <Text c="dimmed" size="sm">
          You do not have access to care plans.
        </Text>
      )}
      {plansQuery.isError && (
        <Alert tone="danger">Care plans could not be loaded. They have not been lost.</Alert>
      )}
      {setStatus.isError && <Alert tone="danger">{setStatus.error.message}</Alert>}
      {plans.map((cp) => (
        <Stack key={cp.id} gap={4} p="xs" bd="1px solid var(--mantine-color-gray-3)">
          <Group justify="space-between">
            <Text size="sm" fw={500}>
              {cp.nursing_diagnosis}
            </Text>
            <Badge size="xs" tone={STATUS_TONE[cp.status]}>
              {cp.status}
            </Badge>
          </Group>
          {cp.goals && <Text size="xs">Goals: {cp.goals}</Text>}
          {interventionLines(cp.interventions).length > 0 && (
            <List size="xs">
              {interventionLines(cp.interventions).map((line) => (
                <List.Item key={line}>{line}</List.Item>
              ))}
            </List>
          )}
          {cp.evaluation && <Text size="xs">Evaluation: {cp.evaluation}</Text>}
          {canWrite && cp.status === "active" && (
            <Group gap="xs" justify="flex-end">
              <Button tone="ghost" size="xs" onClick={() => openForm(cp)}>
                Revise
              </Button>
              <Button
                tone="ghost"
                size="xs"
                loading={setStatus.isPending}
                onClick={() => setStatus.mutate({ id: cp.id, status: "resolved" })}
              >
                Mark resolved
              </Button>
              <Button
                tone="ghost"
                size="xs"
                loading={setStatus.isPending}
                onClick={() => setStatus.mutate({ id: cp.id, status: "discontinued" })}
              >
                Discontinue
              </Button>
            </Group>
          )}
        </Stack>
      ))}
      {canList && plansQuery.isSuccess && plans.length === 0 && (
        <Text c="dimmed" size="sm">
          No care plans yet.
        </Text>
      )}
      {canWrite && (
        <CarePlanFormModal
          admissionId={admissionId}
          plan={editing}
          opened={formOpened}
          onClose={() => setFormOpened(false)}
        />
      )}
    </Stack>
  );
}
